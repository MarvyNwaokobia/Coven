/**
 * On-chain contract clients for Arc (server-side).
 * The relayer key executes platform transactions (fee collection, escrow reads).
 */
import { ethers } from "ethers";

export const PAYCIRCLE_ABI = [
  "function send(address recipient, uint256 amount, string note) returns (bytes32)",
  "function splitPayment(address[] recipients, uint256[] amounts, string note) returns (bytes32)",
  "function collectOfframpFee(uint256 amount) returns (uint256 fee, uint256 netAmount)",
  "function feeTreasury() view returns (address)",
  "event PaymentSent(address indexed from, address indexed to, uint256 amount, uint256 fee, string note, bytes32 indexed paymentId)",
  "event GroupPaymentExecuted(bytes32 indexed groupPaymentId, address indexed initiator, uint256 total, uint256 fee, string note)",
];

export const SPLIT_ESCROW_ABI = [
  "function createSplit(address[] members, uint256[] amounts, address recipient, string description, uint256 deadlineHours) returns (bytes32)",
  "function pay(bytes32 splitId)",
  "function cancel(bytes32 splitId)",
  "function expire(bytes32 splitId)",
  "function getSplit(bytes32 splitId) view returns (address creator, address recipient, uint256 totalAmount, uint256 collected, uint256 deadline, uint8 status, string description)",
  "function getMemberOwed(bytes32 splitId, address member) view returns (uint256)",
  "function hasMemberPaid(bytes32 splitId, address member) view returns (bool)",
  "function getMembers(bytes32 splitId) view returns (address[])",
  "event SplitCreated(bytes32 indexed splitId, address indexed creator, address indexed recipient, uint256 total, uint256 deadline, string description)",
];

export function getArcProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
}

export function getRelayerSigner(): ethers.Wallet {
  return new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY!, getArcProvider());
}

export function getPayCircleContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    process.env.NEXT_PUBLIC_PAYCIRCLE_CONTRACT!,
    PAYCIRCLE_ABI,
    signerOrProvider ?? getArcProvider()
  );
}

export function getSplitEscrowContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    process.env.NEXT_PUBLIC_SPLIT_ESCROW_CONTRACT!,
    SPLIT_ESCROW_ABI,
    signerOrProvider ?? getArcProvider()
  );
}

/** USDC has 6 decimals. */
export const toUsdcUnits = (amount: number | string): bigint =>
  ethers.parseUnits(String(amount), 6);

export const fromUsdcUnits = (units: bigint): number =>
  Number(ethers.formatUnits(units, 6));
