// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { SplitEscrow } from "../src/SplitEscrow.sol";

/**
 * Deploys SplitEscrow to Arc testnet. Separate from Deploy.s.sol (PayCircle) so either can be
 * redeployed without touching the other.
 *
 * Usage:
 *   forge script script/DeploySplitEscrow.s.sol:DeploySplitEscrowScript \
 *     --rpc-url $ARC_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --legacy
 *
 * Required env vars: ARC_USDC_ADDRESS
 */
contract DeploySplitEscrowScript is Script {
    function run() external {
        address usdc = vm.envAddress("ARC_USDC_ADDRESS");

        vm.startBroadcast();
        SplitEscrow splitEscrow = new SplitEscrow(usdc);
        vm.stopBroadcast();

        console.log("SplitEscrow deployed:", address(splitEscrow));
        console.log("USDC:", usdc);
    }
}
