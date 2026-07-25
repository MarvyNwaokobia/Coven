"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, Avatar, Spinner, StatusChip, EmptyState } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC, relativeTime } from "@/lib/format";
import type { Payment } from "@/lib/types";

type HistoryPayment = Payment & {
  from_user?: { id: string; username: string; avatar_url: string | null };
  to_user?: { id: string; username: string; avatar_url: string | null };
};

export default function HistoryPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<HistoryPayment[] | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ payments: HistoryPayment[] }>("/api/history")
      .then(({ payments }) => setPayments(payments))
      .catch(() => setPayments([]));
  }, [user]);

  return (
    <AppShell title="History">
      {payments === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : payments.length === 0 ? (
        <EmptyState emoji="🗂️" title="No transactions yet" />
      ) : (
        <ul className="space-y-2">
          {payments.map((p) => {
            const sent = p.from_user_id === user?.id;
            const other = sent ? p.to_user : p.from_user;
            return (
              <li key={p.id}>
                <Card className="flex items-center gap-3 py-3">
                  <Avatar
                    username={other?.username ?? "external"}
                    avatarUrl={other?.avatar_url}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {other ? `${sent ? "To" : "From"} @${other.username}` : "External deposit"}
                      {p.source_chain !== "ARC" && (
                        <span className="ml-1.5 text-xs text-accent">
                          via {p.source_chain.toLowerCase()}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-2 truncate">
                      {p.note ? `“${p.note}” · ` : ""}
                      {relativeTime(p.created_at)}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p
                      className={`amount text-sm font-semibold ${
                        sent ? "" : "text-success"
                      }`}
                    >
                      {sent ? "−" : "+"}
                      {formatUSDC(p.amount_usdc)}
                    </p>
                    <StatusChip status={p.status} />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
