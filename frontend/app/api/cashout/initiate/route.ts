import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import { initiateOfframp, getExchangeRate, BankDetails } from "@/lib/yellowcard/offramp";
import { recordActivity } from "@/lib/server/activity";
import { resolveAndVerifyRecentTransfer } from "@/lib/circle/wallets";
import { offrampCollectionAddress, roundUsdc } from "@/lib/server/offramp";

/**
 * POST /api/cashout/initiate - body: { amountUsdc, bankAccountId }
 * The client must have already run a PIN challenge via
 * /api/circle/transfer-challenge ({ kind: "cashout" }), moving the full
 * amount to the platform collection wallet. We verify that transfer settled
 * and has not funded a payout before, then take the 1% platform fee and
 * request a Yellow Card payout of the net amount. Nothing is paid out
 * against a deposit we have not seen.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amountUsdc, bankAccountId } = await req.json();
  const amount = roundUsdc(Number(amountUsdc));
  if (!amount || amount <= 0 || !bankAccountId) {
    return NextResponse.json({ error: "amountUsdc and bankAccountId required" }, { status: 400 });
  }

  const collection = offrampCollectionAddress();
  if (!collection) {
    return NextResponse.json({ error: "Cash out is not available right now" }, { status: 503 });
  }
  if (!user.circle_wallet_id) {
    return NextResponse.json({ error: "Your wallet is not provisioned yet" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: bank } = await admin
    .from("bank_accounts")
    .select("*")
    .eq("id", bankAccountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!bank) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

  let depositTxHash: string | null;
  try {
    ({ txHash: depositTxHash } = await resolveAndVerifyRecentTransfer({
      userId: user.id,
      walletId: user.circle_wallet_id,
      destinationAddress: collection,
      amountUsdc: amount,
    }));
  } catch (e) {
    console.error("Cash out deposit verification failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Your USDC transfer could not be verified" },
      { status: 502 }
    );
  }
  if (!depositTxHash) {
    // Without a hash we cannot guarantee the deposit only funds one payout.
    return NextResponse.json(
      { error: "Your transfer has no transaction hash yet - try again shortly" },
      { status: 502 }
    );
  }

  const fee = roundUsdc(amount * 0.01); // 1%
  const net = amount - fee;

  const bankDetails: BankDetails = {
    accountNumber: decrypt(bank.account_number_encrypted),
    bankCode: bank.bank_code,
    accountName: bank.account_name,
    country: bank.country,
    currency: bank.currency,
  };

  // Create the payout record first so failures are visible/retryable
  const { data: payout, error } = await admin
    .from("offramp_payouts")
    .insert({
      user_id: user.id,
      amount_usdc: amount,
      fee_usdc: fee,
      net_usdc: net,
      deposit_tx_hash: depositTxHash,
      target_currency: bank.currency,
      bank_account_id: bank.id,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This transfer has already been used for a cash out" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    const result = await initiateOfframp(net, bankDetails, payout.id);
    await admin
      .from("offramp_payouts")
      .update({
        yellow_card_payout_id: result.payoutId,
        expected_amount: result.expectedAmount,
        status: "processing",
      })
      .eq("id", payout.id);

    return NextResponse.json({
      payout: { ...payout, status: "processing" },
      expectedAmount: result.expectedAmount,
      estimatedArrival: result.estimatedArrival,
    });
  } catch (e) {
    console.error("Offramp initiation failed:", e);
    await admin.from("offramp_payouts").update({ status: "failed" }).eq("id", payout.id);
    await recordActivity([
      {
        user_id: user.id,
        type: "offramp_failed",
        reference_id: payout.id,
        amount_usdc: amount,
      },
    ]);
    // The user's USDC is already with us at this point, so "try again" would make
    // them pay twice. The deposit is recorded on the failed payout for support.
    return NextResponse.json(
      {
        error: `Cash out could not be completed. Your USDC transfer was received - contact support with reference ${payout.id}.`,
      },
      { status: 502 }
    );
  }
}

/** GET /api/cashout/initiate?currency=NGN - live rate preview. */
export async function GET(req: Request) {
  const currency = new URL(req.url).searchParams.get("currency") ?? "NGN";
  const { rate, fee } = await getExchangeRate(currency);
  return NextResponse.json({ rate, providerFee: fee, platformFeeBps: 100 });
}
