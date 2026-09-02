// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { PayCircle } from "../src/PayCircle.sol";

/**
 * Deploys PayCircle to Arc testnet. SplitEscrow and GoalPool have their own scripts.
 *
 * The owner is a required, separate address: it decides where fees are sent, so it must not be
 * the key that deploys (or any key that lives on a server). Ownership can later move to another
 * address in two steps (transferOwnership, then acceptOwnership by the new owner).
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeployScript \
 *     --rpc-url $ARC_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --legacy
 *
 * Required env vars: ARC_USDC_ADDRESS, PLATFORM_FEE_WALLET, PAYCIRCLE_OWNER
 */
contract DeployScript is Script {
    function run() external {
        address usdc = vm.envAddress("ARC_USDC_ADDRESS");
        address feeTreasury = vm.envAddress("PLATFORM_FEE_WALLET");
        address owner = vm.envAddress("PAYCIRCLE_OWNER");
        require(owner != msg.sender, "PAYCIRCLE_OWNER must not be the deploying key");

        vm.startBroadcast();
        PayCircle payCircle = new PayCircle(usdc, feeTreasury, owner);
        vm.stopBroadcast();

        console.log("PayCircle deployed:", address(payCircle));
        console.log("USDC:", usdc);
        console.log("Fee treasury:", feeTreasury);
        console.log("Owner:", owner);
    }
}
