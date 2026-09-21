import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { getCircleUserToken, createTransferChallenge } from "@/lib/circle/wallets";
import { offrampCollectionAddress, offrampCredentialsConfigured, roundUsdc } from "@/lib/server/offramp";

type ChallengeRequest =
  | { kind: "send"; toUsername: string; amountUsdc: number }
  | { kind: "circle-member"; toUsername: string; amountUsdc: number }
  | { kind: "request"; requestId: string }
  | { kind: "split"; splitId: string }
  | { kind: "cashout"; amountUsdc: number };

/**
 * POST /api/circle/transfer-challenge
 * Starts a USDC transfer challenge for the authed user's wallet. Returns
 * the userToken/encryptionKey/challengeId the client needs to run the PIN
 * widget; Circle does not move funds until that challenge is approved.
 *
 * Recipient + amount are resolved here, server-side - for "request" and
 * "split" the amount is always read from our own DB state, never trusted
 * from the client, so a tampered client request can't move more than what's
 * actually owed.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.circle_wallet_id) {
    return NextResponse.json({ error: "Wallet not set up yet" }, { status: 400 });
  }

  const body = (await req.json()) as ChallengeRequest;
  const admin = getSupabaseAdmin();

  let destinationAddress: string;
  let amount: number;

  try {
    if (body.kind === "send" || body.kind === "circle-member") {
      amount = Number(body.amountUsdc);
      if (!body.toUsername || !amount || amount <= 0) {
        return NextResponse.json(
          { error: "toUsername and positive amountUsdc required" },
          { status: 400 }
        );
      }
      const { data: recipient } = await admin
        .from("users")
        .select("id, wallet_address")
        .eq("username", body.toUsername.replace(/^@/, "").toLowerCase())
        .maybeSingle();
      if (!recipient?.wallet_address || recipient.id === user.id) {
        return NextResponse.json({ error: "Invalid recipient" }, { status: 404 });
      }
      destinationAddress = recipient.wallet_address;
    } else if (body.kind === "request") {
      const { data: request } = await admin
        .from("payment_requests")
        .select("amount_usdc, status, to_user_id, from_user:users!payment_requests_from_user_id_fkey(wallet_address)")
        .eq("id", body.requestId)
        .maybeSingle();
      if (!request || request.to_user_id !== user.id) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }
      if (request.status !== "pending") {
        return NextResponse.json({ error: `Request is ${request.status}` }, { status: 409 });
      }
      const fromUser = request.from_user as unknown as { wallet_address: string | null };
      if (!fromUser?.wallet_address) {
        return NextResponse.json({ error: "Requester has no wallet" }, { status: 400 });
      }
      destinationAddress = fromUser.wallet_address;
      amount = Number(request.amount_usdc);
    } else if (body.kind === "split") {
      const { data: split } = await admin
        .from("splits")
        .select("status, creator:users!splits_creator_id_fkey(wallet_address)")
        .eq("id", body.splitId)
        .maybeSingle();
      if (!split) return NextResponse.json({ error: "Split not found" }, { status: 404 });
      if (split.status !== "open") {
        return NextResponse.json({ error: `Split is ${split.status}` }, { status: 409 });
      }
      const { data: share } = await admin
        .from("split_members")
        .select("amount_owed_usdc, paid")
        .eq("split_id", body.splitId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!share) return NextResponse.json({ error: "You're not part of this split" }, { status: 403 });
      if (share.paid) return NextResponse.json({ error: "Already paid" }, { status: 409 });
      const creator = split.creator as unknown as { wallet_address: string | null };
      if (!creator?.wallet_address) {
        return NextResponse.json({ error: "Split creator has no wallet" }, { status: 400 });
      }
      destinationAddress = creator.wallet_address;
      amount = Number(share.amount_owed_usdc);
    } else if (body.kind === "cashout") {
      // Funds the payout: the full amount goes to the platform's collection
      // wallet, and /api/cashout/initiate verifies it before paying anyone.
      // Refused unless a payout can actually be made, so no USDC is taken for one that cannot.
      const collection = offrampCollectionAddress();
      if (!collection || !offrampCredentialsConfigured()) {
        return NextResponse.json({ error: "Cash out is not available right now" }, { status: 503 });
      }
      amount = roundUsdc(Number(body.amountUsdc));
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: "positive amountUsdc required" }, { status: 400 });
      }
      destinationAddress = collection;
    } else {
      return NextResponse.json({ error: "Unknown challenge kind" }, { status: 400 });
    }

    const { userToken, encryptionKey } = await getCircleUserToken(user.id);
    const { challengeId } = await createTransferChallenge({
      userToken,
      walletId: user.circle_wallet_id,
      destinationAddress,
      amountUsdc: String(amount),
    });

    return NextResponse.json({ userToken, encryptionKey, challengeId });
  } catch (e) {
    console.error("Transfer challenge creation failed:", e);
    return NextResponse.json({ error: "Could not start transfer" }, { status: 502 });
  }
}
