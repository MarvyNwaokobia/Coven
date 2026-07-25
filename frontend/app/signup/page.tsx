"use client";

import { useState } from "react";
import { Card, Button } from "@/components/ui";
import { getSupabaseBrowser } from "@/lib/supabase";

/** Sign in with Google — Supabase Auth handles the OAuth redirect + session. */
export default function SignupPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    const { error } = await getSupabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
    // On success the browser redirects to Google — nothing else to do here.
  }

  return (
    <div className="mx-auto w-full max-w-md flex-1 flex flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-extrabold mb-1">
        Welcome to Pay<span className="text-primary">Circle</span>
      </h1>
      <p className="text-text-2 text-sm mb-8">
        Sign in with Google to get your @username and Arc wallet.
      </p>

      <Card className="space-y-4">
        <Button className="w-full" onClick={signInWithGoogle} disabled={busy}>
          {busy ? "Redirecting…" : "Continue with Google"}
        </Button>
        {error && <p className="text-danger text-sm">{error}</p>}
      </Card>
    </div>
  );
}
