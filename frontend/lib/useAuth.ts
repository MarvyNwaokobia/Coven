"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "./supabase";
import { api } from "./api-client";
import type { User } from "./types";

/**
 * Module-level cache + subscriber list. The app shell and the page inside it
 * both need the current user; without this they'd each hit /api/me.
 */
let cachedUser: User | null = null;
let inFlight: Promise<User | null> | null = null;
const subscribers = new Set<(u: User | null) => void>();

function broadcast(u: User | null) {
  cachedUser = u;
  subscribers.forEach((fn) => fn(u));
}

function loadUser(): Promise<User | null> {
  if (cachedUser) return Promise.resolve(cachedUser);
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    try {
      const { user } = await api<{ user: User }>("/api/me");
      broadcast(user);
      return user;
    } catch {
      return null;
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Clears the cached identity - call on sign-out. */
export function clearAuthCache() {
  cachedUser = null;
  inFlight = null;
}

/**
 * Client auth hook. Loads the session + profile; redirects to /signup
 * when unauthenticated (unless optional = true).
 */
export function useAuth(options?: { optional?: boolean }) {
  const optional = options?.optional ?? false;
  const [user, setUserState] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    subscribers.add(setUserState);

    loadUser().then((u) => {
      if (cancelled) return;
      setUserState(u);
      setLoading(false);
      if (!u && !optional) router.replace("/signup");
    });

    return () => {
      cancelled = true;
      subscribers.delete(setUserState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Updater that keeps the shared cache in sync with local edits. */
  function setUser(update: User | null | ((prev: User | null) => User | null)) {
    broadcast(typeof update === "function" ? update(cachedUser) : update);
  }

  return { user, loading, setUser, signOut };
}

export async function signInWithGoogle() {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  clearAuthCache();
  await getSupabaseBrowser().auth.signOut();
  window.location.href = "/";
}
