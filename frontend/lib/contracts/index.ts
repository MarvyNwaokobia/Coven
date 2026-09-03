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
  "function pay(bytes32 splitId, address expectedRecipient, uint256 expectedAmount)",
  "function cancel(bytes32 splitId)",
  "function expire(bytes32 splitId)",
  "function claimRefund(bytes32 splitId)",
  "function hasClaimedRefund(bytes32 splitId, address member) view returns (bool)",
  "function getSplit(bytes32 splitId) view returns (address creator, address recipient, uint256 totalAmount, uint256 collected, uint256 deadline, uint8 status, string description)",
  "function getMemberOwed(bytes32 splitId, address member) view returns (uint256)",
  "function hasMemberPaid(bytes32 splitId, address member) view returns (bool)",
  "function getMembers(bytes32 splitId) view returns (address[])",
  "event SplitCreated(bytes32 indexed splitId, address indexed creator, address indexed recipient, uint256 total, uint256 deadline, string description)",
  "event MemberPaid(bytes32 indexed splitId, address indexed member, uint256 amount)",
  "event SplitComplete(bytes32 indexed splitId, address indexed recipient, uint256 amount)",
  "event SplitCancelled(bytes32 indexed splitId)",
  "event Refunded(bytes32 indexed splitId, address indexed member, uint256 amount)",
];

export const GOAL_POOL_ABI = [
  "function createGoal(address[] members, uint256 targetAmount, string description) returns (bytes32)",
  "function contribute(bytes32 goalId, uint256 amount)",
  "function requestWithdrawal(bytes32 goalId, address recipient) returns (uint256)",
  "function approveWithdrawal(uint256 withdrawalId, address recipient, uint256 amount)",
  "function cancelWithdrawalRequest(uint256 withdrawalId)",
  "function startExit(bytes32 goalId)",
  "function cancelExit(bytes32 goalId)",
  "function dissolve(bytes32 goalId)",
  "function claimRefund(bytes32 goalId)",
  "function exitOf(bytes32 goalId) view returns (uint256 exitAt, address initiator)",
  "function EXIT_DELAY() view returns (uint256)",
  "function getGoal(bytes32 goalId) view returns (address creator, uint256 targetAmount, uint256 collected, uint8 status, string description, uint256 activeWithdrawalId)",
  "function getMembers(bytes32 goalId) view returns (address[])",
  "function isMember(bytes32 goalId, address account) view returns (bool)",
  "function contributionOf(bytes32 goalId, address account) view returns (uint256)",
  "function getWithdrawal(uint256 withdrawalId) view returns (bytes32 goalId, address requester, address recipient, uint256 amount, uint8 status, uint256 approvalCount)",
  "function hasApprovedWithdrawal(uint256 withdrawalId, address account) view returns (bool)",
  "event GoalCreated(bytes32 indexed goalId, address indexed creator, uint256 targetAmount, string description)",
  "event Contributed(bytes32 indexed goalId, address indexed member, uint256 amount, uint256 totalCollected)",
  "event WithdrawalRequested(uint256 indexed withdrawalId, bytes32 indexed goalId, address indexed requester, address recipient, uint256 amount)",
  "event WithdrawalApproved(uint256 indexed withdrawalId, address indexed member, uint256 approvalCount, uint256 requiredCount)",
  "event WithdrawalExecuted(uint256 indexed withdrawalId, bytes32 indexed goalId, address recipient, uint256 amount)",
  "event WithdrawalCancelled(uint256 indexed withdrawalId, bytes32 indexed goalId)",
  "event GoalCancelled(bytes32 indexed goalId)",
  "event ExitStarted(bytes32 indexed goalId, address indexed initiator, uint256 exitAt)",
  "event ExitCancelled(bytes32 indexed goalId)",
  "event Refunded(bytes32 indexed goalId, address indexed member, uint256 amount)",
];

/** Minimal ERC20 read/approve ABI for allowance checks. */
export const USDC_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
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

export function getGoalPoolContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    process.env.NEXT_PUBLIC_GOAL_POOL_CONTRACT!,
    GOAL_POOL_ABI,
    signerOrProvider ?? getArcProvider()
  );
}

export function getUsdcContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(process.env.ARC_USDC_ADDRESS!, USDC_ABI, signerOrProvider ?? getArcProvider());
}

/** USDC has 6 decimals. */
export const toUsdcUnits = (amount: number | string): bigint =>
  ethers.parseUnits(String(amount), 6);

export const fromUsdcUnits = (units: bigint): number =>
  Number(ethers.formatUnits(units, 6));
