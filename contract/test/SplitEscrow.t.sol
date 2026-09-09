// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { SplitEscrow } from "../src/SplitEscrow.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";
import { BlocklistUSDC } from "./mocks/BlocklistUSDC.sol";

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

    /// Pay with the recipient and amount the split actually carries (read before pranking).
    function _pay(address who, bytes32 id) internal {
        (, address rcpt,,,,,) = escrow.getSplit(id);
        uint256 owed = escrow.getMemberOwed(id, who);
        vm.prank(who);
        escrow.pay(id, rcpt, owed);
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

        _pay(alice, id);

        (,,, uint256 collected,,,) = escrow.getSplit(id);
        assertEq(collected, 20 * ONE_USDC);
        assertTrue(escrow.hasMemberPaid(id, alice));
        assertEq(usdc.balanceOf(escrow.custodyOf(id)), 20 * ONE_USDC);
    }

    function test_pay_autoReleasesWhenComplete() public {
        bytes32 id = _createSplit();

        _pay(alice, id);
        _pay(bob, id);
        _pay(carol, id);

        (,,,,, SplitEscrow.SplitStatus status,) = escrow.getSplit(id);
        assertEq(uint8(status), uint8(SplitEscrow.SplitStatus.Complete));
        assertEq(usdc.balanceOf(recipient), 60 * ONE_USDC);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_pay_revertsIfAlreadyPaid() public {
        bytes32 id = _createSplit();
        _pay(alice, id);
        vm.prank(alice);
        vm.expectRevert(SplitEscrow.AlreadyPaid.selector);
        escrow.pay(id, recipient, 20 * ONE_USDC);
    }

    function test_pay_revertsIfNotMember() public {
        bytes32 id = _createSplit();
        vm.prank(recipient);
        vm.expectRevert(SplitEscrow.NotMember.selector);
        escrow.pay(id, recipient, 20 * ONE_USDC);
    }

    function test_pay_revertsIfNotFound() public {
        vm.prank(alice);
        vm.expectRevert(SplitEscrow.SplitNotFound.selector);
        escrow.pay(bytes32(uint256(1)), recipient, ONE_USDC);
    }

    function test_pay_revertsIfComplete() public {
        bytes32 id = _createSplit();
        _pay(alice, id);
        _pay(bob, id);
        _pay(carol, id);

        // A member of a completed split cannot pay again
        vm.prank(alice);
        vm.expectRevert(SplitEscrow.SplitNotOpen.selector);
        escrow.pay(id, recipient, 20 * ONE_USDC);
    }

    // ---- cancel / expire ----

    function test_cancel_refundsPaidMembers() public {
        bytes32 id = _createSplit();
        _pay(alice, id);

        vm.prank(creator);
        escrow.cancel(id);

        (,,,,, SplitEscrow.SplitStatus status,) = escrow.getSplit(id);
        assertEq(uint8(status), uint8(SplitEscrow.SplitStatus.Expired));
        assertEq(usdc.balanceOf(escrow.custodyOf(id)), 20 * ONE_USDC); // held until alice claims it

        vm.prank(alice);
        escrow.claimRefund(id);
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
        _pay(alice, id);

        vm.warp(block.timestamp + 49 hours);
        vm.prank(bob); // anyone can expire
        escrow.expire(id);

        (,,,,, SplitEscrow.SplitStatus status,) = escrow.getSplit(id);
        assertEq(uint8(status), uint8(SplitEscrow.SplitStatus.Expired));

        vm.prank(alice);
        escrow.claimRefund(id);
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

    // ---- creation bounds ----

    function test_createSplit_revertsOnInvalidDeadline() public {
        address[] memory members = new address[](1);
        members[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = ONE_USDC;

        vm.prank(creator);
        vm.expectRevert(SplitEscrow.InvalidDeadline.selector);
        escrow.createSplit(members, amounts, recipient, "", 0);

        uint256 maxHours = escrow.MAX_DEADLINE_HOURS(); // read first: an external call would consume the expectRevert
        vm.prank(creator);
        vm.expectRevert(SplitEscrow.InvalidDeadline.selector);
        escrow.createSplit(members, amounts, recipient, "", maxHours + 1);

        vm.prank(creator);
        escrow.createSplit(members, amounts, recipient, "", maxHours); // the limit itself is allowed
    }

    function test_createSplit_revertsOnTooManyMembers() public {
        uint256 n = escrow.MAX_MEMBERS() + 1;
        address[] memory members = new address[](n);
        uint256[] memory amounts = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            members[i] = address(uint160(0x1000 + i));
            amounts[i] = ONE_USDC;
        }
        vm.prank(creator);
        vm.expectRevert(SplitEscrow.TooManyMembers.selector);
        escrow.createSplit(members, amounts, recipient, "", 24);
    }

    // ---- SE-2: the payer states where their money goes ----

    function test_pay_revertsOnRecipientMismatch() public {
        // The creator names themselves as recipient; alice was told it pays "recipient".
        address[] memory members = new address[](1);
        members[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 900 * ONE_USDC;
        vm.prank(creator);
        bytes32 id = escrow.createSplit(members, amounts, creator, "Dinner", 48);

        vm.prank(alice);
        vm.expectRevert(SplitEscrow.SplitMismatch.selector);
        escrow.pay(id, recipient, 900 * ONE_USDC);
        assertEq(usdc.balanceOf(address(escrow)), 0); // nothing moved
    }

    function test_pay_revertsOnAmountMismatch() public {
        bytes32 id = _createSplit();
        vm.prank(alice);
        vm.expectRevert(SplitEscrow.SplitMismatch.selector);
        escrow.pay(id, recipient, 19 * ONE_USDC);
        assertFalse(escrow.hasMemberPaid(id, alice));
    }

    // ---- SE-1: pulled refunds ----

    function test_claimRefund_onlyAfterClose() public {
        bytes32 id = _createSplit();
        _pay(alice, id);
        vm.prank(alice);
        vm.expectRevert(SplitEscrow.SplitNotExpired.selector);
        escrow.claimRefund(id);

        vm.expectRevert(SplitEscrow.SplitNotFound.selector);
        escrow.claimRefund(bytes32(uint256(1)));
    }

    function test_claimRefund_onlyPaidMembersOnlyOnce() public {
        bytes32 id = _createSplit();
        _pay(alice, id);
        vm.prank(creator);
        escrow.cancel(id);

        vm.prank(alice);
        escrow.claimRefund(id);
        assertTrue(escrow.hasClaimedRefund(id, alice));

        vm.prank(alice);
        vm.expectRevert(SplitEscrow.NothingToRefund.selector); // no double claim
        escrow.claimRefund(id);
        vm.prank(bob);
        vm.expectRevert(SplitEscrow.NothingToRefund.selector); // never paid
        escrow.claimRefund(id);
        vm.prank(recipient);
        vm.expectRevert(SplitEscrow.NothingToRefund.selector); // not a member
        escrow.claimRefund(id);
    }

    function test_claimRefund_notAvailableOnCompletedSplit() public {
        bytes32 id = _createSplit();
        _pay(alice, id);
        _pay(bob, id);
        _pay(carol, id);
        vm.prank(alice);
        vm.expectRevert(SplitEscrow.SplitNotExpired.selector);
        escrow.claimRefund(id);
    }

    function test_cannotPayAfterCancel() public {
        bytes32 id = _createSplit();
        vm.prank(creator);
        escrow.cancel(id);
        vm.prank(alice);
        vm.expectRevert(SplitEscrow.SplitNotOpen.selector);
        escrow.pay(id, recipient, 20 * ONE_USDC);
    }

    function testFuzz_refundsMatchWhatWasPaid(uint8 mask) public {
        bytes32 id = _createSplit();
        address[3] memory who = [alice, bob, carol];
        uint256 paidCount;
        for (uint256 i = 0; i < 2; i++) { // only two of three pay, so the split can never complete
            if (mask & (1 << i) != 0) {
                _pay(who[i], id);
                paidCount++;
            }
        }
        vm.warp(block.timestamp + 49 hours);
        escrow.expire(id);
        for (uint256 i = 0; i < 2; i++) {
            if (mask & (1 << i) != 0) {
                vm.prank(who[i]);
                escrow.claimRefund(id);
            }
        }
        assertEq(usdc.balanceOf(address(escrow)), 0);
        for (uint256 i = 0; i < 3; i++) assertEq(usdc.balanceOf(who[i]), 1_000 * ONE_USDC);
    }
}

/// A member who is blocklisted after paying can no longer be refunded, but must not stop anyone else's refund.
contract SplitEscrowBlocklistTest is Test {
    uint256 constant ONE_USDC = 1e6;

    function test_blocklistedMemberDoesNotTrapOthersRefunds() public {
        BlocklistUSDC usdc = new BlocklistUSDC();
        SplitEscrow escrow = new SplitEscrow(address(usdc));
        address creator = makeAddr("creator");
        address recipient = makeAddr("recipient");
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        address carol = makeAddr("carol");

        address[] memory members = new address[](3);
        members[0] = alice;
        members[1] = bob;
        members[2] = carol;
        uint256[] memory amounts = new uint256[](3);
        for (uint256 i = 0; i < 3; i++) {
            amounts[i] = 20 * ONE_USDC;
            usdc.mint(members[i], 100 * ONE_USDC);
            vm.prank(members[i]);
            usdc.approve(address(escrow), type(uint256).max);
        }
        vm.prank(creator);
        bytes32 id = escrow.createSplit(members, amounts, recipient, "Dinner", 48);

        vm.prank(alice);
        escrow.pay(id, recipient, 20 * ONE_USDC);
        vm.prank(bob);
        escrow.pay(id, recipient, 20 * ONE_USDC);

        usdc.setBlocked(bob, true); // blocklisted after paying; carol never pays

        vm.warp(block.timestamp + 49 hours);
        escrow.expire(id); // succeeds: nothing is pushed to anyone (was: reverted on Bob's refund)
        vm.prank(creator);
        vm.expectRevert(SplitEscrow.SplitNotOpen.selector); // already closed, cancelling is not a way around it either
        escrow.cancel(id);

        vm.prank(alice);
        escrow.claimRefund(id);
        assertEq(usdc.balanceOf(alice), 100 * ONE_USDC); // Alice is whole

        vm.prank(bob);
        vm.expectRevert(bytes("blocked"));
        escrow.claimRefund(id); // only Bob is affected
        assertEq(usdc.balanceOf(escrow.custodyOf(id)), 20 * ONE_USDC); // Bob's share, waiting for him
    }

    /// If the recipient cannot receive USDC, the final payment reverts, so the split cannot complete,
    /// but it can still be expired and every member refunded.
    function test_blocklistedRecipientCannotStrandMembers() public {
        BlocklistUSDC usdc = new BlocklistUSDC();
        SplitEscrow escrow = new SplitEscrow(address(usdc));
        address recipient = makeAddr("recipient");
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");

        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10 * ONE_USDC;
        amounts[1] = 10 * ONE_USDC;
        for (uint256 i = 0; i < 2; i++) {
            usdc.mint(members[i], 50 * ONE_USDC);
            vm.prank(members[i]);
            usdc.approve(address(escrow), type(uint256).max);
        }
        bytes32 id = escrow.createSplit(members, amounts, recipient, "x", 24);
        vm.prank(alice);
        escrow.pay(id, recipient, 10 * ONE_USDC);

        usdc.setBlocked(recipient, true);
        vm.prank(bob);
        vm.expectRevert(bytes("blocked"));
        escrow.pay(id, recipient, 10 * ONE_USDC); // the completing payment reverts

        vm.warp(block.timestamp + 25 hours);
        escrow.expire(id);
        vm.prank(alice);
        escrow.claimRefund(id);
        assertEq(usdc.balanceOf(alice), 50 * ONE_USDC);
        assertEq(usdc.balanceOf(bob), 50 * ONE_USDC); // Bob's failed payment moved nothing
    }
}
