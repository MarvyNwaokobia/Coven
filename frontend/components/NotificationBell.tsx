"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

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
    <Link href="/notifications" className="relative text-lg" aria-label="Notifications">
      🔔
      {count > 0 && (
        <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
