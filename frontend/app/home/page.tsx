"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ActivityFeed from "@/components/ActivityFeed";
import { Card, Spinner, Avatar, Button } from "@/components/ui";
import { SendIcon, RequestIcon, ReceiveIcon, CashoutIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { approveTransfer } from "@/lib/circle/pay";
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
      await approveTransfer({ kind: "request", requestId: id });
      await api(`/api/payments/${id}/pay`, { json: {} });
      setRequests((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Payment failed");
    }
  }

  async function rejectRequest(id: string) {
    try {
      await api(`/api/payments/${id}/reject`, { json: {} });
      setRequests((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not decline request");
    }
  }

  return (
    <AppShell>
      {/* Hero Balance Card — Solid Deep Royal Navy, No Gradients */}
      <div className="rounded-2xl bg-[#0a192f] text-white p-6 shadow-md border border-slate-800 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Available Balance</p>
        <p className="amount text-4xl font-extrabold mt-2 tracking-tight">
          {balance ? formatUSDC(balance.usdc) : "—"}
          <span className="text-sm font-medium text-slate-400 ml-1.5">USDC</span>
        </p>
        {balance && (
          <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-medium text-slate-300">
            <span>≈ {formatLocal(balance.localEstimate)} NGN</span>
          </div>
        )}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-4 gap-2.5 mt-4">
        {[
          { href: "/send", label: "Send", icon: SendIcon },
          { href: "/request", label: "Request", icon: RequestIcon },
          { href: "/receive", label: "Receive", icon: ReceiveIcon },
          { href: "/cashout", label: "Cash Out", icon: CashoutIcon },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-2 rounded-2xl bg-white border border-slate-200/90 py-3.5 px-2 hover:border-blue-600 hover:shadow-xs transition-all text-center group"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-blue-50 text-[#0a192f] group-hover:text-blue-600 flex items-center justify-center transition-colors border border-slate-200/60">
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{a.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Payment Requests Section */}
      {requests.length > 0 && (
        <section className="mt-6">
          <h2 className="font-bold text-slate-900 text-sm tracking-wide mb-2.5">Requests for you</h2>
          <ul className="space-y-2.5">
            {requests.map((r) => (
              <li key={r.id}>
                <Card className="space-y-3 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar
                      username={r.from_user?.username ?? "?"}
                      avatarUrl={r.from_user?.avatar_url}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        @{r.from_user?.username} requests{" "}
                        <span className="amount font-bold text-slate-900">{formatUSDC(r.amount_usdc)}</span>
                      </p>
                      {r.note && <p className="text-xs text-slate-500 truncate">“{r.note}”</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1 px-4 py-2 text-xs"
                      onClick={() => rejectRequest(r.id)}
                    >
                      Decline
                    </Button>
                    <Button className="flex-1 px-4 py-2 text-xs" onClick={() => payRequest(r.id)}>
                      Pay
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Activity Feed Section */}
      <section className="mt-6">
        <h2 className="font-bold text-slate-900 text-sm tracking-wide mb-2.5">Recent Activity</h2>
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
