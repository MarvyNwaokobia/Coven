"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Spinner } from "@/components/ui";
import { GoogleIcon } from "@/components/Icons";
import { signInWithGoogle } from "@/lib/useAuth";

export default function SignupPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-slate-50/60 text-slate-900 flex flex-col items-center justify-center p-4 antialiased">
      {/* Background Watermark */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none opacity-[0.035] text-[#0a192f]">
        <svg
          className="absolute -top-16 -right-16 w-96 h-96 -rotate-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block font-extrabold text-2xl tracking-tight text-[#0a192f]">
            Pay<span className="text-blue-600">Circle</span>
          </Link>
          <p className="text-xs font-semibold text-slate-500">
            Social USDC Payments on Arc
          </p>
        </div>

        <Card className="py-8 space-y-5 text-center">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Welcome to PayCircle</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto font-medium">
              Sign in or create your account using your Google account to get started.
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 rounded-full bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm py-3.5 px-4 border border-slate-300 shadow-2xs transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? (
              <Spinner />
            ) : (
              <>
                <GoogleIcon />
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {error && <p className="text-red-600 text-xs font-medium text-center">{error}</p>}
        </Card>

        <p className="text-center text-xs font-semibold text-slate-400">
          Secured by Supabase & Circle User-Controlled Wallets
        </p>
      </div>
    </div>
  );
}
