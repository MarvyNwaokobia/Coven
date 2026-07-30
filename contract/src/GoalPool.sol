// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GoalPool
 * @notice Group savings pool for a Circle. Unlike SplitEscrow (fixed
 *         per-member shares, auto-release to one recipient once the total
 *         is collected), a GoalPool takes ANY amount from ANY member toward
 *         a shared target, and releasing the pooled funds requires every
 *         member to approve a specific withdrawal request — a unanimous,
 *         multisig-style sign-off rather than an automatic release.
 */
contract GoalPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable USDC;

    enum GoalStatus {
        None,
        Open,
        Withdrawn,
        Cancelled
    }

    enum WithdrawalStatus {
        None,
        Pending,
        Executed,
        Cancelled
    }

    struct Goal {
        address creator;
        uint256 targetAmount;
        uint256 collected;
        GoalStatus status;
        string description;
        address[] members;
        mapping(address => bool) isMember;
        mapping(address => uint256) contributed;
        uint256 activeWithdrawalId; // 0 if none pending
    }

    struct Withdrawal {
        bytes32 goalId;
        address requester;
        address recipient;
        uint256 amount;
        WithdrawalStatus status;
        uint256 approvalCount;
        mapping(address => bool) approved;
    }

    mapping(bytes32 => Goal) private goals;
    mapping(uint256 => Withdrawal) private withdrawals;
    uint256 private _nonce;
    uint256 private _withdrawalNonce;

    event GoalCreated(
        bytes32 indexed goalId, address indexed creator, uint256 targetAmount, string description
    );
    event Contributed(bytes32 indexed goalId, address indexed member, uint256 amount, uint256 totalCollected);
    event WithdrawalRequested(
        uint256 indexed withdrawalId, bytes32 indexed goalId, address indexed requester, address recipient, uint256 amount
    );
    event WithdrawalApproved(uint256 indexed withdrawalId, address indexed member, uint256 approvalCount, uint256 requiredCount);
    event WithdrawalExecuted(uint256 indexed withdrawalId, bytes32 indexed goalId, address recipient, uint256 amount);
    event WithdrawalCancelled(uint256 indexed withdrawalId, bytes32 indexed goalId);
    event GoalCancelled(bytes32 indexed goalId);

    error GoalNotFound();
    error GoalNotOpen();
    error NotMember();
    error NoMembers();
    error DuplicateMember();
    error ZeroAmount();
    error ZeroAddress();
    error WithdrawalNotFound();
    error WithdrawalNotPending();
    error WithdrawalAlreadyApproved();
    error AnotherWithdrawalPending();
    error InsufficientPooled();
    error NotRequester();

    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        USDC = IERC20(_usdc);
    }

    /**
     * @notice Create a savings goal for a set of Circle members.
     * @param members      Everyone allowed to contribute and required to
     *                     approve a withdrawal (the creator should be
     *                     included if they're also a contributor).
     * @param targetAmount Informational target — contributions are not
     *                     capped at this amount and can continue past it.
     * @param description  Human-readable description ("Vacation Fund").
     */
    function createGoal(address[] calldata members, uint256 targetAmount, string calldata description)
        external
        returns (bytes32 goalId)
    {
        if (members.length == 0) revert NoMembers();
        if (targetAmount == 0) revert ZeroAmount();

        goalId = keccak256(abi.encodePacked(msg.sender, block.timestamp, description, _nonce++));

        Goal storage g = goals[goalId];
        g.creator = msg.sender;
        g.targetAmount = targetAmount;
        g.status = GoalStatus.Open;
        g.description = description;
        g.members = members;

        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == address(0)) revert ZeroAddress();
            if (g.isMember[members[i]]) revert DuplicateMember();
            g.isMember[members[i]] = true;
        }

        emit GoalCreated(goalId, msg.sender, targetAmount, description);
    }

    /**
     * @notice Contribute any amount toward a goal. Members may contribute
     *         multiple times, and the pool may exceed its target.
     */
    function contribute(bytes32 goalId, uint256 amount) external nonReentrant {
        Goal storage g = goals[goalId];
        if (g.status == GoalStatus.None) revert GoalNotFound();
        if (g.status != GoalStatus.Open) revert GoalNotOpen();
        if (!g.isMember[msg.sender]) revert NotMember();
        if (amount == 0) revert ZeroAmount();

        g.contributed[msg.sender] += amount;
        g.collected += amount;

        USDC.safeTransferFrom(msg.sender, address(this), amount);
        emit Contributed(goalId, msg.sender, amount, g.collected);
    }

    /**
     * @notice Request to withdraw the full pooled balance to a recipient.
     *         Auto-approves on behalf of the requester; every other member
     *         must call approveWithdrawal before funds move. Only one
     *         withdrawal request may be pending per goal at a time.
     */
    function requestWithdrawal(bytes32 goalId, address recipient) external nonReentrant returns (uint256 withdrawalId) {
        Goal storage g = goals[goalId];
        if (g.status == GoalStatus.None) revert GoalNotFound();
        if (g.status != GoalStatus.Open) revert GoalNotOpen();
        if (!g.isMember[msg.sender]) revert NotMember();
        if (recipient == address(0)) revert ZeroAddress();
        if (g.collected == 0) revert InsufficientPooled();
        if (g.activeWithdrawalId != 0) revert AnotherWithdrawalPending();

        withdrawalId = ++_withdrawalNonce;
        Withdrawal storage w = withdrawals[withdrawalId];
        w.goalId = goalId;
        w.requester = msg.sender;
        w.recipient = recipient;
        w.amount = g.collected;
        w.status = WithdrawalStatus.Pending;
        w.approved[msg.sender] = true;
        w.approvalCount = 1;

        g.activeWithdrawalId = withdrawalId;

        emit WithdrawalRequested(withdrawalId, goalId, msg.sender, recipient, w.amount);
        emit WithdrawalApproved(withdrawalId, msg.sender, 1, g.members.length);

        if (w.approvalCount == g.members.length) {
            _execute(withdrawalId, g, w);
        }
    }

    /**
     * @notice Approve a pending withdrawal request. Once every member has
     *         approved, the pooled funds release automatically.
     */
    function approveWithdrawal(uint256 withdrawalId) external nonReentrant {
        Withdrawal storage w = withdrawals[withdrawalId];
        if (w.status == WithdrawalStatus.None) revert WithdrawalNotFound();
        if (w.status != WithdrawalStatus.Pending) revert WithdrawalNotPending();

        Goal storage g = goals[w.goalId];
        if (!g.isMember[msg.sender]) revert NotMember();
        if (w.approved[msg.sender]) revert WithdrawalAlreadyApproved();

        w.approved[msg.sender] = true;
        w.approvalCount += 1;

        emit WithdrawalApproved(withdrawalId, msg.sender, w.approvalCount, g.members.length);

        if (w.approvalCount == g.members.length) {
            _execute(withdrawalId, g, w);
        }
    }

    /**
     * @notice The requester can cancel their own pending withdrawal request,
     *         freeing the goal up for a new request (e.g. to a different
     *         recipient).
     */
    function cancelWithdrawalRequest(uint256 withdrawalId) external {
        Withdrawal storage w = withdrawals[withdrawalId];
        if (w.status == WithdrawalStatus.None) revert WithdrawalNotFound();
        if (w.status != WithdrawalStatus.Pending) revert WithdrawalNotPending();
        if (w.requester != msg.sender) revert NotRequester();

        w.status = WithdrawalStatus.Cancelled;
        goals[w.goalId].activeWithdrawalId = 0;

        emit WithdrawalCancelled(withdrawalId, w.goalId);
    }

    function _execute(uint256 withdrawalId, Goal storage g, Withdrawal storage w) private {
        w.status = WithdrawalStatus.Executed;
        g.status = GoalStatus.Withdrawn;
        g.activeWithdrawalId = 0;

        USDC.safeTransfer(w.recipient, w.amount);
        emit WithdrawalExecuted(withdrawalId, w.goalId, w.recipient, w.amount);
    }

    // View helpers
    function getGoal(bytes32 goalId)
        external
        view
        returns (
            address creator,
            uint256 targetAmount,
            uint256 collected,
            GoalStatus status,
            string memory description,
            uint256 activeWithdrawalId
        )
    {
        Goal storage g = goals[goalId];
        return (g.creator, g.targetAmount, g.collected, g.status, g.description, g.activeWithdrawalId);
    }

    function getMembers(bytes32 goalId) external view returns (address[] memory) {
        return goals[goalId].members;
    }

    function isMember(bytes32 goalId, address account) external view returns (bool) {
        return goals[goalId].isMember[account];
    }

    function contributionOf(bytes32 goalId, address account) external view returns (uint256) {
        return goals[goalId].contributed[account];
    }

    function getWithdrawal(uint256 withdrawalId)
        external
        view
        returns (
            bytes32 goalId,
            address requester,
            address recipient,
            uint256 amount,
            WithdrawalStatus status,
            uint256 approvalCount
        )
    {
        Withdrawal storage w = withdrawals[withdrawalId];
        return (w.goalId, w.requester, w.recipient, w.amount, w.status, w.approvalCount);
    }

    function hasApprovedWithdrawal(uint256 withdrawalId, address account) external view returns (bool) {
        return withdrawals[withdrawalId].approved[account];
    }
}
