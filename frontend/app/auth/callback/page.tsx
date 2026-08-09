"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner, Alert, Button } from "@/components/ui";
import { CovenMark } from "@/components/Icons";
import { getSupabaseBrowser } from "@/lib/supabase";

/**
 * Lands here after Google redirects back from Supabase Auth. The Supabase
 * client auto-detects the session from the URL, so we wait for it, then
 * make sure our own users-table row + Circle wallet exist.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowser();

    async function finish() {
      // getSession() resolves once the client has parsed the URL fragment.
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;

      if (sessionError || !data.session) {
        setError(sessionError?.message ?? "Sign-in didn't complete. Try again.");
        return;
      }

      try {
        const res = await fetch("/api/auth/ensure-profile", {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not set up your account");
        router.replace(body.needsOnboarding ? "/onboard" : "/home");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong");
      }
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas px-6 py-10 text-ink">
      <CovenMark className="h-10 w-10 text-accent" />

      {error ? (
        <div className="w-full max-w-sm space-y-4">
          <Alert>{error}</Alert>
          <Button variant="secondary" fullWidth onClick={() => router.replace("/signup")}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 text-sm font-medium text-ink-soft">
          <Spinner />
          Signing you in…
        </div>
      )}
    </div>
  );
}
