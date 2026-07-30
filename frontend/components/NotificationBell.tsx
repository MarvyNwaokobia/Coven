"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { NotificationBellIcon } from "./Icons";

const POLL_MS = 30_000;

/** Bell icon with an unread-count badge, linking to /notifications. */
export default function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const { count } = await api<{ count: number }>("/api/notifications/unread-count");
        if (!cancelled) setCount(count);
      } catch {
        // stay quiet — the bell just won't update this cycle
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      aria-label="Notifications"
    >
      <NotificationBellIcon className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-2xs">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
