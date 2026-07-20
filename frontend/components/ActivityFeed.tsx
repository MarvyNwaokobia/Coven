"use client";

import { Avatar, Card, EmptyState } from "./ui";
import { formatUSDC, relativeTime } from "@/lib/format";
import type { ActivityItem } from "@/lib/types";

const LABELS: Record<ActivityItem["type"], (a: ActivityItem) => string> = {
  payment_sent: (a) => `You sent @${a.actor ? a.actor.username : "someone"}`,
  payment_received: (a) => `@${a.actor?.username ?? "someone"} sent you`,
  request_received: (a) => `@${a.actor?.username ?? "someone"} is requesting`,
  request_paid: (a) => `@${a.actor?.username ?? "someone"} paid your request`,
  split_created: (a) => `@${a.actor?.username ?? "someone"} created a split`,
  split_paid: (a) => `@${a.actor?.username ?? "someone"} paid their share`,
  split_complete: () => "Split fully collected",
  offramp_completed: () => "Cash out completed",
  offramp_failed: () => "Cash out failed — tap to retry",
  circle_joined: (a) => `@${a.actor?.username ?? "someone"} added you to a circle`,
};

const ICONS: Partial<Record<ActivityItem["type"], string>> = {
  offramp_completed: "🏦",
  offramp_failed: "⚠️",
  split_complete: "✅",
  circle_joined: "👥",
};

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        emoji="💸"
        title="No activity yet"
        subtitle="Payments you send and receive will show up here"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((a) => {
        const sent = a.type === "payment_sent";
        return (
          <li key={a.id}>
            <Card className="flex items-center gap-3 py-3">
              {ICONS[a.type] ? (
                <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-lg shrink-0">
                  {ICONS[a.type]}
                </div>
              ) : (
                <Avatar
                  username={a.actor?.username ?? "?"}
                  avatarUrl={a.actor?.avatar_url}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{LABELS[a.type](a)}</p>
                <p className="text-xs text-text-2 truncate">
                  {a.note ? `“${a.note}” · ` : ""}
                  {relativeTime(a.created_at)}
                </p>
              </div>
              {a.amount_usdc != null && (
                <p
                  className={`amount text-sm font-semibold ${
                    sent ? "text-text" : "text-success"
                  }`}
                >
                  {sent ? "−" : "+"}
                  {formatUSDC(a.amount_usdc)}
                </p>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
