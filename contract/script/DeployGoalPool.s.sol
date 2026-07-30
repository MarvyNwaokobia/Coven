// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { GoalPool } from "../src/GoalPool.sol";

/**
 * Deploys GoalPool to Arc testnet. Separate from Deploy.s.sol so it never
 * risks re-broadcasting the already-live PayCircle/SplitEscrow deployments.
 *
 * Usage:
 *   forge script script/DeployGoalPool.s.sol:DeployGoalPoolScript \
 *     --rpc-url $ARC_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --legacy
 *
 * Required env vars: ARC_USDC_ADDRESS
 */
contract DeployGoalPoolScript is Script {
    function run() external {
        address usdc = vm.envAddress("ARC_USDC_ADDRESS");

        vm.startBroadcast();
        GoalPool goalPool = new GoalPool(usdc);
        vm.stopBroadcast();

        console.log("GoalPool deployed:", address(goalPool));
        console.log("USDC:", usdc);
    }
}
