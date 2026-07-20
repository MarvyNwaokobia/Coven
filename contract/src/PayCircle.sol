// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PayCircle
 * @notice Handles group payments, split bills, and platform fee collection.
 *         Simple P2P transfers go direct wallet-to-wallet — this contract
 *         is for multi-party payment flows and fee-bearing sends.
 */
contract PayCircle is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable USDC;
    address public feeTreasury;

    // Platform fees in basis points
    uint16 public constant SEND_FEE_BPS = 50; // 0.5% on cross-chain sends
    uint16 public constant OFFRAMP_FEE_BPS = 100; // 1.0% on offramp
    uint16 public constant GROUP_FEE_BPS = 25; // 0.25% on group payments

    uint256 private _nonce;

    struct GroupPayment {
        address initiator;
        uint256 total;
        uint256 fee;
        string note;
        uint256 createdAt;
    }

    mapping(bytes32 => GroupPayment) public groupPayments;

    event PaymentSent(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fee,
        string note,
        bytes32 indexed paymentId
    );

    event GroupPaymentExecuted(
        bytes32 indexed groupPaymentId, address indexed initiator, uint256 total, uint256 fee, string note
    );
    event FeesCollected(address indexed payer, uint256 amount);
    event FeeTreasuryUpdated(address indexed newTreasury);

    error InvalidRecipients();
    error LengthMismatch();
    error ZeroAmount();
    error ZeroAddress();

    constructor(address _usdc, address _feeTreasury, address _owner) Ownable(_owner) {
        if (_usdc == address(0) || _feeTreasury == address(0)) revert ZeroAddress();
        USDC = IERC20(_usdc);
        feeTreasury = _feeTreasury;
    }

    /**
     * @notice Send USDC to a single recipient with platform fee.
     * @dev Used for cross-chain payments arriving via CCTP.
     *      Direct on-Arc P2P goes wallet-to-wallet without this contract.
     */
    function send(address recipient, uint256 amount, string calldata note)
        external
        nonReentrant
        returns (bytes32 paymentId)
    {
        if (amount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert InvalidRecipients();

        uint256 fee = (amount * SEND_FEE_BPS) / 10_000;
        uint256 netAmount = amount - fee;

        USDC.safeTransferFrom(msg.sender, recipient, netAmount);
        if (fee > 0) USDC.safeTransferFrom(msg.sender, feeTreasury, fee);

        paymentId = keccak256(abi.encodePacked(msg.sender, recipient, amount, block.timestamp, _nonce++));

        emit PaymentSent(msg.sender, recipient, netAmount, fee, note, paymentId);
    }

    /**
     * @notice Split a payment across multiple recipients in one transaction.
     * @dev Initiator pays total + group fee; contract distributes to all recipients.
     */
    function splitPayment(address[] calldata recipients, uint256[] calldata amounts, string calldata note)
        external
        nonReentrant
        returns (bytes32 groupPaymentId)
    {
        if (recipients.length == 0) revert InvalidRecipients();
        if (recipients.length != amounts.length) revert LengthMismatch();

        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            if (recipients[i] == address(0)) revert InvalidRecipients();
            if (amounts[i] == 0) revert ZeroAmount();
            total += amounts[i];
        }

        uint256 fee = (total * GROUP_FEE_BPS) / 10_000;

        for (uint256 i = 0; i < recipients.length; i++) {
            USDC.safeTransferFrom(msg.sender, recipients[i], amounts[i]);
        }
        if (fee > 0) USDC.safeTransferFrom(msg.sender, feeTreasury, fee);

        groupPaymentId = keccak256(abi.encodePacked(msg.sender, total, block.timestamp, _nonce++));

        groupPayments[groupPaymentId] = GroupPayment({
            initiator: msg.sender,
            total: total,
            fee: fee,
            note: note,
            createdAt: block.timestamp
        });

        emit GroupPaymentExecuted(groupPaymentId, msg.sender, total, fee, note);
    }

    /**
     * @notice Collect platform fee on offramp (called before a Yellow Card payout).
     * @dev Caller must have approved this contract for the fee amount.
     */
    function collectOfframpFee(uint256 amount) external nonReentrant returns (uint256 fee, uint256 netAmount) {
        if (amount == 0) revert ZeroAmount();
        fee = (amount * OFFRAMP_FEE_BPS) / 10_000;
        netAmount = amount - fee;

        if (fee > 0) USDC.safeTransferFrom(msg.sender, feeTreasury, fee);
        emit FeesCollected(msg.sender, fee);
    }

    // Admin
    function setFeeTreasury(address _feeTreasury) external onlyOwner {
        if (_feeTreasury == address(0)) revert ZeroAddress();
        feeTreasury = _feeTreasury;
        emit FeeTreasuryUpdated(_feeTreasury);
    }
}
