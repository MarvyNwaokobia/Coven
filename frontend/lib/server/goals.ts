import { getSupabaseAdmin } from "@/lib/supabase";
import { getArcProvider, GOAL_POOL_ABI, toUsdcUnits } from "@/lib/contracts";
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

/** Parse a named event's args out of a transaction receipt fetched by hash. */
export async function parseEventFromTx<T extends Record<string, unknown>>(
  txHash: string,
  eventFragment: string,
  eventName: string
): Promise<T | null> {
  const provider = getArcProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return null;

  const iface = new ethers.Interface([eventFragment]);
  for (const log of receipt.logs) {
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
