import { getSupabaseAdmin } from "@/lib/supabase";
import { getArcProvider, getGoalPoolContract, GOAL_POOL_ABI, toUsdcUnits } from "@/lib/contracts";
import { ethers } from "ethers";

export interface GoalRow {
  id: string;
  circle_id: string;
  contract_goal_id: string | null;
  creator_id: string;
  target_amount_usdc: number;
  collected_usdc: number;
  description: string;
  status: "open" | "withdrawn" | "cancelled";
}

/** Load a goal and confirm the given user is one of its members. */
export async function getGoalForMember(
  goalId: string,
  userId: string
): Promise<{ goal: GoalRow; memberIds: string[] } | null> {
  const admin = getSupabaseAdmin();
  const { data: goal } = await admin.from("circle_goals").select("*").eq("id", goalId).maybeSingle();
  if (!goal) return null;

  const { data: members } = await admin.from("goal_members").select("user_id").eq("goal_id", goalId);
  const memberIds = (members ?? []).map((m) => m.user_id);
  if (!memberIds.includes(userId)) return null;

  return { goal, memberIds };
}

/** Parse a named event's args out of a GoalPool transaction receipt fetched by hash. */
export async function parseEventFromTx<T extends Record<string, unknown>>(
  txHash: string,
  eventFragment: string,
  eventName: string
): Promise<T | null> {
  const provider = getArcProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return null;

  const iface = new ethers.Interface([eventFragment]);
  const emitter = goalPoolAddress().toLowerCase();
  for (const log of receipt.logs) {
    // Only trust events emitted by GoalPool itself, not a look-alike from another contract.
    if (log.address.toLowerCase() !== emitter) continue;
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === eventName) return parsed.args.toObject() as T;
    } catch {
      // not this event - keep scanning
    }
  }
  return null;
}

export const GOAL_POOL_INTERFACE_ABI = GOAL_POOL_ABI;

export function goalPoolAddress(): string {
  return process.env.NEXT_PUBLIC_GOAL_POOL_CONTRACT!;
}

export function usdcBaseUnits(amount: number): string {
  return toUsdcUnits(amount).toString();
}

export const WITHDRAWAL_STATUS = { None: 0, Pending: 1, Executed: 2, Cancelled: 3 } as const;

export interface OnChainWithdrawal {
  goalId: string;
  requester: string;
  recipient: string;
  amount: bigint;
  status: number;
  approvalCount: bigint;
}

export const sameAddress = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** Read a withdrawal straight from GoalPool - the source of truth for who gets paid and how much. */
export async function readWithdrawal(withdrawalId: string): Promise<OnChainWithdrawal> {
  const [goalId, requester, recipient, amount, status, approvalCount] =
    await getGoalPoolContract().getWithdrawal(withdrawalId);
  return { goalId, requester, recipient, amount, status: Number(status), approvalCount };
}

/**
 * Compare what the DB (and therefore the approval UI) says about a
 * withdrawal with what the contract will actually do when it executes.
 * Returns a human-readable reason on mismatch, or null when they agree.
 * approveWithdrawal(id) carries no recipient or amount, so this check is
 * the only thing standing between a member and an approval for a payout
 * they were shown incorrectly.
 */
export function withdrawalMismatch(
  onChain: OnChainWithdrawal,
  expected: { contractGoalId: string; recipientAddress: string; amountUsdc: number | string }
): string | null {
  if (onChain.status !== WITHDRAWAL_STATUS.Pending) return "This withdrawal is no longer pending on-chain";
  if (onChain.goalId.toLowerCase() !== expected.contractGoalId.toLowerCase()) {
    return "This withdrawal belongs to a different goal on-chain";
  }
  if (!sameAddress(onChain.recipient, expected.recipientAddress)) {
    return "The on-chain recipient does not match the recipient shown for this request";
  }
  let expectedUnits: bigint;
  try {
    expectedUnits = toUsdcUnits(expected.amountUsdc);
  } catch {
    return "The recorded amount for this request is invalid";
  }
  if (onChain.amount !== expectedUnits) {
    return "The on-chain amount does not match the amount shown for this request";
  }
  return null;
}

export const GOAL_STATUS = { None: 0, Open: 1, Withdrawn: 2, Cancelled: 3 } as const;

export interface OnChainGoal {
  status: number;
  collected: bigint;
  /** Zero when no withdrawal request is pending. */
  activeWithdrawalId: bigint;
  /** Unix seconds when the goal can be dissolved; 0 when no exit countdown is running. */
  exitAt: number;
  exitInitiator: string;
  /** What `wallet` contributed (after dissolution: what it has not yet claimed). */
  contributionOfWallet: bigint;
  /** Latest block time, the clock the contract itself uses. */
  now: number;
}

/** Read a goal's live state from GoalPool. The chain, not the DB, decides what is allowed. */
export async function readGoalState(contractGoalId: string, wallet?: string | null): Promise<OnChainGoal> {
  const pool = getGoalPoolContract();
  const [, , collected, status, , activeWithdrawalId] = await pool.getGoal(contractGoalId);
  const [exitAt, exitInitiator] = await pool.exitOf(contractGoalId);
  const contributionOfWallet: bigint = wallet ? await pool.contributionOf(contractGoalId, wallet) : BigInt(0);
  const block = await getArcProvider().getBlock("latest");
  return {
    status: Number(status),
    collected,
    activeWithdrawalId,
    exitAt: Number(exitAt),
    exitInitiator,
    contributionOfWallet,
    now: block?.timestamp ?? Math.floor(Date.now() / 1000),
  };
}
