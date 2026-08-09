import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { createContractExecutionChallenge, getCircleUserToken } from "@/lib/circle/wallets";
import { getGoalForMember, goalPoolAddress } from "@/lib/server/goals";

/**
 * POST /api/goals/[goalId]/withdraw-request-challenge - body: { recipientUsername }
 * Requests to withdraw the FULL pooled balance to a recipient. Only one
 * request may be pending per goal - every other member must approve
 * before funds move (see withdraw-approve-*).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.circle_wallet_id) {
    return NextResponse.json({ error: "Wallet not set up yet" }, { status: 400 });
  }

  const { goalId } = await params;
  const { recipientUsername } = await req.json();
  if (!recipientUsername) {
    return NextResponse.json({ error: "recipientUsername required" }, { status: 400 });
  }

  const found = await getGoalForMember(goalId, user.id);
  if (!found) return NextResponse.json({ error: "Goal not found or not a member" }, { status: 404 });
  if (found.goal.status !== "open") {
    return NextResponse.json({ error: `Goal is ${found.goal.status}` }, { status: 409 });
  }
  if (Number(found.goal.collected_usdc) <= 0) {
    return NextResponse.json({ error: "Nothing has been contributed yet" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: pending } = await admin
    .from("goal_withdrawal_requests")
    .select("id")
    .eq("goal_id", goalId)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    return NextResponse.json({ error: "A withdrawal request is already pending" }, { status: 409 });
  }

  const { data: recipient } = await admin
    .from("users")
    .select("id, wallet_address")
    .eq("username", String(recipientUsername).replace(/^@/, "").toLowerCase())
    .maybeSingle();
  if (!recipient?.wallet_address) {
    return NextResponse.json({ error: "Recipient not found or has no wallet" }, { status: 404 });
  }

  try {
    const { userToken, encryptionKey } = await getCircleUserToken(user.id);
    const { challengeId } = await createContractExecutionChallenge({
      userToken,
      walletId: user.circle_wallet_id,
      contractAddress: goalPoolAddress(),
      abiFunctionSignature: "requestWithdrawal(bytes32,address)",
      abiParameters: [found.goal.contract_goal_id as string, recipient.wallet_address],
    });
    return NextResponse.json({ userToken, encryptionKey, challengeId });
  } catch (e) {
    console.error("Withdrawal request challenge failed:", e);
    return NextResponse.json({ error: "Could not start withdrawal request" }, { status: 502 });
  }
}
