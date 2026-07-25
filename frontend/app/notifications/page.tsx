"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import ActivityRow from "@/components/ActivityRow";
import { Card, Spinner, EmptyState, Button } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import type { ActivityItem } from "@/lib/types";

type NotificationItem = ActivityItem & { read: boolean };

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(() => {
    api<{ activity: NotificationItem[] }>("/api/activity")
      .then(({ activity }) => setItems(activity))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function markRead(id: string) {
    setItems((prev) => prev?.map((i) => (i.id === id ? { ...i, read: true } : i)) ?? null);
    try {
      await api("/api/activity/read", { json: { ids: [id] } });
    } catch {
      // best-effort — badge count will self-correct on next poll either way
    }
  }

  async function markAllRead() {
    setMarking(true);
    setItems((prev) => prev?.map((i) => ({ ...i, read: true })) ?? null);
    try {
      await api("/api/activity/read", { json: { all: true } });
    } finally {
      setMarking(false);
    }
  }

  const hasUnread = items?.some((i) => !i.read) ?? false;

  return (
    <AppShell title="Notifications" back>
      {items === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          emoji="🔔"
          title="No notifications yet"
          subtitle="Payments, requests, and invites will show up here"
        />
      ) : (
        <div className="space-y-3">
          {hasUnread && (
            <div className="flex justify-end">
              <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={markAllRead} disabled={marking}>
                Mark all as read
              </Button>
            </div>
          )}
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <button className="w-full text-left" onClick={() => !item.read && markRead(item.id)}>
                  <Card
                    className={
                      item.read ? "" : "border-accent/50 bg-accent/5 relative"
                    }
                  >
                    {!item.read && (
                      <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent" />
                    )}
                    <ActivityRow item={item} />
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
