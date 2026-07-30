// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { GoalPool } from "../src/GoalPool.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

contract GoalPoolTest is Test {
    GoalPool pool;
    MockUSDC usdc;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address outsider = makeAddr("outsider");

    uint256 constant ONE_USDC = 1e6;

    function setUp() public {
        usdc = new MockUSDC();
        pool = new GoalPool(address(usdc));

        address[3] memory members = [alice, bob, carol];
        for (uint256 i = 0; i < members.length; i++) {
            usdc.mint(members[i], 10_000 * ONE_USDC);
            vm.prank(members[i]);
            usdc.approve(address(pool), type(uint256).max);
        }
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
        assertEq(usdc.balanceOf(address(pool)), 400 * ONE_USDC);
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

        vm.prank(bob);
        pool.approveWithdrawal(wid);
        (,,,, status, count) = pool.getWithdrawal(wid);
        assertEq(uint8(status), uint8(GoalPool.WithdrawalStatus.Pending));
        assertEq(count, 2);

        vm.prank(carol);
        pool.approveWithdrawal(wid); // final approval — auto-executes

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
        vm.prank(bob);
        pool.approveWithdrawal(wid);
        vm.prank(carol);
        pool.approveWithdrawal(wid);

        assertEq(usdc.balanceOf(outsider), 300 * ONE_USDC);
    }

    function test_withdrawal_revertsOnDoubleApproval() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, ONE_USDC);
        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, alice);

        vm.prank(alice);
        vm.expectRevert(GoalPool.WithdrawalAlreadyApproved.selector);
        pool.approveWithdrawal(wid);
    }

    function test_withdrawal_revertsIfApproverNotMember() public {
        bytes32 id = _createGoal();
        vm.prank(alice);
        pool.contribute(id, ONE_USDC);
        vm.prank(alice);
        uint256 wid = pool.requestWithdrawal(id, alice);

        vm.prank(outsider);
        vm.expectRevert(GoalPool.NotMember.selector);
        pool.approveWithdrawal(wid);
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
        vm.prank(bob);
        pool.approveWithdrawal(wid);
        vm.prank(carol);
        pool.approveWithdrawal(wid);

        vm.prank(bob);
        vm.expectRevert(GoalPool.GoalNotOpen.selector);
        pool.contribute(id, ONE_USDC);
    }
}
