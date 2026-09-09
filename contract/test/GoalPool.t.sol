// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { GoalPool } from "../src/GoalPool.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";
import { BlocklistUSDC } from "./mocks/BlocklistUSDC.sol";

contract GoalPoolTest is Test {
    GoalPool pool;
    MockUSDC usdc;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address outsider = makeAddr("outsider");

    uint256 constant ONE_USDC = 1e6;
    uint256 constant EXIT_DELAY = 30 days;

    function setUp() public {
        usdc = new MockUSDC();
        pool = new GoalPool(address(usdc), EXIT_DELAY);

        address[3] memory members = [alice, bob, carol];
        for (uint256 i = 0; i < members.length; i++) {
            usdc.mint(members[i], 10_000 * ONE_USDC);
            vm.prank(members[i]);
            usdc.approve(address(pool), type(uint256).max);
        }
    }

    /// Approve with the recipient and amount the request actually carries.
    function _approve(address who, uint256 wid) internal {
        (, , address recipient, uint256 amount,,) = pool.getWithdrawal(wid);
        vm.prank(who);
        pool.approveWithdrawal(wid, recipient, amount);
    }

    function _createGoal() internal returns (bytes32) {
        address[] memory members = new address[](3);
        members[0] = alice;
        members[1] = bob;
        members[2] = carol;

        vm.prank(alice);
        return pool.createGoal(members, 10_000 * ONE_USDC, "Vacation Fund");
    }

    // ---- createGoal ----

    function test_createGoal_storesState() public {
        bytes32 id = _createGoal();

        (address creator, uint256 target, uint256 collected, GoalPool.GoalStatus status,, uint256 activeWithdrawal) =
            pool.getGoal(id);
        assertEq(creator, alice);
        assertEq(target, 10_000 * ONE_USDC);
        assertEq(collected, 0);
        assertEq(uint8(status), uint8(GoalPool.GoalStatus.Open));
        assertEq(activeWithdrawal, 0);
        assertTrue(pool.isMember(id, alice));
        assertTrue(pool.isMember(id, bob));
        assertFalse(pool.isMember(id, outsider));
    }

    function test_createGoal_revertsOnDuplicateMember() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = alice;

        vm.prank(alice);
        vm.expectRevert(GoalPool.DuplicateMember.selector);
        pool.createGoal(members, ONE_USDC, "x");
    }

    function test_createGoal_revertsOnNoMembers() public {
        vm.prank(alice);
        vm.expectRevert(GoalPool.NoMembers.selector);
        pool.createGoal(new address[](0), ONE_USDC, "x");
    }

    function test_createGoal_revertsOnZeroTarget() public {
        address[] memory members = new address[](1);
        members[0] = alice;
        vm.prank(alice);
        vm.expectRevert(GoalPool.ZeroAmount.selector);
        pool.createGoal(members, 0, "x");
    }

    // ---- contribute ----

    function test_contribute_anyAmountAccumulates() public {
        bytes32 id = _createGoal();

        vm.prank(alice);
        pool.contribute(id, 100 * ONE_USDC);
        vm.prank(bob);
        pool.contribute(id, 250 * ONE_USDC);
        vm.prank(alice);
        pool.contribute(id, 50 * ONE_USDC); // same member contributes again

        (,, uint256 collected,,,) = pool.getGoal(id);
        assertEq(collected, 400 * ONE_USDC);
        assertEq(pool.contributionOf(id, alice), 150 * ONE_USDC);
        assertEq(pool.contributionOf(id, bob), 250 * ONE_USDC);
        assertEq(usdc.balanceOf(pool.custodyOf(id)), 400 * ONE_USDC);
    }

    function test_contribute_canExceedTarget() public {
        address[] memory members = new address[](1);
        members[0] = alice;
        vm.startPrank(alice);
        bytes32 id = pool.createGoal(members, 10 * ONE_USDC, "small goal");
        pool.contribute(id, 999 * ONE_USDC);
        vm.stopPrank();

        (,, uint256 collected,,,) = pool.getGoal(id);
        assertEq(collected, 999 * ONE_USDC);
    }

    function test_contribute_revertsIfNotMember() public {
        bytes32 id = _createGoal();
        usdc.mint(outsider, ONE_USDC);
        vm.startPrank(outsider);
        usdc.approve(address(pool), type(uint256).max);
        vm.expectRevert(GoalPool.NotMember.selector);
        pool.contribute(id, ONE_USDC);
        vm.stopPrank();
    }

    function test_contribute_revertsOnZeroAmount() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        vm.expectRevert(GoalPool.ZeroAmount.selector);
        pool.contribute(id, 0);
    }

    function test_contribute_revertsIfGoalNotFound() public {
        vm.prank(alice);
        vm.expectRevert(GoalPool.GoalNotFound.selector);
        pool.contribute(bytes32(uint256(1)), ONE_USDC);
    }

    // ---- withdrawal: request + unanimous approval ----

    function test_withdrawal_requiresAllApprovals() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, 300 * ONE_USDC);

        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, alice);

        // requester auto-approved — 1 of 3 — not yet executed
        (,,,, GoalPool.WithdrawalStatus status, uint256 count) = pool.getWithdrawal(wid);
        assertEq(uint8(status), uint8(GoalPool.WithdrawalStatus.Pending));
        assertEq(count, 1);
        assertEq(usdc.balanceOf(alice), 10_000 * ONE_USDC - 300 * ONE_USDC); // not yet received

        _approve(bob, wid);
        (,,,, status, count) = pool.getWithdrawal(wid);
        assertEq(uint8(status), uint8(GoalPool.WithdrawalStatus.Pending));
        assertEq(count, 2);

        _approve(carol, wid); // final approval — auto-executes

        (,,,, status, count) = pool.getWithdrawal(wid);
        assertEq(uint8(status), uint8(GoalPool.WithdrawalStatus.Executed));
        assertEq(count, 3);
        assertEq(usdc.balanceOf(alice), 10_000 * ONE_USDC - 300 * ONE_USDC + 300 * ONE_USDC);
        assertEq(usdc.balanceOf(address(pool)), 0);

        (,, uint256 collected, GoalPool.GoalStatus gStatus,,) = pool.getGoal(id);
        assertEq(uint8(gStatus), uint8(GoalPool.GoalStatus.Withdrawn));
        assertEq(collected, 300 * ONE_USDC); // historical record retained
    }

    function test_withdrawal_singleMemberGoalAutoExecutes() public {
        address[] memory members = new address[](1);
        members[0] = alice;
        vm.startPrank(alice);
        bytes32 id = pool.createGoal(members, 10 * ONE_USDC, "solo");
        pool.contribute(id, 50 * ONE_USDC);
        uint256 wid = pool.requestWithdrawal(id, alice);
        vm.stopPrank();

        (,,,, GoalPool.WithdrawalStatus status,) = pool.getWithdrawal(wid);
        assertEq(uint8(status), uint8(GoalPool.WithdrawalStatus.Executed));
    }

    function test_withdrawal_toArbitraryRecipient() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, 300 * ONE_USDC);

        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, outsider);
        _approve(bob, wid);
        _approve(carol, wid);

        assertEq(usdc.balanceOf(outsider), 300 * ONE_USDC);
    }

    function test_withdrawal_revertsOnDoubleApproval() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, ONE_USDC);
        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, alice);

        (, , address recipient, uint256 amount,,) = pool.getWithdrawal(wid);
        vm.prank(alice);
        vm.expectRevert(GoalPool.WithdrawalAlreadyApproved.selector);
        pool.approveWithdrawal(wid, recipient, amount);
    }

    function test_withdrawal_revertsIfApproverNotMember() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, ONE_USDC);
        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, alice);

        (, , address recipient, uint256 amount,,) = pool.getWithdrawal(wid);
        vm.prank(outsider);
        vm.expectRevert(GoalPool.NotMember.selector);
        pool.approveWithdrawal(wid, recipient, amount);
    }

    function test_withdrawal_revertsIfAnotherPending() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, ONE_USDC);
        vm.prank(alice);
        pool.requestWithdrawal(id, alice);

        vm.prank(bob);
        vm.expectRevert(GoalPool.AnotherWithdrawalPending.selector);
        pool.requestWithdrawal(id, bob);
    }

    function test_withdrawal_revertsIfNothingCollected() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        vm.expectRevert(GoalPool.InsufficientPooled.selector);
        pool.requestWithdrawal(id, alice);
    }

    function test_withdrawal_cancelFreesUpNewRequest() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, ONE_USDC);

        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, alice);

        vm.prank(bob);
        vm.expectRevert(GoalPool.NotRequester.selector);
        pool.cancelWithdrawalRequest(wid);

        vm.prank(alice);
        pool.cancelWithdrawalRequest(wid);

        (,,,, GoalPool.WithdrawalStatus status,) = pool.getWithdrawal(wid);
        assertEq(uint8(status), uint8(GoalPool.WithdrawalStatus.Cancelled));

        // goal is free for a new request now
        vm.prank(bob);
        uint256 wid2 = pool.requestWithdrawal(id, bob);
        assertTrue(wid2 != wid);
    }

    function test_contribute_revertsAfterWithdrawn() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, ONE_USDC);
        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, alice);
        _approve(bob, wid);
        _approve(carol, wid);

        vm.prank(bob);
        vm.expectRevert(GoalPool.GoalNotOpen.selector);
        pool.contribute(id, ONE_USDC);
    }

    // ---- constructor ----

    function test_constructor_revertsOnZeroUsdc() public {
        vm.expectRevert(GoalPool.ZeroAddress.selector);
        new GoalPool(address(0), EXIT_DELAY);
    }

    function test_constructor_revertsOnShortExitDelay() public {
        vm.expectRevert(GoalPool.ExitDelayTooShort.selector);
        new GoalPool(address(usdc), 1 days - 1);
    }

    // ---- GP-1: contributions during a pending withdrawal ----

    function test_contribute_revertsWhileWithdrawalPending() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, 100 * ONE_USDC);
        vm.prank(alice);
        pool.requestWithdrawal(id, alice);

        vm.prank(bob);
        vm.expectRevert(GoalPool.WithdrawalPending.selector);
        pool.contribute(id, 50 * ONE_USDC);
    }

    function test_contribute_resumesAfterRequestCancelled() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, 100 * ONE_USDC);
        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, alice);
        vm.prank(alice);
        pool.cancelWithdrawalRequest(wid);

        vm.prank(bob);
        pool.contribute(id, 50 * ONE_USDC);
        (,, uint256 collected,,,) = pool.getGoal(id);
        assertEq(collected, 150 * ONE_USDC);
    }

    function test_withdrawal_leavesNothingBehind() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, 100 * ONE_USDC);

        // a request, a cancel, a top-up, then the request that completes
        vm.prank(alice);
        uint256 first = pool.requestWithdrawal(id, alice);
        vm.prank(alice);
        pool.cancelWithdrawalRequest(first);
        vm.prank(bob);
        pool.contribute(id, 50 * ONE_USDC);

        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, alice);
        _approve(bob, wid);
        _approve(carol, wid);

        assertEq(usdc.balanceOf(address(pool)), 0);
        assertEq(usdc.balanceOf(alice), 10_000 * ONE_USDC - 100 * ONE_USDC + 150 * ONE_USDC);
    }

    // ---- GP-3: approval binds recipient and amount ----

    function test_approve_revertsOnRecipientMismatch() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, 200 * ONE_USDC);
        vm.prank(carol);
        uint256 wid = pool.requestWithdrawal(id, outsider); // carol pays herself out to an outside address

        // Bob believes this request pays alice.
        vm.prank(bob);
        vm.expectRevert(GoalPool.WithdrawalMismatch.selector);
        pool.approveWithdrawal(wid, alice, 200 * ONE_USDC);
    }

    function test_approve_revertsOnAmountMismatch() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, 200 * ONE_USDC);
        vm.prank(carol);
        uint256 wid = pool.requestWithdrawal(id, alice);

        vm.prank(bob);
        vm.expectRevert(GoalPool.WithdrawalMismatch.selector);
        pool.approveWithdrawal(wid, alice, 199 * ONE_USDC);
    }

    function test_approve_mismatchDoesNotRecordApproval() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, 200 * ONE_USDC);
        vm.prank(carol);
        uint256 wid = pool.requestWithdrawal(id, outsider);

        vm.prank(bob);
        vm.expectRevert(GoalPool.WithdrawalMismatch.selector);
        pool.approveWithdrawal(wid, alice, 200 * ONE_USDC);

        assertFalse(pool.hasApprovedWithdrawal(wid, bob));
        (,,,,, uint256 count) = pool.getWithdrawal(wid);
        assertEq(count, 1);
    }

    // ---- GP-2: time-locked exit ----

    function _contributeAll() internal returns (bytes32 id) {
        id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, 300 * ONE_USDC);
        vm.prank(bob);
        pool.contribute(id, 100 * ONE_USDC);
        // carol contributes nothing
    }

    function test_exit_startRequiresMemberAndOpenGoal() public {
        bytes32 id = _createGoal();
        vm.prank(outsider);
        vm.expectRevert(GoalPool.NotMember.selector);
        pool.startExit(id);

        vm.expectRevert(GoalPool.GoalNotFound.selector);
        pool.startExit(bytes32(uint256(1)));
    }

    function test_exit_recordsCountdown() public {
        bytes32 id = _createGoal();
        vm.prank(bob);
        pool.startExit(id);
        (uint256 exitAt, address initiator) = pool.exitOf(id);
        assertEq(exitAt, block.timestamp + EXIT_DELAY);
        assertEq(initiator, bob);
    }

    function test_exit_dissolveClearsCountdown() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.startExit(id);
        vm.warp(block.timestamp + EXIT_DELAY);
        vm.prank(alice);
        pool.dissolve(id);

        (uint256 exitAt, address initiator) = pool.exitOf(id);
        assertEq(exitAt, 0);
        assertEq(initiator, address(0));
    }

    function test_withdrawal_executeClearsCountdown() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, 100 * ONE_USDC);

        vm.prank(bob);
        pool.startExit(id);

        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, outsider);
        _approve(bob, wid);
        _approve(carol, wid);

        (uint256 exitAt, address initiator) = pool.exitOf(id);
        assertEq(exitAt, 0);
        assertEq(initiator, address(0));
    }

    function test_exit_cannotStartTwice() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.startExit(id);
        vm.prank(bob);
        vm.expectRevert(GoalPool.ExitAlreadyStarted.selector);
        pool.startExit(id);
    }

    function test_exit_dissolveRevertsBeforeDelayAndWithoutStart() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        vm.expectRevert(GoalPool.ExitNotStarted.selector);
        pool.dissolve(id);

        vm.prank(alice);
        pool.startExit(id);
        vm.warp(block.timestamp + EXIT_DELAY - 1);
        vm.prank(alice);
        vm.expectRevert(GoalPool.ExitDelayNotElapsed.selector);
        pool.dissolve(id);
    }

    function test_exit_dissolveRequiresMember() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.startExit(id);
        vm.warp(block.timestamp + EXIT_DELAY);
        vm.prank(outsider);
        vm.expectRevert(GoalPool.NotMember.selector);
        pool.dissolve(id);
    }

    function test_exit_everyoneClaimsExactlyTheirOwnContribution() public {
        bytes32 id = _contributeAll();
        vm.prank(carol); // a member who contributed nothing can still start the exit
        pool.startExit(id);
        vm.warp(block.timestamp + EXIT_DELAY);
        vm.prank(bob);
        pool.dissolve(id);

        (,,, GoalPool.GoalStatus status,,) = pool.getGoal(id);
        assertEq(uint8(status), uint8(GoalPool.GoalStatus.Cancelled));

        vm.prank(alice);
        pool.claimRefund(id);
        vm.prank(bob);
        pool.claimRefund(id);

        assertEq(usdc.balanceOf(alice), 10_000 * ONE_USDC);
        assertEq(usdc.balanceOf(bob), 10_000 * ONE_USDC);
        assertEq(usdc.balanceOf(address(pool)), 0);
        assertEq(pool.contributionOf(id, alice), 0);
    }

    /// The GP-2 scenario: Carol is gone. Alice and Bob get their money back.
    function test_exit_absentMemberCannotFreezeTheOthers() public {
        bytes32 id = _contributeAll();
        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, alice);
        _approve(bob, wid); // 2 of 3; Carol never answers

        vm.prank(alice);
        pool.startExit(id);
        vm.warp(block.timestamp + EXIT_DELAY);
        vm.prank(bob);
        pool.dissolve(id);

        vm.prank(alice);
        pool.claimRefund(id);
        vm.prank(bob);
        pool.claimRefund(id);
        assertEq(usdc.balanceOf(address(pool)), 0);
    }

    function test_exit_dissolveCancelsPendingWithdrawal() public {
        bytes32 id = _contributeAll();
        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, alice);
        vm.prank(alice);
        pool.startExit(id);
        vm.warp(block.timestamp + EXIT_DELAY);
        vm.prank(alice);
        pool.dissolve(id);

        (,,,, GoalPool.WithdrawalStatus wStatus,) = pool.getWithdrawal(wid);
        assertEq(uint8(wStatus), uint8(GoalPool.WithdrawalStatus.Cancelled));
        (,,,,, uint256 active) = pool.getGoal(id);
        assertEq(active, 0);

        // the cancelled request can no longer be approved
        vm.prank(bob);
        vm.expectRevert(GoalPool.WithdrawalNotPending.selector);
        pool.approveWithdrawal(wid, alice, 400 * ONE_USDC);
    }

    function test_exit_unanimousWithdrawalStillWinsBeforeDissolve() public {
        bytes32 id = _contributeAll();
        vm.prank(alice);
        pool.startExit(id);

        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, alice);
        _approve(bob, wid);
        _approve(carol, wid); // executes, goal becomes Withdrawn

        vm.warp(block.timestamp + EXIT_DELAY);
        vm.prank(alice);
        vm.expectRevert(GoalPool.GoalNotOpen.selector);
        pool.dissolve(id);
    }

    function test_exit_cancelOnlyByInitiatorAndStopsDissolve() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        vm.expectRevert(GoalPool.ExitNotStarted.selector);
        pool.cancelExit(id);

        vm.prank(alice);
        pool.startExit(id);
        vm.prank(bob);
        vm.expectRevert(GoalPool.NotExitInitiator.selector);
        pool.cancelExit(id);

        vm.prank(alice);
        pool.cancelExit(id);
        (uint256 exitAt, address initiator) = pool.exitOf(id);
        assertEq(exitAt, 0);
        assertEq(initiator, address(0));

        vm.warp(block.timestamp + EXIT_DELAY);
        vm.prank(alice);
        vm.expectRevert(GoalPool.ExitNotStarted.selector);
        pool.dissolve(id);

        // and a fresh countdown can be started afterwards
        vm.prank(bob);
        pool.startExit(id);
    }

    function test_exit_claimRefundGuards() public {
        bytes32 id = _contributeAll();

        // not dissolved yet
        vm.prank(alice);
        vm.expectRevert(GoalPool.GoalNotCancelled.selector);
        pool.claimRefund(id);

        vm.prank(alice);
        pool.startExit(id);
        vm.warp(block.timestamp + EXIT_DELAY);
        vm.prank(alice);
        pool.dissolve(id);

        vm.prank(alice);
        pool.claimRefund(id);
        vm.prank(alice);
        vm.expectRevert(GoalPool.NothingToRefund.selector); // no double claim
        pool.claimRefund(id);
        vm.prank(carol);
        vm.expectRevert(GoalPool.NothingToRefund.selector); // contributed nothing
        pool.claimRefund(id);
        vm.prank(outsider);
        vm.expectRevert(GoalPool.NothingToRefund.selector);
        pool.claimRefund(id);

        vm.expectRevert(GoalPool.GoalNotFound.selector);
        pool.claimRefund(bytes32(uint256(1)));
    }

    function test_exit_cannotContributeToDissolvedGoal() public {
        bytes32 id = _contributeAll();
        vm.prank(alice);
        pool.startExit(id);
        vm.warp(block.timestamp + EXIT_DELAY);
        vm.prank(alice);
        pool.dissolve(id);

        vm.prank(bob);
        vm.expectRevert(GoalPool.GoalNotOpen.selector);
        pool.contribute(id, ONE_USDC);
    }

    function test_exit_goalsAreIndependent() public {
        bytes32 a = _contributeAll();
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        vm.prank(alice);
        bytes32 b = pool.createGoal(members, ONE_USDC, "Other");
        vm.prank(alice);
        pool.contribute(b, 25 * ONE_USDC);

        vm.prank(alice);
        pool.startExit(a);
        vm.warp(block.timestamp + EXIT_DELAY);
        vm.prank(alice);
        pool.dissolve(a);
        vm.prank(alice);
        pool.claimRefund(a);

        assertEq(usdc.balanceOf(pool.custodyOf(a)), 100 * ONE_USDC); // bob's 100 in A
        assertEq(usdc.balanceOf(pool.custodyOf(b)), 25 * ONE_USDC); // alice's 25 in B
        assertEq(pool.contributionOf(b, alice), 25 * ONE_USDC);
    }

    function testFuzz_exit_refundsMatchContributions(uint96 x, uint96 y, uint96 z) public {
        uint256 a = bound(x, 0, 1_000 * ONE_USDC);
        uint256 b = bound(y, 0, 1_000 * ONE_USDC);
        uint256 c = bound(z, 0, 1_000 * ONE_USDC);
        bytes32 id = _createGoal();
        if (a > 0) { vm.prank(alice); pool.contribute(id, a); }
        if (b > 0) { vm.prank(bob); pool.contribute(id, b); }
        if (c > 0) { vm.prank(carol); pool.contribute(id, c); }

        vm.prank(bob);
        pool.startExit(id);
        vm.warp(block.timestamp + EXIT_DELAY);
        vm.prank(carol);
        pool.dissolve(id);

        address[3] memory who = [alice, bob, carol];
        uint256[3] memory amt = [a, b, c];
        for (uint256 i = 0; i < 3; i++) {
            if (amt[i] == 0) continue;
            vm.prank(who[i]);
            pool.claimRefund(id);
        }
        assertEq(usdc.balanceOf(address(pool)), 0);
        assertEq(usdc.balanceOf(alice), 10_000 * ONE_USDC);
        assertEq(usdc.balanceOf(bob), 10_000 * ONE_USDC);
        assertEq(usdc.balanceOf(carol), 10_000 * ONE_USDC);
    }
}

/// A blocklisted member can be refunded by no one, but must not stop anyone else's refund.
contract GoalPoolBlocklistTest is Test {
    BlocklistUSDC usdc;
    GoalPool pool;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    uint256 constant ONE_USDC = 1e6;
    uint256 constant EXIT_DELAY = 30 days;

    function test_blocklistedMemberDoesNotTrapOthersRefunds() public {
        usdc = new BlocklistUSDC();
        pool = new GoalPool(address(usdc), EXIT_DELAY);

        address[] memory members = new address[](3);
        members[0] = alice;
        members[1] = bob;
        members[2] = carol;
        for (uint256 i = 0; i < 3; i++) {
            usdc.mint(members[i], 100 * ONE_USDC);
            vm.prank(members[i]);
            usdc.approve(address(pool), type(uint256).max);
        }
        vm.prank(alice);
        bytes32 id = pool.createGoal(members, 100 * ONE_USDC, "Trip");
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(members[i]);
            pool.contribute(id, 20 * ONE_USDC);
        }

        usdc.setBlocked(bob, true); // blocklisted after contributing

        vm.prank(alice);
        pool.startExit(id);
        vm.warp(block.timestamp + EXIT_DELAY);
        vm.prank(carol);
        pool.dissolve(id);

        vm.prank(alice);
        pool.claimRefund(id);
        vm.prank(carol);
        pool.claimRefund(id);
        vm.prank(bob);
        vm.expectRevert(bytes("blocked"));
        pool.claimRefund(id); // only Bob is affected

        assertEq(usdc.balanceOf(alice), 100 * ONE_USDC);
        assertEq(usdc.balanceOf(carol), 100 * ONE_USDC);
        assertEq(usdc.balanceOf(pool.custodyOf(id)), 20 * ONE_USDC); // Bob's share, waiting for him
    }
}
