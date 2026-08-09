"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import ActivityFeed from "@/components/ActivityFeed";
import { SkeletonList, EmptyState, Button } from "@/components/ui";
import { HistoryIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC } from "@/lib/format";
import type { ActivityItem } from "@/lib/types";

type FilterId = "all" | "sent" | "received" | "requests" | "splits" | "cashouts";

const FILTERS: { id: FilterId; label: string; match: (t: ActivityItem["type"]) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "sent", label: "Sent", match: (t) => t === "payment_sent" },
  { id: "received", label: "Received", match: (t) => t === "payment_received" },
  { id: "requests", label: "Requests", match: (t) => t.startsWith("request_") },
  { id: "splits", label: "Splits", match: (t) => t.startsWith("split_") },
  { id: "cashouts", label: "Cash outs", match: (t) => t.startsWith("offramp_") },
];

export default function HistoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");

  useEffect(() => {
    if (!user) return;
    api<{ activity: ActivityItem[] }>("/api/activity")
      .then(({ activity }) => setItems(activity))
      .catch(() => setItems([]));
  }, [user]);

  const active = FILTERS.find((f) => f.id === filter)!;
  const filtered = useMemo(
    () => items?.filter((i) => active.match(i.type)) ?? [],
    [items, active]
  );

  /* Net movement across the current filter: the number people actually want. */
  const totals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const i of filtered) {
      const n = Number(i.amount_usdc ?? 0);
      if (!n) continue;
      if (i.type === "payment_received" || i.type === "request_paid") inflow += n;
      else if (i.type === "payment_sent" || i.type === "offramp_completed") outflow += n;
    }
    return { inflow, outflow };
  }, [filtered]);

  return (
    <AppShell title="Transaction history" subtitle="Everything that moved through your account">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Filters */}
        <div className="scroll-fade-x no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={on}
                className={`min-h-9 shrink-0 cursor-pointer rounded-full border px-4 text-xs font-bold transition-[background-color,border-color,color,translate,scale] duration-200 ease-out-soft active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                  on
                    ? "border-brand bg-brand text-white shadow-e1"
                    : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* In / out summary */}
        {items !== null && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-e1">
              <p className="text-xs font-semibold text-ink-soft">Money in</p>
              <p className="amount mt-1 text-xl font-extrabold text-pos">
                +{formatUSDC(totals.inflow)}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-e1">
              <p className="text-xs font-semibold text-ink-soft">Money out</p>
              <p className="amount mt-1 text-xl font-extrabold text-ink">
                −{formatUSDC(totals.outflow)}
              </p>
            </div>
          </div>
        )}

        {items === null ? (
          <SkeletonList rows={6} />
        ) : filtered.length === 0 && filter !== "all" ? (
          <EmptyState
            icon={<HistoryIcon className="h-5 w-5" />}
            title={`Nothing under “${active.label}”`}
            subtitle="Try a different filter to see the rest of your history."
            action={
              <Button variant="secondary" size="sm" onClick={() => setFilter("all")}>
                Show all activity
              </Button>
            }
          />
        ) : (
          <ActivityFeed items={filtered} />
        )}
      </div>
    </AppShell>
  );
}
