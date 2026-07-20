// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { PayCircle } from "../src/PayCircle.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

contract PayCircleTest is Test {
    PayCircle payCircle;
    MockUSDC usdc;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");

    uint256 constant ONE_USDC = 1e6;

    function setUp() public {
        usdc = new MockUSDC();
        payCircle = new PayCircle(address(usdc), treasury, owner);

        usdc.mint(alice, 10_000 * ONE_USDC);
        vm.prank(alice);
        usdc.approve(address(payCircle), type(uint256).max);
    }

    // ---- send ----

    function test_send_transfersNetAndFee() public {
        vm.prank(alice);
        payCircle.send(bob, 100 * ONE_USDC, "for coffee");

        // 0.5% fee = 0.5 USDC
        assertEq(usdc.balanceOf(bob), 99_500_000);
        assertEq(usdc.balanceOf(treasury), 500_000);
        assertEq(usdc.balanceOf(alice), 9_900 * ONE_USDC);
    }

    function test_send_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit PayCircle.PaymentSent(alice, bob, 99_500_000, 500_000, "hi", bytes32(0));
        payCircle.send(bob, 100 * ONE_USDC, "hi");
    }

    function test_send_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(PayCircle.ZeroAmount.selector);
        payCircle.send(bob, 0, "");
    }

    function test_send_revertsOnZeroRecipient() public {
        vm.prank(alice);
        vm.expectRevert(PayCircle.InvalidRecipients.selector);
        payCircle.send(address(0), ONE_USDC, "");
    }

    function test_send_uniquePaymentIds() public {
        vm.startPrank(alice);
        bytes32 id1 = payCircle.send(bob, ONE_USDC, "");
        bytes32 id2 = payCircle.send(bob, ONE_USDC, "");
        vm.stopPrank();
        assertTrue(id1 != id2);
    }

    // ---- splitPayment ----

    function test_splitPayment_distributesAndCollectsFee() public {
        address[] memory recipients = new address[](3);
        recipients[0] = bob;
        recipients[1] = carol;
        recipients[2] = dave;
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 10 * ONE_USDC;
        amounts[1] = 20 * ONE_USDC;
        amounts[2] = 30 * ONE_USDC;

        vm.prank(alice);
        payCircle.splitPayment(recipients, amounts, "dinner");

        assertEq(usdc.balanceOf(bob), 10 * ONE_USDC);
        assertEq(usdc.balanceOf(carol), 20 * ONE_USDC);
        assertEq(usdc.balanceOf(dave), 30 * ONE_USDC);
        // 0.25% of 60 USDC = 0.15 USDC
        assertEq(usdc.balanceOf(treasury), 150_000);
    }

    function test_splitPayment_recordsGroupPayment() public {
        address[] memory recipients = new address[](1);
        recipients[0] = bob;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * ONE_USDC;

        vm.prank(alice);
        bytes32 id = payCircle.splitPayment(recipients, amounts, "rent");

        (address initiator, uint256 total, uint256 fee,,) = payCircle.groupPayments(id);
        assertEq(initiator, alice);
        assertEq(total, 100 * ONE_USDC);
        assertEq(fee, 250_000);
    }

    function test_splitPayment_revertsOnLengthMismatch() public {
        address[] memory recipients = new address[](2);
        recipients[0] = bob;
        recipients[1] = carol;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = ONE_USDC;

        vm.prank(alice);
        vm.expectRevert(PayCircle.LengthMismatch.selector);
        payCircle.splitPayment(recipients, amounts, "");
    }

    function test_splitPayment_revertsOnEmptyRecipients() public {
        vm.prank(alice);
        vm.expectRevert(PayCircle.InvalidRecipients.selector);
        payCircle.splitPayment(new address[](0), new uint256[](0), "");
    }

    function test_splitPayment_revertsOnZeroRecipient() public {
        address[] memory recipients = new address[](1);
        recipients[0] = address(0);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = ONE_USDC;

        vm.prank(alice);
        vm.expectRevert(PayCircle.InvalidRecipients.selector);
        payCircle.splitPayment(recipients, amounts, "");
    }

    // ---- collectOfframpFee ----

    function test_collectOfframpFee() public {
        vm.prank(alice);
        (uint256 fee, uint256 net) = payCircle.collectOfframpFee(100 * ONE_USDC);

        assertEq(fee, ONE_USDC); // 1%
        assertEq(net, 99 * ONE_USDC);
        assertEq(usdc.balanceOf(treasury), ONE_USDC);
    }

    // ---- admin ----

    function test_setFeeTreasury_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        payCircle.setFeeTreasury(alice);

        vm.prank(owner);
        payCircle.setFeeTreasury(alice);
        assertEq(payCircle.feeTreasury(), alice);
    }

    function test_setFeeTreasury_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(PayCircle.ZeroAddress.selector);
        payCircle.setFeeTreasury(address(0));
    }

    // ---- fuzz ----

    function testFuzz_send_conservesValue(uint256 amount) public {
        amount = bound(amount, 1, 10_000 * ONE_USDC);
        vm.prank(alice);
        payCircle.send(bob, amount, "");
        assertEq(usdc.balanceOf(bob) + usdc.balanceOf(treasury) + usdc.balanceOf(alice), 10_000 * ONE_USDC);
    }
}
