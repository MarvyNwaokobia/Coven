import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";
import { generatePaymentQR } from "@/lib/qr";

/** POST /api/qr/generate — body: { username?, amount?, currency?, note? } */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username, amount, currency, note } = await req.json();
  const dataUrl = await generatePaymentQR({
    username: username ?? user.username,
    amount: amount ? Number(amount) : undefined,
    currency,
    note,
  });

  return NextResponse.json({ qr: dataUrl });
}
