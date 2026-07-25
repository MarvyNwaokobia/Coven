"use client";

import { Avatar } from "./ui";
import { formatUSDC, relativeTime } from "@/lib/format";
import type { ActivityItem } from "@/lib/types";

export const ACTIVITY_LABELS: Record<ActivityItem["type"], (a: ActivityItem) => string> = {
  payment_sent: (a) => `You sent @${a.actor ? a.actor.username : "someone"}`,
  payment_received: (a) => (a.actor ? `@${a.actor.username} sent you` : "External deposit"),
  request_received: (a) => `@${a.actor?.username ?? "someone"} is requesting`,
  request_paid: (a) => `@${a.actor?.username ?? "someone"} paid your request`,
  request_rejected: (a) => `@${a.actor?.username ?? "someone"} declined your request`,
  request_declined: (a) => `You declined @${a.actor?.username ?? "their"}'s request`,
  split_created: (a) => `@${a.actor?.username ?? "someone"} created a split`,
  split_paid: (a) => `@${a.actor?.username ?? "someone"} paid their share`,
  split_complete: () => "Split fully collected",
  offramp_completed: () => "Cash out completed",
  offramp_failed: () => "Cash out failed — tap to retry",
  circle_joined: (a) => `@${a.actor?.username ?? "someone"} added you to a circle`,
};

export const ACTIVITY_ICONS: Partial<Record<ActivityItem["type"], string>> = {
  offramp_completed: "🏦",
  offramp_failed: "⚠️",
  split_complete: "✅",
  circle_joined: "👥",
  request_rejected: "🚫",
  request_declined: "🚫",
};

/** Fallback icon for activity with no actor (e.g. external deposits). */
const NO_ACTOR_ICON = "💰";

/**
 * Activity types where the amount represents money leaving your balance
 * (or an obligation to pay) rather than money landing in it. Everything
 * else defaults to incoming (+, green).
 */
const OUTGOING_TYPES = new Set<ActivityItem["type"]>([
  "payment_sent",
  "request_received", // someone is asking YOU to pay — not money received
  "split_created", // your assigned share of a bill you haven't paid yet
  "offramp_completed",
  "offramp_failed",
]);

/** Types where the amount is informational only — no money actually moved. */
const NEUTRAL_TYPES = new Set<ActivityItem["type"]>(["request_rejected", "request_declined"]);

/** Shared row content — icon/avatar, label, note + relative time, amount. */
export default function ActivityRow({ item }: { item: ActivityItem }) {
  const outgoing = OUTGOING_TYPES.has(item.type);
  const neutral = NEUTRAL_TYPES.has(item.type);
  return (
    <div className="flex items-center gap-3">
      {ACTIVITY_ICONS[item.type] || !item.actor ? (
        <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-lg shrink-0">
          {ACTIVITY_ICONS[item.type] ?? NO_ACTOR_ICON}
        </div>
      ) : (
        <Avatar username={item.actor.username} avatarUrl={item.actor.avatar_url} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{ACTIVITY_LABELS[item.type](item)}</p>
        <p className="text-xs text-text-2 truncate">
          {item.note ? `“${item.note}” · ` : ""}
          {relativeTime(item.created_at)}
        </p>
      </div>
      {item.amount_usdc != null && (
        <p
          className={`amount text-sm font-semibold ${
            neutral ? "text-text-2" : outgoing ? "text-text" : "text-success"
          }`}
        >
          {neutral ? "" : outgoing ? "−" : "+"}
          {formatUSDC(item.amount_usdc)}
        </p>
      )}
    </div>
  );
}
