"use client";

import { useEffect, useState } from "react";

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID;

/**
 * An installed app is resumed from memory, not reloaded, so it can keep running an old version
 * after a deploy. When the app comes back to the foreground, ask the server which build is live
 * and offer a refresh if it differs from the one running here. Production only.
 */
export default function UpdatePrompt() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !BUILD) return;

    async function check() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { build } = (await res.json()) as { build: string | null };
        if (build && build !== BUILD) setStale(true);
      } catch {
        // Offline or a blip: try again next time the app is opened.
      }
    }

    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
    };
  }, []);

  if (!stale) return null;

  return (
    <div
      role="status"
      className="pb-safe animate-slide-up fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-4 lg:pb-6"
    >
      <div className="mb-16 flex w-full max-w-md items-center gap-3 rounded-xl border border-accent-line bg-surface p-3 shadow-e4 lg:mb-0">
        <p className="min-w-0 flex-1 text-sm font-semibold text-ink">A new version of Coven is available.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full bg-accent px-4 text-xs font-bold text-white transition-[background-color,scale] duration-200 hover:bg-accent/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
