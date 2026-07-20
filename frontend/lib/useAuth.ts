"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "./supabase";
import { api } from "./api-client";
import type { User } from "./types";

/**
 * Client auth hook. Loads the session + profile; redirects to /signup
 * when unauthenticated (unless optional = true).
 */
export function useAuth(options?: { optional?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!options?.optional) router.replace("/signup");
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const { user } = await api<{ user: User }>("/api/me");
        if (!cancelled) setUser(user);
      } catch {
        if (!options?.optional) router.replace("/signup");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading, setUser };
}

export async function signOut() {
  await getSupabaseBrowser().auth.signOut();
  window.location.href = "/";
}
