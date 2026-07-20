import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** POST /api/auth/send-otp — body: { phone?, email? } */
export async function POST(req: Request) {
  const { phone, email } = await req.json();
  if (!phone && !email) {
    return NextResponse.json({ error: "phone or email required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = phone
    ? await admin.auth.signInWithOtp({ phone })
    : await admin.auth.signInWithOtp({ email });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
