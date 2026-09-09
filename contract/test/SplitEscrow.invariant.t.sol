// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { SplitEscrow } from "../src/SplitEscrow.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

/// Random sequences of every state-changing SplitEscrow call, by three members and the creator
/// across two splits. Reverting calls (wrong order, wrong actor) are expected and ignored; what
/// must never happen is the escrow holding the wrong amount.
contract SplitEscrowHandler is Test {
    SplitEscrow public escrow;
    address public creator;
    address public recipient;
    address[3] public members;
    bytes32[2] public splits;

    constructor(SplitEscrow _escrow, address _creator, address _recipient, address[3] memory _members, bytes32[2] memory _splits) {
        escrow = _escrow;
        creator = _creator;
        recipient = _recipient;
        members = _members;
        splits = _splits;
    }

    function pay(uint256 a, uint256 s) external {
        address who = members[a % 3];
        bytes32 id = splits[s % 2];
        (, address rcpt,,,,,) = escrow.getSplit(id);
        uint256 owed = escrow.getMemberOwed(id, who);
        vm.prank(who);
        try escrow.pay(id, rcpt, owed) {} catch {}
    }

    function cancel(uint256 s) external {
        vm.prank(creator);
        try escrow.cancel(splits[s % 2]) {} catch {}
    }

    function expire(uint256 a, uint256 s) external {
        vm.prank(members[a % 3]);
        try escrow.expire(splits[s % 2]) {} catch {}
    }

    function claim(uint256 a, uint256 s) external {
        vm.prank(members[a % 3]);
        try escrow.claimRefund(splits[s % 2]) {} catch {}
    }

    function passTime(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 0, 4 days));
    }
}

contract SplitEscrowInvariantTest is Test {
    uint256 constant MINTED = 1_000_000e6;

    MockUSDC usdc;
    SplitEscrow escrow;
    SplitEscrowHandler handler;
    address creator = makeAddr("creator");
    address recipient = makeAddr("recipient");
    address[3] members = [makeAddr("alice"), makeAddr("bob"), makeAddr("carol")];
    bytes32[2] splits;

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new SplitEscrow(address(usdc));

        address[] memory list = new address[](3);
        uint256[] memory amounts = new uint256[](3);
        for (uint256 i = 0; i < 3; i++) {
            list[i] = members[i];
            amounts[i] = (i + 1) * 10e6; // uneven shares: 10, 20, 30
            usdc.mint(members[i], MINTED);
            vm.prank(members[i]);
            usdc.approve(address(escrow), type(uint256).max);
        }
        for (uint256 s = 0; s < 2; s++) {
            vm.prank(creator);
            splits[s] = escrow.createSplit(list, amounts, recipient, s == 0 ? "A" : "B", 48);
        }

        handler = new SplitEscrowHandler(escrow, creator, recipient, members, splits);
        targetContract(address(handler));
    }

    /// Each split's custody holds exactly what is still owed on that split: the collected amount
    /// while open, plus every unclaimed refund once closed, plus nothing once paid out.
    function invariant_escrowHoldsExactlyWhatIsOwed() public view {
        for (uint256 s = 0; s < 2; s++) {
            (,, uint256 total, uint256 collected,, SplitEscrow.SplitStatus status,) = escrow.getSplit(splits[s]);
            uint256 owed;
            if (status == SplitEscrow.SplitStatus.Open) {
                assertLe(collected, total);
                owed = collected;
            } else if (status == SplitEscrow.SplitStatus.Expired) {
                for (uint256 i = 0; i < 3; i++) {
                    if (escrow.hasMemberPaid(splits[s], members[i]) && !escrow.hasClaimedRefund(splits[s], members[i])) {
                        owed += escrow.getMemberOwed(splits[s], members[i]);
                    }
                }
            }
            assertEq(usdc.balanceOf(escrow.custodyOf(splits[s])), owed);
        }
    }

    /// A completed split paid its recipient exactly the total; nothing else ever reaches the recipient.
    function invariant_recipientOnlyEverReceivesCompletedTotals() public view {
        uint256 expected;
        for (uint256 s = 0; s < 2; s++) {
            (,, uint256 total,,, SplitEscrow.SplitStatus status,) = escrow.getSplit(splits[s]);
            if (status == SplitEscrow.SplitStatus.Complete) expected += total;
        }
        assertEq(usdc.balanceOf(recipient), expected);
    }

    /// No value is created or destroyed.
    function invariant_valueIsConserved() public view {
        uint256 total = usdc.balanceOf(address(escrow)) + usdc.balanceOf(recipient);
        for (uint256 s = 0; s < 2; s++) total += usdc.balanceOf(escrow.custodyOf(splits[s]));
        for (uint256 i = 0; i < 3; i++) total += usdc.balanceOf(members[i]);
        assertEq(total, 3 * MINTED);
    }
}
