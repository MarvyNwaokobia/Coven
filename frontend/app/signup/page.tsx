"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Spinner, Alert } from "@/components/ui";
import { GoogleIcon, CovenMark, CheckCircleIcon, ArrowLeftIcon } from "@/components/Icons";
import { signInWithGoogle } from "@/lib/useAuth";

const PERKS = [
  "Your own @handle people can pay",
  "No seed phrase, just a PIN",
  "Cash out to your bank in 20+ countries",
];

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
    <div className="relative flex min-h-dvh flex-col bg-canvas px-5 py-8 text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-3xl max-w-[130vw] -translate-x-1/2 rounded-full bg-accent/8 blur-3xl"
      />

      <Link
        href="/"
        className="relative inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-soft transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back
      </Link>

      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="animate-fade-up text-center">
          <CovenMark className="mx-auto h-10 w-10 text-accent" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Welcome to Coven</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Social USDC payments on Arc. Sign in to claim your handle. It takes
            about a minute.
          </p>
        </div>

        <Card className="animate-fade-up mt-7 space-y-5 p-6" >
          <button
            onClick={handleGoogleLogin}
            disabled={busy}
            className="flex min-h-13 w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-line-strong bg-surface px-4 text-sm font-bold text-ink shadow-e1 transition-[background-color,border-color,box-shadow,translate,scale] duration-200 ease-out-soft hover:border-ink hover:bg-surface-2 hover:shadow-e2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {busy ? (
              <>
                <Spinner /> Redirecting to Google…
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          {error && <Alert>{error}</Alert>}

          <ul className="space-y-2.5 border-t border-line pt-5">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-xs font-medium text-ink-soft">
                <CheckCircleIcon className="mt-px h-4 w-4 shrink-0 text-pos" />
                {p}
              </li>
            ))}
          </ul>
        </Card>

        <p className="mt-6 text-center text-xs text-ink-mute">
          Secured by Supabase auth &amp; Circle user-controlled wallets.
        </p>
      </div>
    </div>
  );
}
