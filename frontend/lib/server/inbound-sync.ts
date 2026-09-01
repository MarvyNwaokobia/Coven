import { getSupabaseAdmin } from "@/lib/supabase";
import { getCircleUserToken } from "@/lib/circle/wallets";

interface CircleTransaction {
  id: string;
  state: string;
  sourceAddress?: string;
  amounts?: string[];
  txHash?: string;
  createDate: string;
}

const SETTLED_STATES = new Set(["COMPLETE", "CONFIRMED"]);

/**
 * Our own send/request/split routes record a transfer within five minutes of
 * it being made (see findRecentTransactions). An inbound transfer younger than
 * that is most likely about to be recorded by the sender's confirm, with the
 * sender attached, so it is left alone: backfilling it here first would label
 * it an anonymous "External deposit" and make the sender's own record collide
 * with it on the unique tx_hash. One extra minute covers clock drift.
 */
const RECORDING_GRACE_MS = 6 * 60_000;

/**
 * Backfills any inbound Circle transfers to this user's wallet that we
 * don't already have a payments row for (matched by tx_hash) - covers
 * external deposits (faucet, another wallet) that never went through our
 * own send/request/split/cashout routes. Payments already recorded by our
 * own flows are skipped automatically since their tx_hash already exists.
 */
export async function syncInboundTransfers(userId: string, walletId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { userToken } = await getCircleUserToken(userId);

  const q = new URLSearchParams({
    walletIds: walletId,
    txType: "INBOUND",
    order: "DESC",
    pageSize: "20",
  });
  const res = await fetch(`https://api.circle.com/v1/w3s/transactions?${q.toString()}`, {
    headers: {
      Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
      "X-User-Token": userToken,
    },
  });
  if (!res.ok) return;

  const { data } = await res.json();
  const transactions: CircleTransaction[] = data?.transactions ?? [];
  const oldEnough = Date.now() - RECORDING_GRACE_MS;
  const settled = transactions.filter(
    (t) => t.txHash && SETTLED_STATES.has(t.state) && new Date(t.createDate).getTime() < oldEnough
  );
  if (settled.length === 0) return;

  const hashes = settled.map((t) => t.txHash!);
  const { data: existing } = await admin.from("payments").select("tx_hash").in("tx_hash", hashes);
  const known = new Set((existing ?? []).map((p) => p.tx_hash));

  const toInsert = settled.filter((t) => !known.has(t.txHash));
  if (toInsert.length === 0) return;

  // Ignore duplicates: a flow may record one of these between the check above and this insert.
  const { data: inserted } = await admin
    .from("payments")
    .upsert(
      toInsert.map((t) => ({
        from_user_id: null,
        to_user_id: userId,
        amount_usdc: Number(t.amounts?.[0] ?? "0"),
        source_chain: "ARC",
        tx_hash: t.txHash,
        status: "completed",
        created_at: t.createDate,
      })),
      { onConflict: "tx_hash", ignoreDuplicates: true }
    )
    .select("id, amount_usdc, created_at");

  if (inserted?.length) {
    await admin.from("activity").insert(
      inserted.map((p) => ({
        user_id: userId,
        type: "payment_received" as const,
        reference_id: p.id,
        actor_id: null,
        amount_usdc: p.amount_usdc,
        note: "External deposit",
        created_at: p.created_at,
      }))
    );
  }
}
