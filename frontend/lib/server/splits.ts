import { getSupabaseAdmin } from "@/lib/supabase";
import { getArcProvider, getSplitEscrowContract } from "@/lib/contracts";

export const SPLIT_STATUS = { None: 0, Open: 1, Complete: 2, Expired: 3 } as const;

export function splitEscrowAddress(): string {
  return process.env.NEXT_PUBLIC_SPLIT_ESCROW_CONTRACT!;
}

export interface SplitRow {
  id: string;
  circle_id: string | null;
  contract_split_id: string | null;
  creator_id: string;
  total_amount_usdc: number;
  collected_usdc: number;
  description: string;
  status: "open" | "complete" | "cancelled";
  deadline: string | null;
}

/**
 * Load a split and confirm the given user takes part in it: either they created it or they owe
 * a share. Returns the ids of everyone involved so callers can notify them.
 */
export async function getSplitForParticipant(
  splitId: string,
  userId: string
): Promise<{ split: SplitRow; memberIds: string[]; isCreator: boolean; isMember: boolean } | null> {
  const admin = getSupabaseAdmin();
  const { data: split } = await admin.from("splits").select("*").eq("id", splitId).maybeSingle();
  if (!split) return null;

  const { data: members } = await admin.from("split_members").select("user_id").eq("split_id", splitId);
  const memberIds = (members ?? []).map((m) => m.user_id as string);
  const isCreator = split.creator_id === userId;
  const isMember = memberIds.includes(userId);
  if (!isCreator && !isMember) return null;

  return { split, memberIds, isCreator, isMember };
}

export interface OnChainSplit {
  status: number;
  creator: string;
  recipient: string;
  totalAmount: bigint;
  collected: bigint;
  /** Unix seconds after which anyone can expire the split. */
  deadline: number;
  /** What `wallet` owes (0 when it is not a member). */
  owedByWallet: bigint;
  paidByWallet: boolean;
  refundClaimedByWallet: boolean;
  /** Latest block time, the clock the contract itself uses. */
  now: number;
}

/** Read a split's live state from SplitEscrow. The chain, not the DB, decides what is allowed. */
export async function readSplitState(contractSplitId: string, wallet?: string | null): Promise<OnChainSplit> {
  const escrow = getSplitEscrowContract();
  const [creator, recipient, totalAmount, collected, deadline, status] = await escrow.getSplit(contractSplitId);
  const [owed, paid, claimed]: [bigint, boolean, boolean] = wallet
    ? await Promise.all([
        escrow.getMemberOwed(contractSplitId, wallet),
        escrow.hasMemberPaid(contractSplitId, wallet),
        escrow.hasClaimedRefund(contractSplitId, wallet),
      ])
    : [BigInt(0), false, false];
  const block = await getArcProvider().getBlock("latest");
  return {
    status: Number(status),
    creator,
    recipient,
    totalAmount,
    collected,
    deadline: Number(deadline),
    owedByWallet: owed,
    paidByWallet: paid,
    refundClaimedByWallet: claimed,
    now: block?.timestamp ?? Math.floor(Date.now() / 1000),
  };
}
