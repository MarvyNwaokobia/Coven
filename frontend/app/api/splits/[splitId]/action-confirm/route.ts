import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentContractExecution } from "@/lib/circle/wallets";
import { getSplitForParticipant, readSplitState, SPLIT_STATUS, splitEscrowAddress } from "@/lib/server/splits";
import { isSplitAction } from "@/lib/server/split-actions";

/**
 * POST /api/splits/[splitId]/action-confirm - body: { action }
 * Call after the client completes the PIN challenge from action-challenge. What happened is read
 * back from SplitEscrow and the DB is updated from that, never from the request, so replaying or
 * forging a confirm cannot change anything the chain does not already say.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ splitId: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.circle_wallet_id || !user.wallet_address) {
    return NextResponse.json({ error: "Wallet not set up yet" }, { status: 400 });
  }

  const { splitId } = await params;
  const { action } = await req.json();
  if (!isSplitAction(action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const found = await getSplitForParticipant(splitId, user.id);
  if (!found) return NextResponse.json({ error: "Split not found" }, { status: 404 });
  if (!found.split.contract_split_id) {
    return NextResponse.json({ error: "This split is not held in escrow" }, { status: 409 });
  }

  try {
    await resolveAndVerifyRecentContractExecution({
      userId: user.id,
      walletId: user.circle_wallet_id,
      contractAddress: splitEscrowAddress(),
    });

    const admin = getSupabaseAdmin();
    const chain = await readSplitState(found.split.contract_split_id, user.wallet_address);
    const notOnChain = (what: string) =>
      NextResponse.json({ error: `${what} was not found on-chain` }, { status: 409 });

    if (action === "cancel" || action === "expire") {
      if (chain.status !== SPLIT_STATUS.Expired) return notOnChain("The cancellation");
      await admin.from("splits").update({ status: "cancelled" }).eq("id", splitId);
      // The escrowed payments are no longer on their way to the creator; members claim them back.
      const { data: shares } = await admin.from("split_members").select("payment_id").eq("split_id", splitId);
      const paymentIds = (shares ?? []).map((s) => s.payment_id).filter(Boolean) as string[];
      if (paymentIds.length > 0) {
        await admin.from("payments").update({ status: "failed" }).in("id", paymentIds).eq("status", "pending");
      }
    } else {
      if (!chain.refundClaimedByWallet) return notOnChain("Your refund");
      await admin
        .from("split_members")
        .update({ refunded_at: new Date().toISOString() })
        .eq("split_id", splitId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Split action confirmation failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not confirm this action" },
      { status: 502 }
    );
  }
}
