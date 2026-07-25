"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import { getSupabaseBrowser } from "@/lib/supabase";

/**
 * Lands here after Google redirects back from Supabase Auth. The Supabase
 * client auto-detects the session from the URL — we just wait for it, then
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
        setError(sessionError?.message ?? "Sign-in didn't complete — try again.");
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
    <div className="mx-auto w-full max-w-md flex-1 flex flex-col items-center justify-center px-6 py-10 gap-4">
      {error ? (
        <>
          <p className="text-danger text-sm text-center">{error}</p>
          <button
            className="text-accent text-sm font-semibold"
            onClick={() => router.replace("/signup")}
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <Spinner />
          <p className="text-text-2 text-sm">Signing you in…</p>
        </>
      )}
    </div>
  );
}
