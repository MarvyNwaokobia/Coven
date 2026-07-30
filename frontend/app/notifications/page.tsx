"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, Spinner, EmptyState, StatusChip } from "@/components/ui";
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

  return (
    <AppShell title="Notifications" back>
      {list === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<NotificationBellIcon className="w-6 h-6 text-slate-600" />}
          title="All caught up"
          subtitle="You'll see payment requests, split invites, and transfers here."
        />
      ) : (
        <ul className="space-y-2.5">
          {list.map((n) => (
            <li key={n.id}>
              <Card
                className={`space-y-1 py-3 transition-colors ${
                  n.read ? "bg-white" : "bg-blue-50/40 border-blue-200"
                }`}
              >
                <div className="flex justify-between items-start">
                  <p className="font-bold text-sm text-slate-900">{n.title}</p>
                  <span className="text-[11px] font-semibold text-slate-400">{relativeTime(n.created_at)}</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">{n.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
