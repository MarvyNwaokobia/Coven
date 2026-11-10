"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import InstallBanner from "@/components/InstallBanner";
import { SkeletonList, EmptyState } from "@/components/ui";
import { NotificationBellIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { relativeTime } from "@/lib/format";
import { useActivityRealtime, NOTIFICATIONS_READ_EVENT } from "@/lib/useActivityRealtime";
import type { Notification } from "@/lib/types";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Notification[] | null>(null);
  // Ids that were unread when fetched. The page marks everything read right away, so this keeps
  // them highlighted for the rest of the visit instead of flashing back to plain.
  const fresh = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const { notifications } = await api<{ notifications: Notification[] }>("/api/notifications");
      for (const n of notifications) if (!n.read) fresh.current.add(n.id);
      setList(notifications);
      if (notifications.some((n) => !n.read)) {
        api("/api/notifications/mark-read", { json: {} })
          .then(() => window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT)))
          .catch(() => {});
      }
    } catch {
      setList((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // New activity lands while the page is open: pull it in live.
  useActivityRealtime(user?.id, load);

  const unread = list?.filter((n) => fresh.current.has(n.id)).length ?? 0;

  return (
    <AppShell
      title="Notifications"
      subtitle={unread > 0 ? `${unread} unread` : undefined}
      back
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <InstallBanner message="Get these as alerts on your phone: install Coven, then turn on notifications in Settings." />
        {list === null ? (
          <SkeletonList rows={5} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<NotificationBellIcon className="h-5 w-5" />}
            title="All caught up"
            subtitle="Payment requests, split invites and incoming transfers will show up here."
          />
        ) : (
          <div className="space-y-5">
            {groupByDay(list).map(([label, items]) => (
              <section key={label}>
                <h2 className="mb-2 px-1 text-[0.6875rem] font-bold uppercase tracking-wide text-ink-mute">
                  {label}
                </h2>
                <ul className="space-y-2.5">
                  {items.map((n) => (
                    <NotificationRow key={n.id} n={n} isNew={fresh.current.has(n.id)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function groupByDay(list: Notification[]): [string, Notification[]][] {
  const groups = new Map<string, Notification[]>();
  for (const n of list) {
    const label = dayLabel(n.created_at);
    groups.set(label, [...(groups.get(label) ?? []), n]);
  }
  return [...groups.entries()];
}

function NotificationRow({ n, isNew }: { n: Notification; isNew: boolean }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink">
          {isNew && (
            <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-accent" />
          )}
          <span className="min-w-0 truncate">{n.title}</span>
        </p>
        <span className="shrink-0 text-[0.6875rem] font-semibold text-ink-mute">
          {relativeTime(n.created_at)}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">{n.body}</p>
    </>
  );
  const cls = `block rounded-xl border p-4 shadow-e1 transition-colors duration-200 ${
    isNew ? "border-accent-line bg-accent-soft/50" : "border-line bg-surface"
  }`;
  return (
    <li>
      {n.href ? (
        <Link href={n.href} className={`${cls} hover:border-accent-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}>
          {content}
        </Link>
      ) : (
        <div className={cls}>{content}</div>
      )}
    </li>
  );
}
