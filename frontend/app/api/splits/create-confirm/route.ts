import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentContractExecution } from "@/lib/circle/wallets";
import { fromUsdcUnits, getSplitEscrowContract } from "@/lib/contracts";
import { parseEventFromTx, sameAddress } from "@/lib/server/goals";
import { splitEscrowAddress } from "@/lib/server/splits";
import { recordActivity } from "@/lib/server/activity";
import { isUniqueViolation } from "@/lib/server/payments";

const SPLIT_CREATED_EVENT =
  "event SplitCreated(bytes32 indexed splitId, address indexed creator, address indexed recipient, uint256 total, uint256 deadline, string description)";

type SplitCreatedArgs = {
  splitId: string;
  creator: string;
  recipient: string;
  total: bigint;
  deadline: bigint;
  description: string;
};

/**
 * POST /api/splits/create-confirm
 * body: { circleId }
 * Call after the client approves the PIN challenge from create-challenge. The split is recorded
 * from what the contract says: its id, creator, recipient, total, deadline, description, members
 * and each member's share. Only the circle is taken from the request, and every member on-chain
 * must belong to it.
 */
export async function POST(req: Request) {
  const creator = await getAuthedUser(req);
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!creator.circle_wallet_id || !creator.wallet_address) {
    return NextResponse.json({ error: "Wallet not set up yet" }, { status: 400 });
  }

  const { circleId } = await req.json();
  if (!circleId) return NextResponse.json({ error: "circleId required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: circleMembers } = await admin.from("circle_members").select("user_id").eq("circle_id", circleId);
  const circleMemberIds = (circleMembers ?? []).map((m) => m.user_id as string);
  if (!circleMemberIds.includes(creator.id)) {
    return NextResponse.json({ error: "Not a member of this circle" }, { status: 403 });
  }

  try {
    const { txHash } = await resolveAndVerifyRecentContractExecution({
      userId: creator.id,
      walletId: creator.circle_wallet_id,
      contractAddress: splitEscrowAddress(),
      requireHash: true,
    });

    const event = await parseEventFromTx<SplitCreatedArgs>(
      txHash as string,
      SPLIT_CREATED_EVENT,
      "SplitCreated",
      splitEscrowAddress()
    );
    if (!event) {
      return NextResponse.json({ error: "Could not read the created split from-chain" }, { status: 502 });
    }
    if (!sameAddress(event.creator, creator.wallet_address) || !sameAddress(event.recipient, creator.wallet_address)) {
      return NextResponse.json({ error: "That split was not created by your wallet for your wallet" }, { status: 409 });
    }

    const escrow = getSplitEscrowContract();
    const onChainMembers: string[] = await escrow.getMembers(event.splitId);
    const owed: bigint[] = await Promise.all(onChainMembers.map((m) => escrow.getMemberOwed(event.splitId, m)));

    const { data: circleUsers } = await admin.from("users").select("id, wallet_address").in("id", circleMemberIds);
    const byWallet = new Map(
      (circleUsers ?? []).filter((u) => u.wallet_address).map((u) => [String(u.wallet_address).toLowerCase(), u.id as string])
    );
    const members: { user_id: string; amount: number }[] = [];
    for (let i = 0; i < onChainMembers.length; i++) {
      const id = byWallet.get(onChainMembers[i].toLowerCase());
      if (!id) {
        return NextResponse.json(
          { error: "The on-chain split includes a wallet that is not a member of this circle" },
          { status: 409 }
        );
      }
      members.push({ user_id: id, amount: fromUsdcUnits(owed[i]) });
    }

    const total = fromUsdcUnits(event.total);
    const { data: split, error } = await admin
      .from("splits")
      .insert({
        contract_split_id: event.splitId,
        creator_id: creator.id,
        circle_id: circleId,
        total_amount_usdc: total,
        description: event.description,
        deadline: new Date(Number(event.deadline) * 1000).toISOString(),
        status: "open",
      })
      .select()
      .single();
    if (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ error: "This split has already been recorded" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await admin
      .from("split_members")
      .insert(members.map((m) => ({ split_id: split.id, user_id: m.user_id, amount_owed_usdc: m.amount })));

    await recordActivity(
      members.map((m) => ({
        user_id: m.user_id,
        type: "split_created" as const,
        reference_id: split.id,
        actor_id: creator.id,
        amount_usdc: m.amount,
        note: event.description,
      }))
    );

    return NextResponse.json({ split });
  } catch (e) {
    console.error("Split creation confirmation failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not confirm split creation" },
      { status: 502 }
    );
  }
}
