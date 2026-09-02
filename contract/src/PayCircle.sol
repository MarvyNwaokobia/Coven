// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title PayCircle
 * @notice Handles group payments, split bills, and platform fee collection.
 *         Simple P2P transfers go direct wallet-to-wallet — this contract
 *         is for multi-party payment flows and fee-bearing sends.
 *
 *         Fees are accrued here and pulled to the treasury with withdrawFees,
 *         not pushed on every payment. If the treasury cannot receive USDC (for
 *         example it is blocklisted), payments keep working and only the
 *         withdrawal is blocked until the owner sets a new treasury.
 *
 *         Ownership only controls where fees go. It moves in two steps
 *         (propose, then accept) so it cannot be handed to a wrong address by
 *         mistake, and it cannot be renounced.
 */
contract PayCircle is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    IERC20 public immutable USDC;
    address public feeTreasury;

    // Platform fees in basis points
    uint16 public constant SEND_FEE_BPS = 50; // 0.5% on cross-chain sends
    uint16 public constant OFFRAMP_FEE_BPS = 100; // 1.0% on offramp
    uint16 public constant GROUP_FEE_BPS = 25; // 0.25% on group payments

    /// @notice Bounds the recipients array of a group payment.
    uint256 public constant MAX_RECIPIENTS = 50;

    /// @notice Fees collected but not yet withdrawn to the treasury.
    uint256 public accruedFees;

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
    event FeesWithdrawn(address indexed treasury, uint256 amount);
    event FeeTreasuryUpdated(address indexed newTreasury);

    error InvalidRecipients();
    error LengthMismatch();
    error ZeroAmount();
    error ZeroAddress();
    error TooManyRecipients();
    error NoFees();
    error RenounceDisabled();

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
        _collectFee(fee);

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
        if (recipients.length > MAX_RECIPIENTS) revert TooManyRecipients();
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
        _collectFee(fee);

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

        _collectFee(fee);
        emit FeesCollected(msg.sender, fee);
    }

    /**
     * @notice Send every accrued fee to the treasury. Anyone can call it; the
     *         destination is always the current treasury.
     */
    function withdrawFees() external nonReentrant returns (uint256 amount) {
        amount = accruedFees;
        if (amount == 0) revert NoFees();
        accruedFees = 0;
        USDC.safeTransfer(feeTreasury, amount);
        emit FeesWithdrawn(feeTreasury, amount);
    }

    function _collectFee(uint256 fee) private {
        if (fee == 0) return;
        accruedFees += fee;
        USDC.safeTransferFrom(msg.sender, address(this), fee);
    }

    // Admin

    /// @dev Ownership can be transferred (two steps) but never abandoned.
    function renounceOwnership() public pure override {
        revert RenounceDisabled();
    }

    function setFeeTreasury(address _feeTreasury) external onlyOwner {
        if (_feeTreasury == address(0)) revert ZeroAddress();
        feeTreasury = _feeTreasury;
        emit FeeTreasuryUpdated(_feeTreasury);
    }
}
