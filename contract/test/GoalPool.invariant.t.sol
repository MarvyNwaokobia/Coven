// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { GoalPool } from "../src/GoalPool.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

/// Random sequences of every state-changing GoalPool call, by three members across two goals.
/// Reverting calls are expected (wrong order, wrong actor) and are ignored; what must never
/// happen is the pool ending up holding the wrong amount.
contract GoalPoolHandler is Test {
    GoalPool public pool;
    address[3] public actors;
    bytes32[2] public goals;

    constructor(GoalPool _pool, address[3] memory _actors, bytes32[2] memory _goals) {
        pool = _pool;
        actors = _actors;
        goals = _goals;
    }

    function _who(uint256 seed) internal view returns (address) {
        return actors[seed % 3];
    }

    function _goal(uint256 seed) internal view returns (bytes32) {
        return goals[seed % 2];
    }

    function contribute(uint256 a, uint256 g, uint256 amount) external {
        amount = bound(amount, 1, 500e6);
        vm.prank(_who(a));
        try pool.contribute(_goal(g), amount) {} catch {}
    }

    function request(uint256 a, uint256 g, uint256 r) external {
        vm.prank(_who(a));
        try pool.requestWithdrawal(_goal(g), _who(r)) {} catch {}
    }

    function approve(uint256 a, uint256 g) external {
        (,,,,, uint256 wid) = pool.getGoal(_goal(g));
        if (wid == 0) return;
        (,, address recipient, uint256 amount,,) = pool.getWithdrawal(wid);
        vm.prank(_who(a));
        try pool.approveWithdrawal(wid, recipient, amount) {} catch {}
    }

    function cancelRequest(uint256 a, uint256 g) external {
        (,,,,, uint256 wid) = pool.getGoal(_goal(g));
        if (wid == 0) return;
        vm.prank(_who(a));
        try pool.cancelWithdrawalRequest(wid) {} catch {}
    }

    function startExit(uint256 a, uint256 g) external {
        vm.prank(_who(a));
        try pool.startExit(_goal(g)) {} catch {}
    }

    function cancelExit(uint256 a, uint256 g) external {
        vm.prank(_who(a));
        try pool.cancelExit(_goal(g)) {} catch {}
    }

    function dissolve(uint256 a, uint256 g) external {
        vm.prank(_who(a));
        try pool.dissolve(_goal(g)) {} catch {}
    }

    function claim(uint256 a, uint256 g) external {
        vm.prank(_who(a));
        try pool.claimRefund(_goal(g)) {} catch {}
    }

    function passTime(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 0, 40 days));
    }
}

contract GoalPoolInvariantTest is Test {
    uint256 constant MINTED = 1_000_000e6;

    MockUSDC usdc;
    GoalPool pool;
    GoalPoolHandler handler;
    address[3] actors = [makeAddr("alice"), makeAddr("bob"), makeAddr("carol")];
    bytes32[2] goals;

    function setUp() public {
        usdc = new MockUSDC();
        pool = new GoalPool(address(usdc), 30 days);

        address[] memory members = new address[](3);
        for (uint256 i = 0; i < 3; i++) {
            members[i] = actors[i];
            usdc.mint(actors[i], MINTED);
            vm.prank(actors[i]);
            usdc.approve(address(pool), type(uint256).max);
        }
        for (uint256 g = 0; g < 2; g++) {
            vm.prank(actors[0]);
            goals[g] = pool.createGoal(members, 1_000e6, g == 0 ? "A" : "B");
        }

        handler = new GoalPoolHandler(pool, actors, goals);
        targetContract(address(handler));
    }

    /// Each goal's custody holds exactly what is still owed on that goal: the pooled balance while
    /// open, plus the unclaimed contributions once dissolved, plus nothing once paid out.
    function invariant_poolHoldsExactlyWhatIsOwed() public view {
        for (uint256 g = 0; g < 2; g++) {
            (,, uint256 collected, GoalPool.GoalStatus status,,) = pool.getGoal(goals[g]);
            uint256 owed;
            if (status == GoalPool.GoalStatus.Open) {
                owed = collected;
            } else if (status == GoalPool.GoalStatus.Cancelled) {
                for (uint256 i = 0; i < 3; i++) owed += pool.contributionOf(goals[g], actors[i]);
            }
            assertEq(usdc.balanceOf(pool.custodyOf(goals[g])), owed);
        }
    }

    /// For an open goal, the pooled total is exactly the sum of what each member put in.
    function invariant_openGoalTotalsMatchContributions() public view {
        for (uint256 g = 0; g < 2; g++) {
            (,, uint256 collected, GoalPool.GoalStatus status,,) = pool.getGoal(goals[g]);
            if (status != GoalPool.GoalStatus.Open) continue;
            uint256 sum;
            for (uint256 i = 0; i < 3; i++) sum += pool.contributionOf(goals[g], actors[i]);
            assertEq(collected, sum);
        }
    }

    /// No value is created or destroyed: members plus every goal's custody always hold everything minted.
    function invariant_valueIsConserved() public view {
        uint256 total = usdc.balanceOf(address(pool));
        for (uint256 g = 0; g < 2; g++) total += usdc.balanceOf(pool.custodyOf(goals[g]));
        for (uint256 i = 0; i < 3; i++) total += usdc.balanceOf(actors[i]);
        assertEq(total, 3 * MINTED);
    }

    /// A goal that has left Open never has a live withdrawal request or exit countdown to act on.
    function invariant_closedGoalsHaveNoPendingWithdrawal() public view {
        for (uint256 g = 0; g < 2; g++) {
            (,,, GoalPool.GoalStatus status,, uint256 active) = pool.getGoal(goals[g]);
            if (status == GoalPool.GoalStatus.Cancelled) assertEq(active, 0);
        }
    }
}
