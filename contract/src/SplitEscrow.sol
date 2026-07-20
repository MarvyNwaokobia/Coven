// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SplitEscrow
 * @notice Escrow for group bill splits. Members contribute their share.
 *         Funds release to the recipient (e.g. the person who paid the
 *         restaurant) when all members have paid. The creator can cancel an
 *         open split at any time, and anyone can expire it after the deadline;
 *         both paths refund members who already paid.
 */
contract SplitEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable USDC;

    enum SplitStatus {
        None,
        Open,
        Complete,
        Expired
    }

    struct Split {
        address creator; // Who created the split
        address recipient; // Who receives the collected funds
        uint256 totalAmount; // Total to collect
        uint256 collected; // How much has been collected so far
        uint256 deadline; // After this, the split can be expired
        SplitStatus status;
        mapping(address => uint256) owed; // member → amount owed
        mapping(address => bool) paid; // member → has paid
        address[] members;
        string description;
    }

    mapping(bytes32 => Split) private splits;
    uint256 private _nonce;

    event SplitCreated(
        bytes32 indexed splitId,
        address indexed creator,
        address indexed recipient,
        uint256 total,
        uint256 deadline,
        string description
    );
    event MemberPaid(bytes32 indexed splitId, address indexed member, uint256 amount);
    event SplitComplete(bytes32 indexed splitId, address indexed recipient, uint256 amount);
    event SplitCancelled(bytes32 indexed splitId);

    error SplitNotFound();
    error AlreadyPaid();
    error SplitNotOpen();
    error NotMember();
    error DeadlineNotPassed();
    error NotCreator();
    error LengthMismatch();
    error NoMembers();
    error ZeroAddress();
    error ZeroAmount();
    error DuplicateMember();

    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        USDC = IERC20(_usdc);
    }

    /**
     * @notice Create a bill split.
     * @param members       Wallet addresses who owe money
     * @param amounts       How much each member owes (parallel array)
     * @param recipient     Who gets the money when all have paid
     * @param description   Human-readable description ("Dinner at Nkoyo")
     * @param deadlineHours Hours until the split can be expired
     */
    function createSplit(
        address[] calldata members,
        uint256[] calldata amounts,
        address recipient,
        string calldata description,
        uint256 deadlineHours
    ) external returns (bytes32 splitId) {
        if (members.length == 0) revert NoMembers();
        if (members.length != amounts.length) revert LengthMismatch();
        if (recipient == address(0)) revert ZeroAddress();

        splitId = keccak256(abi.encodePacked(msg.sender, block.timestamp, description, _nonce++));

        Split storage s = splits[splitId];
        s.creator = msg.sender;
        s.recipient = recipient;
        s.deadline = block.timestamp + (deadlineHours * 1 hours);
        s.status = SplitStatus.Open;
        s.description = description;
        s.members = members;

        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();
            if (s.owed[members[i]] != 0) revert DuplicateMember();
            s.owed[members[i]] = amounts[i];
            s.totalAmount += amounts[i];
        }

        emit SplitCreated(splitId, msg.sender, recipient, s.totalAmount, s.deadline, description);
    }

    /**
     * @notice Member pays their share. Auto-releases to recipient when fully collected.
     */
    function pay(bytes32 splitId) external nonReentrant {
        Split storage s = splits[splitId];
        if (s.status == SplitStatus.None) revert SplitNotFound();
        if (s.status != SplitStatus.Open) revert SplitNotOpen();
        if (s.owed[msg.sender] == 0) revert NotMember();
        if (s.paid[msg.sender]) revert AlreadyPaid();

        uint256 amount = s.owed[msg.sender];
        s.paid[msg.sender] = true;
        s.collected += amount;

        USDC.safeTransferFrom(msg.sender, address(this), amount);
        emit MemberPaid(splitId, msg.sender, amount);

        if (s.collected >= s.totalAmount) {
            s.status = SplitStatus.Complete;
            USDC.safeTransfer(s.recipient, s.collected);
            emit SplitComplete(splitId, s.recipient, s.collected);
        }
    }

    /**
     * @notice Creator cancels an open split; members who paid are refunded.
     */
    function cancel(bytes32 splitId) external nonReentrant {
        Split storage s = splits[splitId];
        if (s.status == SplitStatus.None) revert SplitNotFound();
        if (s.creator != msg.sender) revert NotCreator();
        _expire(splitId, s);
    }

    /**
     * @notice Anyone can expire a split after its deadline; paid members are refunded.
     */
    function expire(bytes32 splitId) external nonReentrant {
        Split storage s = splits[splitId];
        if (s.status == SplitStatus.None) revert SplitNotFound();
        if (block.timestamp < s.deadline) revert DeadlineNotPassed();
        _expire(splitId, s);
    }

    function _expire(bytes32 splitId, Split storage s) private {
        if (s.status != SplitStatus.Open) revert SplitNotOpen();
        s.status = SplitStatus.Expired;

        for (uint256 i = 0; i < s.members.length; i++) {
            address member = s.members[i];
            if (s.paid[member]) {
                USDC.safeTransfer(member, s.owed[member]);
            }
        }

        emit SplitCancelled(splitId);
    }

    // View helpers
    function getSplit(bytes32 splitId)
        external
        view
        returns (
            address creator,
            address recipient,
            uint256 totalAmount,
            uint256 collected,
            uint256 deadline,
            SplitStatus status,
            string memory description
        )
    {
        Split storage s = splits[splitId];
        return (s.creator, s.recipient, s.totalAmount, s.collected, s.deadline, s.status, s.description);
    }

    function getMemberOwed(bytes32 splitId, address member) external view returns (uint256) {
        return splits[splitId].owed[member];
    }

    function hasMemberPaid(bytes32 splitId, address member) external view returns (bool) {
        return splits[splitId].paid[member];
    }

    function getMembers(bytes32 splitId) external view returns (address[] memory) {
        return splits[splitId].members;
    }
}
