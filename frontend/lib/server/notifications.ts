import { formatUSDC } from "@/lib/format";
import type { ActivityItem } from "@/lib/types";

type ActivityRow = Omit<ActivityItem, "actor"> & { actor?: { username: string } | null };

/**
 * Turns a raw activity row into a {title, body} notification. Most types'
 * actor_id already IS the counterparty - the one exception is
 * payment_sent, whose actor_id is the sender themselves (self), so the
 * caller resolves the real recipient separately and passes it in.
 */
export function toNotification(a: ActivityRow, counterpartyUsername?: string | null) {
  const who = counterpartyUsername ?? a.actor?.username ?? null;
  const amount = a.amount_usdc != null ? formatUSDC(a.amount_usdc) : null;

  const map: Record<ActivityItem["type"], { title: string; body: string }> = {
    payment_sent: {
      title: "Payment sent",
      body: who ? `You sent @${who} ${amount ?? ""}`.trim() : `You sent ${amount ?? "a payment"}`,
    },
    payment_received: {
      title: "Payment received",
      body: who ? `@${who} sent you ${amount ?? ""}`.trim() : `You received ${amount ?? "a payment"}`,
    },
    request_received: {
      title: "Payment requested",
      body: `@${who ?? "Someone"} is requesting ${amount ?? "a payment"}${a.note ? ` - “${a.note}”` : ""}`,
    },
    request_sent: {
      title: "Request sent",
      body: `You requested ${amount ?? "a payment"} from @${who ?? "someone"}${a.note ? ` - “${a.note}”` : ""}`,
    },
    request_paid: {
      title: "Request paid",
      body: `@${who ?? "Someone"} paid your request${amount ? ` (${amount})` : ""}`,
    },
    request_rejected: {
      title: "Request declined",
      body: `@${who ?? "Someone"} declined your request${amount ? ` for ${amount}` : ""}`,
    },
    request_declined: {
      title: "Request declined",
      body: `You declined @${who ?? "their"} request${amount ? ` for ${amount}` : ""}`,
    },
    split_created: {
      title: "New bill split",
      body: `@${who ?? "Someone"} created a split${amount ? ` - your share is ${amount}` : ""}`,
    },
    split_paid: {
      title: "Split payment",
      body: `@${who ?? "Someone"} paid their share${amount ? ` (${amount})` : ""}`,
    },
    split_complete: {
      title: "Split complete",
      body: `A bill split was fully collected${amount ? ` - ${amount} total` : ""}`,
    },
    offramp_completed: {
      title: "Cash out completed",
      body: `Your cash out${amount ? ` of ${amount}` : ""} has landed in your bank account`,
    },
    offramp_failed: {
      title: "Cash out failed",
      body: "Your cash out failed - tap to retry",
    },
    circle_joined: {
      title: "Added to a circle",
      body: `@${who ?? "Someone"} added you to a circle`,
    },
    goal_created: {
      title: "New savings goal",
      body: `@${who ?? "Someone"} started a savings goal${a.note ? ` - “${a.note}”` : ""}`,
    },
    goal_target_reached: {
      title: "Goal target reached 🎉",
      body: a.note ? `“${a.note}” has hit its target` : "A savings goal hit its target",
    },
    goal_withdrawal_requested: {
      title: "Withdrawal needs your approval",
      body: `@${who ?? "Someone"} requested to withdraw${amount ? ` ${amount}` : ""} - approve to release it`,
    },
    goal_withdrawn: {
      title: "Goal withdrawn",
      body: `A savings goal was withdrawn${amount ? ` (${amount})` : ""}`,
    },
  };

  return map[a.type] ?? { title: "Notification", body: a.note ?? "" };
}

/**
 * Where tapping a notification should go. Goal and split activity references the goal/split row, so
 * the caller passes the owning circle id (looked up in bulk) for those types.
 */
export function notificationHref(a: ActivityRow, circleId?: string | null): string | null {
  switch (a.type) {
    case "payment_sent":
    case "payment_received":
    case "request_sent":
    case "request_paid":
    case "request_rejected":
    case "request_declined":
      return "/history";
    case "request_received":
      return "/home";
    case "offramp_completed":
    case "offramp_failed":
      return "/cashout";
    case "circle_joined":
      return a.reference_id ? `/circles/${a.reference_id}` : "/circles";
    case "goal_created":
    case "goal_target_reached":
    case "goal_withdrawal_requested":
    case "goal_withdrawn":
    case "split_created":
    case "split_paid":
    case "split_complete":
      return circleId ? `/circles/${circleId}` : "/circles";
    default:
      return null;
  }
}
