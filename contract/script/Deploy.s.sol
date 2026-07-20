// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { PayCircle } from "../src/PayCircle.sol";
import { SplitEscrow } from "../src/SplitEscrow.sol";

/**
 * Deploys PayCircle + SplitEscrow to Arc testnet.
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeployScript \
 *     --rpc-url $ARC_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast
 *
 * Required env vars: ARC_USDC_ADDRESS, PLATFORM_FEE_WALLET
 */
contract DeployScript is Script {
    function run() external {
        address usdc = vm.envAddress("ARC_USDC_ADDRESS");
        address feeTreasury = vm.envAddress("PLATFORM_FEE_WALLET");

        vm.startBroadcast();

        PayCircle payCircle = new PayCircle(usdc, feeTreasury, msg.sender);
        SplitEscrow splitEscrow = new SplitEscrow(usdc);

        vm.stopBroadcast();

        console.log("PayCircle deployed:", address(payCircle));
        console.log("SplitEscrow deployed:", address(splitEscrow));
        console.log("USDC:", usdc);
        console.log("Fee treasury:", feeTreasury);
    }
}
