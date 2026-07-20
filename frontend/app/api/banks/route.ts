import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { encrypt, last4 } from "@/lib/crypto";
import { NIGERIAN_BANKS } from "@/lib/yellowcard/offramp";

/** GET /api/banks — the user's saved bank accounts (numbers redacted). */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("bank_accounts")
    .select("id, bank_name, bank_code, account_name, country, currency, is_default, created_at, account_last4")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ accounts: data, banks: NIGERIAN_BANKS });
}

/**
 * POST /api/banks
 * body: { bankCode, accountNumber, accountName, country, currency, isDefault? }
 * Account numbers are AES-encrypted at rest.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bankCode, accountNumber, accountName, country, currency, isDefault } = await req.json();
  if (!bankCode || !accountNumber || !accountName || !country || !currency) {
    return NextResponse.json({ error: "All bank fields are required" }, { status: 400 });
  }

  const bankName =
    NIGERIAN_BANKS.find((b) => b.code === bankCode)?.name ?? bankCode;

  const admin = getSupabaseAdmin();

  if (isDefault) {
    await admin.from("bank_accounts").update({ is_default: false }).eq("user_id", user.id);
  }

  const { data, error } = await admin
    .from("bank_accounts")
    .insert({
      user_id: user.id,
      bank_name: bankName,
      bank_code: bankCode,
      account_number_encrypted: encrypt(String(accountNumber)),
      account_last4: last4(String(accountNumber)),
      account_name: accountName,
      country,
      currency,
      is_default: isDefault ?? false,
    })
    .select("id, bank_name, bank_code, account_name, country, currency, is_default, account_last4")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ account: data });
}
