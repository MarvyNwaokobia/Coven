"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ActivityFeed from "@/components/ActivityFeed";
import { Card, Spinner, Avatar, Button } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC, formatLocal } from "@/lib/format";
import type { ActivityItem, PaymentRequest } from "@/lib/types";

export default function HomePage() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<{ usdc: string; localEstimate: number } | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      api<{ usdc: string; localEstimate: number }>("/api/balance"),
      api<{ activity: ActivityItem[] }>("/api/activity"),
      api<{ requests: PaymentRequest[] }>("/api/payments/request"),
    ]).then(([b, a, r]) => {
      if (b.status === "fulfilled") setBalance(b.value);
      if (a.status === "fulfilled") setActivity(a.value.activity);
      if (r.status === "fulfilled") setRequests(r.value.requests);
      setLoading(false);
    });
  }, [user]);

  async function payRequest(id: string) {
    try {
      await api(`/api/payments/${id}/pay`, { json: {} });
      setRequests((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Payment failed");
    }
  }

  return (
    <AppShell>
      <Card className="text-center py-8 bg-gradient-to-b from-surface to-surface-2">
        <p className="text-text-2 text-sm">Your Balance</p>
        <p className="amount text-4xl font-bold mt-2">
          {balance ? formatUSDC(balance.usdc) : "—"}
          <span className="text-base font-medium text-text-2 ml-1">USDC</span>
        </p>
        {balance && (
          <p className="text-text-2 text-sm mt-1">
            ≈ {formatLocal(balance.localEstimate)} NGN
          </p>
        )}
      </Card>

      <div className="grid grid-cols-4 gap-2 mt-4">
        {[
          { href: "/send", label: "Send", icon: "↗️" },
          { href: "/request", label: "Request", icon: "↙️" },
          { href: "/receive", label: "Receive", icon: "🔳" },
          { href: "/cashout", label: "Cash Out", icon: "🏦" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center gap-1.5 rounded-card bg-surface border border-border py-3.5 hover:bg-surface-2 transition-colors"
          >
            <span className="text-xl">{a.icon}</span>
            <span className="text-xs font-medium">{a.label}</span>
          </Link>
        ))}
      </div>

      {requests.length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold mb-2">Requests for you</h2>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id}>
                <Card className="flex items-center gap-3 py-3">
                  <Avatar
                    username={r.from_user?.username ?? "?"}
                    avatarUrl={r.from_user?.avatar_url}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      @{r.from_user?.username} requests{" "}
                      <span className="amount">{formatUSDC(r.amount_usdc)}</span>
                    </p>
                    {r.note && <p className="text-xs text-text-2 truncate">“{r.note}”</p>}
                  </div>
                  <Button className="px-4 py-2 text-xs" onClick={() => payRequest(r.id)}>
                    Pay
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-semibold mb-2">Activity</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <ActivityFeed items={activity} />
        )}
      </section>
    </AppShell>
  );
}
