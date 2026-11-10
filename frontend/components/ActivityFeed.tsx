"use client";

import { useCallback, useState } from "react";
import { EmptyState } from "./ui";
import ActivityRow, { ACTIVITY_LABELS, activityDirection } from "./ActivityRow";
import TransactionDetails from "./TransactionDetails";
import { BanknoteIcon } from "./Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { receiptFromStatement, type Receipt } from "@/lib/receipt";
import type { StatementRow } from "@/lib/statement-types";
import type { ActivityItem } from "@/lib/types";

/** Activity types that point at a payment, a request that became one, or a cash out: these have full receipts. */
const HAS_RECEIPT = new Set<ActivityItem["type"]>([
  "payment_sent",
  "payment_received",
  "request_paid",
  "offramp_completed",
  "offramp_failed",
]);

/** What we can show from the feed item alone, for events that are not a money movement (requests, circles, goals). */
function receiptFromActivity(a: ActivityItem): Receipt {
  return {
    id: a.id,
    at: a.created_at,
    title: ACTIVITY_LABELS[a.type](a),
    kindLabel: "Activity",
    direction: activityDirection(a.type),
    amount: a.amount_usdc,
    fee: 0,
    counterparty: null,
    note: a.note,
    txHash: null,
    status: null,
  };
}

/**
 * One grouped surface with hairline-separated rows, so it reads as a ledger
 * rather than a stack of floating cards. Tapping a row opens its transaction details.
 */
export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const { user } = useAuth({ optional: true });
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const open = useCallback(async (a: ActivityItem) => {
    setSelected(a);
    setError("");
    if (!HAS_RECEIPT.has(a.type) || !a.reference_id) {
      setReceipt(receiptFromActivity(a));
      setLoading(false);
      return;
    }
    setReceipt(null);
    setLoading(true);
    try {
      const { row } = await api<{ row: StatementRow }>(`/api/receipts/${a.reference_id}`);
      setReceipt(receiptFromStatement(row));
    } catch {
      // Older entries can lack a linked record; the feed item still has the essentials.
      setReceipt(receiptFromActivity(a));
    } finally {
      setLoading(false);
    }
  }, []);

  const close = useCallback(() => {
    setSelected(null);
    setReceipt(null);
  }, []);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<BanknoteIcon className="h-5 w-5" />}
        title="No activity yet"
        subtitle="Payments you send and receive will show up here."
      />
    );
  }

  return (
    <>
      <ul className="stagger divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-e1">
        {items.map((a, i) => (
          <li
            key={a.id}
            style={{ ["--i" as string]: i }}
            className="group/row relative transition-[background-color,translate] duration-200 ease-out-soft hover:translate-x-0.5 hover:bg-surface-2/70"
          >
            {/* Accent rail slides in from the left edge on hover. */}
            <span
              aria-hidden="true"
              className="absolute inset-y-2 left-0 w-0.5 origin-top scale-y-0 rounded-r-full bg-accent transition-transform duration-200 ease-out-soft group-hover/row:scale-y-100"
            />
            <button
              type="button"
              onClick={() => open(a)}
              aria-label={`${ACTIVITY_LABELS[a.type](a)}. View details`}
              className="block w-full cursor-pointer px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <ActivityRow item={a} />
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <TransactionDetails receipt={receipt} loading={loading} error={error} username={user?.username} onClose={close} />
      )}
    </>
  );
}
