import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { createContractExecutionChallenge, getCircleUserToken } from "@/lib/circle/wallets";
import { goalPoolAddress, usdcBaseUnits } from "@/lib/server/goals";

/**
 * POST /api/goals/create-challenge
 * body: { circleId, memberUsernames: string[], targetAmountUsdc, description }
 * memberUsernames are ADDITIONAL members beyond the creator, who is always
 * included automatically. Everyone must already be a member of the circle.
 */
export async function POST(req: Request) {
  const creator = await getAuthedUser(req);
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!creator.circle_wallet_id || !creator.wallet_address) {
    return NextResponse.json({ error: "Wallet not set up yet" }, { status: 400 });
  }

  const { circleId, memberUsernames, targetAmountUsdc, description } = await req.json();
  const target = Number(targetAmountUsdc);
  if (!circleId || !description?.trim() || !target || target <= 0) {
    return NextResponse.json(
      { error: "circleId, description, and positive targetAmountUsdc required" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

  const { data: circleMembers } = await admin
    .from("circle_members")
    .select("user_id")
    .eq("circle_id", circleId);
  const circleMemberIds = new Set((circleMembers ?? []).map((m) => m.user_id));
  if (!circleMemberIds.has(creator.id)) {
    return NextResponse.json({ error: "Not a member of this circle" }, { status: 403 });
  }

  const cleaned: string[] = Array.isArray(memberUsernames)
    ? memberUsernames.map((u: string) => u.replace(/^@/, "").toLowerCase())
    : [];

  const { data: resolvedMembers } = await admin
    .from("users")
    .select("id, username, wallet_address")
    .in("username", cleaned);

  const missing = cleaned.filter((u) => !(resolvedMembers ?? []).some((m) => m.username === u));
  if (missing.length > 0) {
    return NextResponse.json({ error: `Users not found: ${missing.join(", ")}` }, { status: 404 });
  }
  const notInCircle = (resolvedMembers ?? []).filter((m) => !circleMemberIds.has(m.id));
  if (notInCircle.length > 0) {
    return NextResponse.json(
      { error: `Not circle members: ${notInCircle.map((m) => m.username).join(", ")}` },
      { status: 400 }
    );
  }
  const noWallet = (resolvedMembers ?? []).filter((m) => !m.wallet_address);
  if (noWallet.length > 0) {
    return NextResponse.json(
      { error: `No wallet yet: ${noWallet.map((m) => m.username).join(", ")}` },
      { status: 400 }
    );
  }

  const allAddresses = Array.from(
    new Set([creator.wallet_address, ...(resolvedMembers ?? []).map((m) => m.wallet_address as string)])
  );

  try {
    const { userToken, encryptionKey } = await getCircleUserToken(creator.id);
    const { challengeId } = await createContractExecutionChallenge({
      userToken,
      walletId: creator.circle_wallet_id,
      contractAddress: goalPoolAddress(),
      abiFunctionSignature: "createGoal(address[],uint256,string)",
      abiParameters: [allAddresses, usdcBaseUnits(target), description],
    });
    return NextResponse.json({ userToken, encryptionKey, challengeId });
  } catch (e) {
    console.error("Goal creation challenge failed:", e);
    return NextResponse.json({ error: "Could not start goal creation" }, { status: 502 });
  }
}
