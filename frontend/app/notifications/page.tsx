"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { SkeletonList, EmptyState } from "@/components/ui";
import { NotificationBellIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { relativeTime } from "@/lib/format";
import type { Notification } from "@/lib/types";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Notification[] | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ notifications: Notification[] }>("/api/notifications")
      .then(({ notifications }) => {
        setList(notifications);
        api("/api/notifications/mark-read", { json: {} }).catch(() => {});
      })
      .catch(() => setList([]));
  }, [user]);

  const unread = list?.filter((n) => !n.read).length ?? 0;

  return (
    <AppShell
      title="Notifications"
      subtitle={unread > 0 ? `${unread} unread` : undefined}
      back
    >
      <div className="mx-auto max-w-2xl">
        {list === null ? (
          <SkeletonList rows={5} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<NotificationBellIcon className="h-5 w-5" />}
            title="All caught up"
            subtitle="Payment requests, split invites and incoming transfers will show up here."
          />
        ) : (
          <ul className="stagger space-y-2.5">
            {list.map((n, i) => (
              <li
                key={n.id}
                style={{ ["--i" as string]: i }}
                className={`rounded-xl border p-4 shadow-e1 transition-colors duration-200 ${
                  n.read
                    ? "border-line bg-surface"
                    : "border-accent-line bg-accent-soft/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink">
                    {!n.read && (
                      <span
                        aria-label="Unread"
                        className="h-2 w-2 shrink-0 rounded-full bg-accent"
                      />
                    )}
                    <span className="min-w-0 truncate">{n.title}</span>
                  </p>
                  <span className="shrink-0 text-[0.6875rem] font-semibold text-ink-mute">
                    {relativeTime(n.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
