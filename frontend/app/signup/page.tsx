"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card } from "@/components/ui";
import { getSupabaseBrowser } from "@/lib/supabase";

/** Phone/email signup with OTP verification. */
export default function SignupPage() {
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"contact" | "otp">("contact");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const payload = method === "email" ? { email: contact } : { phone: contact };

  async function sendOtp() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, otp }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);

      // Adopt the session client-side
      await getSupabaseBrowser().auth.setSession({
        access_token: body.session.access_token,
        refresh_token: body.session.refresh_token,
      });

      router.replace(body.needsOnboarding ? "/onboard" : "/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md flex-1 flex flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-extrabold mb-1">
        Welcome to Pay<span className="text-primary">Circle</span>
      </h1>
      <p className="text-text-2 text-sm mb-8">
        {step === "contact"
          ? "Enter your email or phone — we'll send a one-time code."
          : `Enter the 6-digit code we sent to ${contact}.`}
      </p>

      <Card className="space-y-4">
        {step === "contact" ? (
          <>
            <div className="flex rounded-full bg-surface-2 p-1 text-sm font-medium">
              {(["email", "phone"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 rounded-full py-2 capitalize transition-colors ${
                    method === m ? "bg-primary text-white" : "text-text-2"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <Input
              type={method === "email" ? "email" : "tel"}
              placeholder={method === "email" ? "you@example.com" : "+2348012345678"}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
            <Button className="w-full" onClick={sendOtp} disabled={busy || !contact}>
              {busy ? "Sending…" : "Send code"}
            </Button>
          </>
        ) : (
          <>
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              className="text-center text-2xl tracking-[0.5em] amount"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
            <Button className="w-full" onClick={verifyOtp} disabled={busy || otp.length < 6}>
              {busy ? "Verifying…" : "Verify"}
            </Button>
            <button
              className="w-full text-sm text-text-2 hover:text-text"
              onClick={() => setStep("contact")}
            >
              Use a different {method}
            </button>
          </>
        )}
        {error && <p className="text-danger text-sm">{error}</p>}
      </Card>
    </div>
  );
}
