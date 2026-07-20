import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { transferUSDC } from "@/lib/circle/wallets";
import { recordActivity } from "@/lib/server/activity";

/**
 * POST /api/circles/[id]/send
 * body: { splits: { username: string; amount: number }[], note? }
 * Sends USDC to multiple circle members in one action.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sender = await getAuthedUser(req);
  if (!sender) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sender.circle_wallet_id) {
    return NextResponse.json({ error: "Wallet not provisioned" }, { status: 400 });
  }

  const { id } = await params;
  const { splits, note } = await req.json();

  if (!Array.isArray(splits) || splits.length === 0) {
    return NextResponse.json({ error: "splits required" }, { status: 400 });
  }
  if (splits.some((s: { amount: number }) => !s.amount || s.amount <= 0)) {
    return NextResponse.json({ error: "All amounts must be positive" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: membership } = await admin
    .from("circle_members")
    .select("circle_id")
    .eq("circle_id", id)
    .eq("user_id", sender.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const usernames = splits.map((s: { username: string }) =>
    s.username.replace(/^@/, "").toLowerCase()
  );
  const { data: recipients } = await admin
    .from("users")
    .select("id, username, wallet_address")
    .in("username", usernames);

  const results: { username: string; ok: boolean; error?: string }[] = [];

  for (const s of splits as { username: string; amount: number }[]) {
    const uname = s.username.replace(/^@/, "").toLowerCase();
    const recipient = recipients?.find((r) => r.username === uname);
    if (!recipient?.wallet_address || recipient.id === sender.id) {
      results.push({ username: uname, ok: false, error: "invalid recipient" });
      continue;
    }
    try {
      const { transactionId } = await transferUSDC({
        fromWalletId: sender.circle_wallet_id,
        toAddress: recipient.wallet_address,
        amountUsdc: String(s.amount),
        userId: sender.id,
      });

      const { data: payment } = await admin
        .from("payments")
        .insert({
          from_user_id: sender.id,
          to_user_id: recipient.id,
          amount_usdc: s.amount,
          note: note ?? null,
          source_chain: "ARC",
          tx_hash: transactionId,
          status: "completed",
          circle_id: id,
        })
        .select()
        .single();

      await recordActivity([
        {
          user_id: recipient.id,
          type: "payment_received",
          reference_id: payment?.id,
          actor_id: sender.id,
          amount_usdc: s.amount,
          note: note ?? null,
        },
      ]);
      results.push({ username: uname, ok: true });
    } catch (e) {
      console.error(`Circle send to ${uname} failed:`, e);
      results.push({ username: uname, ok: false, error: "transfer failed" });
    }
  }

  return NextResponse.json({ results });
}
