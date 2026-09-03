import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";
import { createContractExecutionChallenge, getCircleUserToken, getUsdcAllowance } from "@/lib/circle/wallets";
import { getSplitForParticipant, readSplitState, SPLIT_STATUS, splitEscrowAddress } from "@/lib/server/splits";

/**
 * POST /api/splits/[splitId]/pay-challenge
 * A member pays their share into SplitEscrow: an approve() for exactly their share if the
 * allowance is short, then pay(). The client calls this after each step; `step` says which
 * challenge it just got. The recipient and amount passed to pay() come from the contract and are
 * checked by it, so the payer signs for exactly what the split says and nothing else.
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
  const found = await getSplitForParticipant(splitId, user.id);
  if (!found || !found.isMember) {
    return NextResponse.json({ error: "Split not found or you do not owe a share" }, { status: 404 });
  }
  if (!found.split.contract_split_id) {
    return NextResponse.json({ error: "This split is not held in escrow" }, { status: 409 });
  }

  try {
    const chain = await readSplitState(found.split.contract_split_id, user.wallet_address);
    if (chain.status !== SPLIT_STATUS.Open) {
      return NextResponse.json({ error: "This split is no longer open" }, { status: 409 });
    }
    if (chain.owedByWallet === BigInt(0)) {
      return NextResponse.json({ error: "You do not owe a share in this split" }, { status: 409 });
    }
    if (chain.paidByWallet) return NextResponse.json({ error: "You have already paid" }, { status: 409 });

    const { userToken, encryptionKey } = await getCircleUserToken(user.id);
    const allowance = await getUsdcAllowance(user.wallet_address, splitEscrowAddress());
    if (allowance < chain.owedByWallet) {
      const { challengeId } = await createContractExecutionChallenge({
        userToken,
        walletId: user.circle_wallet_id,
        contractAddress: process.env.ARC_USDC_ADDRESS!,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [splitEscrowAddress(), chain.owedByWallet.toString()],
      });
      return NextResponse.json({ step: "approve", userToken, encryptionKey, challengeId });
    }

    const { challengeId } = await createContractExecutionChallenge({
      userToken,
      walletId: user.circle_wallet_id,
      contractAddress: splitEscrowAddress(),
      abiFunctionSignature: "pay(bytes32,address,uint256)",
      abiParameters: [found.split.contract_split_id, chain.recipient, chain.owedByWallet.toString()],
    });
    return NextResponse.json({ step: "pay", userToken, encryptionKey, challengeId });
  } catch (e) {
    console.error("Split payment challenge failed:", e);
    return NextResponse.json({ error: "Could not start payment" }, { status: 502 });
  }
}
