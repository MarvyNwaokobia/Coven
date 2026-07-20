import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import { initiateOfframp, getExchangeRate, BankDetails } from "@/lib/yellowcard/offramp";
import { recordActivity } from "@/lib/server/activity";

/**
 * POST /api/cashout/initiate — body: { amountUsdc, bankAccountId }
 * 1% platform fee, then Yellow Card payout with the net amount.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amountUsdc, bankAccountId } = await req.json();
  const amount = Number(amountUsdc);
  if (!amount || amount <= 0 || !bankAccountId) {
    return NextResponse.json({ error: "amountUsdc and bankAccountId required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: bank } = await admin
    .from("bank_accounts")
    .select("*")
    .eq("id", bankAccountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!bank) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

  const fee = Math.round(amount * 0.01 * 1e6) / 1e6; // 1%
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
      target_currency: bank.currency,
      bank_account_id: bank.id,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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
    return NextResponse.json({ error: "Cash out failed — try again" }, { status: 502 });
  }
}

/** GET /api/cashout/initiate?currency=NGN — live rate preview. */
export async function GET(req: Request) {
  const currency = new URL(req.url).searchParams.get("currency") ?? "NGN";
  const { rate, fee } = await getExchangeRate(currency);
  return NextResponse.json({ rate, providerFee: fee, platformFeeBps: 100 });
}
