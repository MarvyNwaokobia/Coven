// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SplitEscrow
 * @notice Escrow for group bill splits. Members contribute their share.
 *         Funds release to the recipient (e.g. the person who paid the
 *         restaurant) when all members have paid. The creator can cancel an
 *         open split at any time, and anyone can expire it after the deadline.
 *         Both close the split; each member who already paid then claims their
 *         own refund with claimRefund.
 *
 *         Refunds are pulled, not pushed. A push loop over every member reverts
 *         as a whole if one transfer fails, so a single blocklisted member could
 *         trap everyone else's refund. Pulled, that member is only stuck with
 *         their own.
 */
contract SplitEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable USDC;

    /// @notice Bounds the members array so nothing that walks it can run out of gas.
    uint256 public constant MAX_MEMBERS = 50;
    uint256 public constant MAX_DEADLINE_HOURS = 24 * 365;

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
        mapping(address => bool) refunded; // member → has claimed their refund
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
    event Refunded(bytes32 indexed splitId, address indexed member, uint256 amount);

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
    error TooManyMembers();
    error InvalidDeadline();
    error SplitMismatch();
    error SplitNotExpired();
    error NothingToRefund();

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
     * @param deadlineHours Hours until the split can be expired (1 to MAX_DEADLINE_HOURS)
     */
    function createSplit(
        address[] calldata members,
        uint256[] calldata amounts,
        address recipient,
        string calldata description,
        uint256 deadlineHours
    ) external returns (bytes32 splitId) {
        if (members.length == 0) revert NoMembers();
        if (members.length > MAX_MEMBERS) revert TooManyMembers();
        if (members.length != amounts.length) revert LengthMismatch();
        if (recipient == address(0)) revert ZeroAddress();
        if (deadlineHours == 0 || deadlineHours > MAX_DEADLINE_HOURS) revert InvalidDeadline();

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
     * @dev    A split is created by one person and paid by others, so the payer
     *         states the recipient and the amount they believe they are paying and
     *         the call reverts if the split says otherwise. Without this the payer
     *         only ever names an id, and whoever showed them that id decides where
     *         their money goes.
     */
    function pay(bytes32 splitId, address expectedRecipient, uint256 expectedAmount) external nonReentrant {
        Split storage s = splits[splitId];
        if (s.status == SplitStatus.None) revert SplitNotFound();
        if (s.status != SplitStatus.Open) revert SplitNotOpen();
        if (s.owed[msg.sender] == 0) revert NotMember();
        if (s.paid[msg.sender]) revert AlreadyPaid();

        uint256 amount = s.owed[msg.sender];
        if (s.recipient != expectedRecipient || amount != expectedAmount) revert SplitMismatch();

        s.paid[msg.sender] = true;
        s.collected += amount;

        USDC.safeTransferFrom(msg.sender, address(this), amount);
        emit MemberPaid(splitId, msg.sender, amount);

        if (s.collected == s.totalAmount) {
            s.status = SplitStatus.Complete;
            USDC.safeTransfer(s.recipient, s.collected);
            emit SplitComplete(splitId, s.recipient, s.collected);
        }
    }

    /**
     * @notice Creator cancels an open split. Members who paid claim their refunds.
     */
    function cancel(bytes32 splitId) external {
        Split storage s = splits[splitId];
        if (s.status == SplitStatus.None) revert SplitNotFound();
        if (s.creator != msg.sender) revert NotCreator();
        _close(splitId, s);
    }

    /**
     * @notice Anyone can expire a split after its deadline. Members who paid claim their refunds.
     */
    function expire(bytes32 splitId) external {
        Split storage s = splits[splitId];
        if (s.status == SplitStatus.None) revert SplitNotFound();
        if (block.timestamp < s.deadline) revert DeadlineNotPassed();
        _close(splitId, s);
    }

    /**
     * @notice Claim your own refund from a cancelled or expired split.
     */
    function claimRefund(bytes32 splitId) external nonReentrant {
        Split storage s = splits[splitId];
        if (s.status == SplitStatus.None) revert SplitNotFound();
        if (s.status != SplitStatus.Expired) revert SplitNotExpired();
        if (!s.paid[msg.sender] || s.refunded[msg.sender]) revert NothingToRefund();

        s.refunded[msg.sender] = true;
        uint256 amount = s.owed[msg.sender];
        USDC.safeTransfer(msg.sender, amount);

        emit Refunded(splitId, msg.sender, amount);
    }

    function _close(bytes32 splitId, Split storage s) private {
        if (s.status != SplitStatus.Open) revert SplitNotOpen();
        s.status = SplitStatus.Expired;
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

    function hasClaimedRefund(bytes32 splitId, address member) external view returns (bool) {
        return splits[splitId].refunded[member];
    }

    function getMembers(bytes32 splitId) external view returns (address[] memory) {
        return splits[splitId].members;
    }
}
