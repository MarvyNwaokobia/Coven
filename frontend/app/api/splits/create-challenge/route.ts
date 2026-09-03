import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { createContractExecutionChallenge, getCircleUserToken } from "@/lib/circle/wallets";
import { splitEscrowAddress } from "@/lib/server/splits";
import { usdcBaseUnits } from "@/lib/server/goals";
import { roundUsdc } from "@/lib/server/offramp";

const MAX_MEMBERS = 49; // SplitEscrow allows 50; the creator is not one of them
const MAX_SHARE_USDC = 1_000_000;
const DEFAULT_DEADLINE_HOURS = 72;
const MAX_DEADLINE_HOURS = 24 * 30;

/**
 * POST /api/splits/create-challenge
 * body: { circleId, memberUsernames: string[], amounts: number[], description, deadlineHours? }
 * Starts a PIN challenge for SplitEscrow.createSplit with the creator as the recipient: members
 * pay into escrow, and the collected total is released to the creator once everyone has paid.
 * Everyone named must belong to the circle, so a split cannot be used to notify or bill strangers.
 */
export async function POST(req: Request) {
  const creator = await getAuthedUser(req);
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!creator.circle_wallet_id || !creator.wallet_address) {
    return NextResponse.json({ error: "Wallet not set up yet" }, { status: 400 });
  }

  const { circleId, memberUsernames, amounts, description, deadlineHours } = await req.json();

  const text = typeof description === "string" ? description.trim() : "";
  if (!circleId || !text || text.length > 120) {
    return NextResponse.json({ error: "circleId and a description of up to 120 characters are required" }, { status: 400 });
  }
  if (!Array.isArray(memberUsernames) || !Array.isArray(amounts) || memberUsernames.length !== amounts.length) {
    return NextResponse.json({ error: "amounts must match memberUsernames" }, { status: 400 });
  }
  if (memberUsernames.length === 0 || memberUsernames.length > MAX_MEMBERS) {
    return NextResponse.json({ error: `A split needs between 1 and ${MAX_MEMBERS} other members` }, { status: 400 });
  }

  const cleaned: string[] = memberUsernames.map((u: unknown) => String(u).replace(/^@/, "").toLowerCase());
  if (new Set(cleaned).size !== cleaned.length) {
    return NextResponse.json({ error: "Each member can only appear once" }, { status: 400 });
  }
  const shares = amounts.map((a: unknown) => roundUsdc(Number(a)));
  if (shares.some((a: number) => !Number.isFinite(a) || a <= 0 || a > MAX_SHARE_USDC)) {
    return NextResponse.json({ error: "Every share must be a positive amount" }, { status: 400 });
  }

  const hours = deadlineHours === undefined ? DEFAULT_DEADLINE_HOURS : Number(deadlineHours);
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_DEADLINE_HOURS) {
    return NextResponse.json({ error: `deadlineHours must be a whole number from 1 to ${MAX_DEADLINE_HOURS}` }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: circleMembers } = await admin.from("circle_members").select("user_id").eq("circle_id", circleId);
  const circleMemberIds = new Set((circleMembers ?? []).map((m) => m.user_id as string));
  if (!circleMemberIds.has(creator.id)) {
    return NextResponse.json({ error: "Not a member of this circle" }, { status: 403 });
  }

  const { data: resolved } = await admin.from("users").select("id, username, wallet_address").in("username", cleaned);
  const byName = new Map((resolved ?? []).map((u) => [u.username as string, u]));
  const missing = cleaned.filter((u) => !byName.has(u));
  if (missing.length > 0) return NextResponse.json({ error: `Users not found: ${missing.join(", ")}` }, { status: 404 });

  const ordered = cleaned.map((u) => byName.get(u)!);
  if (ordered.some((u) => u.id === creator.id)) {
    return NextResponse.json({ error: "You are the recipient, so you cannot also owe a share" }, { status: 400 });
  }
  const outsiders = ordered.filter((u) => !circleMemberIds.has(u.id));
  if (outsiders.length > 0) {
    return NextResponse.json({ error: `Not circle members: ${outsiders.map((u) => u.username).join(", ")}` }, { status: 400 });
  }
  const noWallet = ordered.filter((u) => !u.wallet_address);
  if (noWallet.length > 0) {
    return NextResponse.json({ error: `No wallet yet: ${noWallet.map((u) => u.username).join(", ")}` }, { status: 400 });
  }

  try {
    const { userToken, encryptionKey } = await getCircleUserToken(creator.id);
    const { challengeId } = await createContractExecutionChallenge({
      userToken,
      walletId: creator.circle_wallet_id,
      contractAddress: splitEscrowAddress(),
      abiFunctionSignature: "createSplit(address[],uint256[],address,string,uint256)",
      abiParameters: [
        ordered.map((u) => u.wallet_address as string),
        shares.map((a: number) => usdcBaseUnits(a)),
        creator.wallet_address,
        text,
        String(hours),
      ],
    });
    return NextResponse.json({ userToken, encryptionKey, challengeId });
  } catch (e) {
    console.error("Split creation challenge failed:", e);
    return NextResponse.json({ error: "Could not start split creation" }, { status: 502 });
  }
}
