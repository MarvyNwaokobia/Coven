"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { NotificationBellIcon } from "./Icons";

const POLL_MS = 30_000;

/** Bell with an unread-count badge, linking to /notifications. */
export default function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      // Skip work while the tab is hidden; it resyncs on focus anyway.
      if (document.visibilityState === "hidden") return;
      try {
        const { count } = await api<{ count: number }>("/api/notifications/unread-count");
        if (!cancelled) setCount(count);
      } catch {
        // Stay quiet; the bell just won't update this cycle.
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-[background-color,color,translate,scale] duration-200 ease-out-soft hover:bg-surface-2 hover:text-ink active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <NotificationBellIcon className="h-5 w-5" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="tnum animate-scale-in absolute right-1.5 top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-neg px-1 text-[10px] font-bold text-white ring-2 ring-surface"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
