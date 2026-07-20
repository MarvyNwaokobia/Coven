// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { SplitEscrow } from "../src/SplitEscrow.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

contract SplitEscrowTest is Test {
    SplitEscrow escrow;
    MockUSDC usdc;

    address creator = makeAddr("creator");
    address recipient = makeAddr("recipient");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 constant ONE_USDC = 1e6;

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new SplitEscrow(address(usdc));

        address[3] memory members = [alice, bob, carol];
        for (uint256 i = 0; i < members.length; i++) {
            usdc.mint(members[i], 1_000 * ONE_USDC);
            vm.prank(members[i]);
            usdc.approve(address(escrow), type(uint256).max);
        }
    }

    function _createSplit() internal returns (bytes32) {
        address[] memory members = new address[](3);
        members[0] = alice;
        members[1] = bob;
        members[2] = carol;
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 20 * ONE_USDC;
        amounts[1] = 20 * ONE_USDC;
        amounts[2] = 20 * ONE_USDC;

        vm.prank(creator);
        return escrow.createSplit(members, amounts, recipient, "Dinner at Nkoyo", 48);
    }

    // ---- createSplit ----

    function test_createSplit_storesState() public {
        bytes32 id = _createSplit();

        (address c, address r, uint256 total, uint256 collected, uint256 deadline, SplitEscrow.SplitStatus status,) =
            escrow.getSplit(id);
        assertEq(c, creator);
        assertEq(r, recipient);
        assertEq(total, 60 * ONE_USDC);
        assertEq(collected, 0);
        assertEq(deadline, block.timestamp + 48 hours);
        assertEq(uint8(status), uint8(SplitEscrow.SplitStatus.Open));
        assertEq(escrow.getMemberOwed(id, alice), 20 * ONE_USDC);
        assertEq(escrow.getMembers(id).length, 3);
    }

    function test_createSplit_revertsOnDuplicateMember() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = alice;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = ONE_USDC;
        amounts[1] = ONE_USDC;

        vm.prank(creator);
        vm.expectRevert(SplitEscrow.DuplicateMember.selector);
        escrow.createSplit(members, amounts, recipient, "", 24);
    }

    function test_createSplit_revertsOnNoMembers() public {
        vm.prank(creator);
        vm.expectRevert(SplitEscrow.NoMembers.selector);
        escrow.createSplit(new address[](0), new uint256[](0), recipient, "", 24);
    }

    function test_createSplit_uniqueIds() public {
        bytes32 id1 = _createSplit();
        bytes32 id2 = _createSplit();
        assertTrue(id1 != id2);
    }

    // ---- pay ----

    function test_pay_collectsShare() public {
        bytes32 id = _createSplit();

        vm.prank(alice);
        escrow.pay(id);

        (,,, uint256 collected,,,) = escrow.getSplit(id);
        assertEq(collected, 20 * ONE_USDC);
        assertTrue(escrow.hasMemberPaid(id, alice));
        assertEq(usdc.balanceOf(address(escrow)), 20 * ONE_USDC);
    }

    function test_pay_autoReleasesWhenComplete() public {
        bytes32 id = _createSplit();

        vm.prank(alice);
        escrow.pay(id);
        vm.prank(bob);
        escrow.pay(id);
        vm.prank(carol);
        escrow.pay(id);

        (,,,,, SplitEscrow.SplitStatus status,) = escrow.getSplit(id);
        assertEq(uint8(status), uint8(SplitEscrow.SplitStatus.Complete));
        assertEq(usdc.balanceOf(recipient), 60 * ONE_USDC);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_pay_revertsIfAlreadyPaid() public {
        bytes32 id = _createSplit();
        vm.startPrank(alice);
        escrow.pay(id);
        vm.expectRevert(SplitEscrow.AlreadyPaid.selector);
        escrow.pay(id);
        vm.stopPrank();
    }

    function test_pay_revertsIfNotMember() public {
        bytes32 id = _createSplit();
        vm.prank(recipient);
        vm.expectRevert(SplitEscrow.NotMember.selector);
        escrow.pay(id);
    }

    function test_pay_revertsIfNotFound() public {
        vm.prank(alice);
        vm.expectRevert(SplitEscrow.SplitNotFound.selector);
        escrow.pay(bytes32(uint256(1)));
    }

    function test_pay_revertsIfComplete() public {
        bytes32 id = _createSplit();
        vm.prank(alice);
        escrow.pay(id);
        vm.prank(bob);
        escrow.pay(id);
        vm.prank(carol);
        escrow.pay(id);

        // A member of a completed split cannot pay again
        vm.prank(alice);
        vm.expectRevert(SplitEscrow.SplitNotOpen.selector);
        escrow.pay(id);
    }

    // ---- cancel / expire ----

    function test_cancel_refundsPaidMembers() public {
        bytes32 id = _createSplit();
        vm.prank(alice);
        escrow.pay(id);

        vm.prank(creator);
        escrow.cancel(id);

        (,,,,, SplitEscrow.SplitStatus status,) = escrow.getSplit(id);
        assertEq(uint8(status), uint8(SplitEscrow.SplitStatus.Expired));
        assertEq(usdc.balanceOf(alice), 1_000 * ONE_USDC); // fully refunded
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_cancel_onlyCreator() public {
        bytes32 id = _createSplit();
        vm.prank(alice);
        vm.expectRevert(SplitEscrow.NotCreator.selector);
        escrow.cancel(id);
    }

    function test_expire_revertsBeforeDeadline() public {
        bytes32 id = _createSplit();
        vm.prank(alice);
        vm.expectRevert(SplitEscrow.DeadlineNotPassed.selector);
        escrow.expire(id);
    }

    function test_expire_afterDeadline_refunds() public {
        bytes32 id = _createSplit();
        vm.prank(alice);
        escrow.pay(id);

        vm.warp(block.timestamp + 49 hours);
        vm.prank(bob); // anyone can expire
        escrow.expire(id);

        (,,,,, SplitEscrow.SplitStatus status,) = escrow.getSplit(id);
        assertEq(uint8(status), uint8(SplitEscrow.SplitStatus.Expired));
        assertEq(usdc.balanceOf(alice), 1_000 * ONE_USDC);
    }

    function test_cancel_revertsIfAlreadyExpired() public {
        bytes32 id = _createSplit();
        vm.startPrank(creator);
        escrow.cancel(id);
        vm.expectRevert(SplitEscrow.SplitNotOpen.selector);
        escrow.cancel(id);
        vm.stopPrank();
    }
}
