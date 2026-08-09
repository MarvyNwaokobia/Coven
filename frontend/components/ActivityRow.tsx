"use client";

import { ReactNode } from "react";
import { Avatar } from "./ui";
import { formatUSDC, relativeTime } from "@/lib/format";
import type { ActivityItem } from "@/lib/types";
import {
  SendIcon,
  ReceiveIcon,
  RequestIcon,
  CashoutIcon,
  UserGroupIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  BanknoteIcon,
  TargetIcon,
} from "./Icons";

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
  offramp_failed: () => "Cash out failed, tap to retry",
  circle_joined: (a) => `@${a.actor?.username ?? "someone"} added you to a circle`,
  goal_created: (a) => `@${a.actor?.username ?? "someone"} started a savings goal`,
  goal_target_reached: () => "Savings goal target reached",
  goal_withdrawal_requested: (a) =>
    `@${a.actor?.username ?? "someone"} requested to withdraw, needs your approval`,
  goal_withdrawn: (a) => `@${a.actor?.username ?? "someone"}'s goal was withdrawn`,
};

/** Direction of value for the signed-in user: drives sign, colour and icon. */
const OUTGOING = new Set<ActivityItem["type"]>([
  "payment_sent",
  "request_received",
  "split_created",
  "offramp_completed",
  "offramp_failed",
]);

const NEUTRAL = new Set<ActivityItem["type"]>([
  "request_rejected",
  "request_declined",
  "goal_created",
  "goal_target_reached",
  "goal_withdrawal_requested",
  "goal_withdrawn",
]);

const ACTIVITY_ICONS: Partial<Record<ActivityItem["type"], ReactNode>> = {
  payment_sent: <SendIcon className="h-4 w-4" />,
  payment_received: <ReceiveIcon className="h-4 w-4" />,
  request_received: <RequestIcon className="h-4 w-4" />,
  offramp_completed: <CashoutIcon className="h-4 w-4" />,
  offramp_failed: <AlertCircleIcon className="h-4 w-4" />,
  split_complete: <CheckCircleIcon className="h-4 w-4" />,
  circle_joined: <UserGroupIcon className="h-4 w-4" />,
  request_rejected: <AlertCircleIcon className="h-4 w-4" />,
  request_declined: <AlertCircleIcon className="h-4 w-4" />,
  goal_created: <TargetIcon className="h-4 w-4" />,
  goal_target_reached: <CheckCircleIcon className="h-4 w-4" />,
  goal_withdrawal_requested: <AlertCircleIcon className="h-4 w-4" />,
  goal_withdrawn: <TargetIcon className="h-4 w-4" />,
};

const ICON_TONES: Partial<Record<ActivityItem["type"], string>> = {
  payment_received: "bg-pos-soft text-pos",
  split_complete: "bg-pos-soft text-pos",
  goal_target_reached: "bg-pos-soft text-pos",
  offramp_failed: "bg-neg-soft text-neg",
  request_received: "bg-accent-soft text-accent",
  circle_joined: "bg-accent-soft text-accent",
  goal_withdrawal_requested: "bg-warn-soft text-warn",
};

/** Shared row: avatar or tinted icon, label, note + time, signed amount. */
export default function ActivityRow({ item }: { item: ActivityItem }) {
  const outgoing = OUTGOING.has(item.type);
  const neutral = NEUTRAL.has(item.type);
  const icon = ACTIVITY_ICONS[item.type];
  const showIcon = Boolean(icon) || !item.actor;

  return (
    <div className="flex items-center gap-3">
      {showIcon ? (
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            ICON_TONES[item.type] ?? "bg-surface-2 text-ink-soft"
          }`}
        >
          {icon ?? <BanknoteIcon className="h-4 w-4" />}
        </div>
      ) : (
        <Avatar username={item.actor!.username} avatarUrl={item.actor!.avatar_url} />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {ACTIVITY_LABELS[item.type](item)}
        </p>
        <p className="truncate text-xs text-ink-mute">
          {item.note ? `“${item.note}” · ` : ""}
          {relativeTime(item.created_at)}
        </p>
      </div>

      {item.amount_usdc != null && (
        <p
          className={`amount shrink-0 text-sm font-bold ${
            neutral ? "text-ink-mute" : outgoing ? "text-ink" : "text-pos"
          }`}
        >
          {neutral ? "" : outgoing ? "−" : "+"}
          {formatUSDC(item.amount_usdc)}
        </p>
      )}
    </div>
  );
}
