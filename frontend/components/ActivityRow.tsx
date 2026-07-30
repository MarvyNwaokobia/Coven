"use client";

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
} from "./Icons";
import { ReactNode } from "react";

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
  goal_created: (a) => `@${a.actor?.username ?? "someone"} started a savings goal`,
  goal_target_reached: () => "Savings goal target reached 🎉",
  goal_withdrawal_requested: (a) => `@${a.actor?.username ?? "someone"} requested to withdraw — needs your approval`,
  goal_withdrawn: (a) => `@${a.actor?.username ?? "someone"}'s goal was withdrawn`,
};

export const ACTIVITY_SVG_ICONS: Partial<Record<ActivityItem["type"], ReactNode>> = {
  payment_sent: <SendIcon className="w-4 h-4 text-slate-700" />,
  payment_received: <ReceiveIcon className="w-4 h-4 text-emerald-600" />,
  request_received: <RequestIcon className="w-4 h-4 text-blue-600" />,
  offramp_completed: <CashoutIcon className="w-4 h-4 text-slate-700" />,
  offramp_failed: <AlertCircleIcon className="w-4 h-4 text-red-600" />,
  split_complete: <CheckCircleIcon className="w-4 h-4 text-emerald-600" />,
  circle_joined: <UserGroupIcon className="w-4 h-4 text-blue-600" />,
  request_rejected: <AlertCircleIcon className="w-4 h-4 text-slate-400" />,
  request_declined: <AlertCircleIcon className="w-4 h-4 text-slate-400" />,
  goal_created: <UserGroupIcon className="w-4 h-4 text-blue-600" />,
  goal_target_reached: <CheckCircleIcon className="w-4 h-4 text-emerald-600" />,
  goal_withdrawal_requested: <AlertCircleIcon className="w-4 h-4 text-blue-600" />,
  goal_withdrawn: <CheckCircleIcon className="w-4 h-4 text-slate-700" />,
};

/** Shared row content — icon/avatar, label, note + relative time, amount. */
export default function ActivityRow({ item }: { item: ActivityItem }) {
  const outgoing = new Set<ActivityItem["type"]>([
    "payment_sent",
    "request_received",
    "split_created",
    "offramp_completed",
    "offramp_failed",
  ]).has(item.type);

  const neutral = new Set<ActivityItem["type"]>([
    "request_rejected",
    "request_declined",
    "goal_created",
    "goal_target_reached",
    "goal_withdrawal_requested",
    "goal_withdrawn",
  ]).has(item.type);

  const customIcon = ACTIVITY_SVG_ICONS[item.type];

  return (
    <div className="flex items-center gap-3">
      {customIcon || !item.actor ? (
        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
          {customIcon || <BanknoteIcon className="w-4 h-4 text-slate-600" />}
        </div>
      ) : (
        <Avatar username={item.actor.username} avatarUrl={item.actor.avatar_url} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{ACTIVITY_LABELS[item.type](item)}</p>
        <p className="text-xs text-slate-500 truncate">
          {item.note ? `“${item.note}” · ` : ""}
          {relativeTime(item.created_at)}
        </p>
      </div>
      {item.amount_usdc != null && (
        <p
          className={`amount text-sm font-bold ${
            neutral ? "text-slate-400" : outgoing ? "text-slate-900" : "text-emerald-600"
          }`}
        >
          {neutral ? "" : outgoing ? "−" : "+"}
          {formatUSDC(item.amount_usdc)}
        </p>
      )}
    </div>
  );
}
