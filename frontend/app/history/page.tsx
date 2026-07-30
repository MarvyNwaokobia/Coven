"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import ActivityFeed from "@/components/ActivityFeed";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import type { ActivityItem } from "@/lib/types";

const FILTERS: { id: ActivityItem["type"] | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "payment_sent", label: "Sent" },
  { id: "payment_received", label: "Received" },
  { id: "request_received", label: "Requests" },
  { id: "split_created", label: "Splits" },
  { id: "offramp_completed", label: "Cash outs" },
];

export default function HistoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [filter, setFilter] = useState<ActivityItem["type"] | "all">("all");

  useEffect(() => {
    if (!user) return;
    api<{ activity: ActivityItem[] }>("/api/activity")
      .then(({ activity }) => setItems(activity))
      .catch(() => setItems([]));
  }, [user]);

  const filtered =
    items?.filter((i) => {
      if (filter === "all") return true;
      if (filter === "payment_sent") return i.type === "payment_sent";
      if (filter === "payment_received") return i.type === "payment_received";
      if (filter === "request_received") return i.type.startsWith("request_");
      if (filter === "split_created") return i.type.startsWith("split_");
      if (filter === "offramp_completed") return i.type.startsWith("offramp_");
      return true;
    }) ?? [];

  return (
    <AppShell title="Transaction History">
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                filter === f.id
                  ? "bg-[#0a192f] text-white shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {items === null ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <ActivityFeed items={filtered} />
        )}
      </div>
    </AppShell>
  );
}
