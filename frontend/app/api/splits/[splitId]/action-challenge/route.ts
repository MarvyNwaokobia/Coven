import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";
import { createContractExecutionChallenge, getCircleUserToken } from "@/lib/circle/wallets";
import { getSplitForParticipant, readSplitState, splitEscrowAddress } from "@/lib/server/splits";
import { isSplitAction, SPLIT_ACTION_SIGNATURE, splitActionBlockedReason } from "@/lib/server/split-actions";

/**
 * POST /api/splits/[splitId]/action-challenge - body: { action }
 * action: "cancel" | "expire" | "claim-refund"
 * The contract's own state decides whether the action is allowed; nothing in the request body is
 * trusted beyond which action was asked for.
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
    const chain = await readSplitState(found.split.contract_split_id, user.wallet_address);
    const blocked = splitActionBlockedReason(action, chain, user.wallet_address);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

    const { userToken, encryptionKey } = await getCircleUserToken(user.id);
    const { challengeId } = await createContractExecutionChallenge({
      userToken,
      walletId: user.circle_wallet_id,
      contractAddress: splitEscrowAddress(),
      abiFunctionSignature: SPLIT_ACTION_SIGNATURE[action],
      abiParameters: [found.split.contract_split_id],
    });
    return NextResponse.json({ userToken, encryptionKey, challengeId });
  } catch (e) {
    console.error("Split action challenge failed:", e);
    return NextResponse.json({ error: "Could not start this action" }, { status: 502 });
  }
}
