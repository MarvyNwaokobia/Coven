"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ActivityFeed from "@/components/ActivityFeed";
import {
  Card,
  Avatar,
  Button,
  Skeleton,
  SkeletonList,
  SectionHeading,
  Alert,
} from "@/components/ui";
import {
  SendIcon,
  RequestIcon,
  ReceiveIcon,
  CashoutIcon,
  EyeIcon,
  EyeOffIcon,
  BoltIcon,
  ChevronRightIcon,
} from "@/components/Icons";
import { api } from "@/lib/api-client";
import { approveTransfer } from "@/lib/circle/pay";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC, formatLocal } from "@/lib/format";
import type { ActivityItem, PaymentRequest } from "@/lib/types";

const QUICK_ACTIONS = [
  { href: "/send", label: "Send", hint: "To any @handle", icon: SendIcon },
  { href: "/request", label: "Request", hint: "Ask to be paid", icon: RequestIcon },
  { href: "/receive", label: "Receive", hint: "Share your QR", icon: ReceiveIcon },
  { href: "/cashout", label: "Cash out", hint: "Straight to bank", icon: CashoutIcon },
];

export default function HomePage() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<{ usdc: string; localEstimate: number } | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

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
    setPendingId(id);
    setError("");
    try {
      await approveTransfer({ kind: "request", requestId: id });
      await api(`/api/payments/${id}/pay`, { json: {} });
      setRequests((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPendingId(null);
    }
  }

  async function rejectRequest(id: string) {
    setPendingId(id);
    setError("");
    try {
      await api(`/api/payments/${id}/reject`, { json: {} });
      setRequests((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not decline request");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <AppShell
      wide
      title={user ? `Hey, @${user.username}` : "Home"}
      subtitle="Your money, your circles"
    >
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        {/* ------------------------------------------------ Primary column */}
        <div className="space-y-5 lg:col-span-2 lg:space-y-6">
          {/* Balance */}
          <section
            aria-label="Balance"
            className="animate-fade-up relative overflow-hidden rounded-2xl bg-brand p-6 text-white shadow-e3 lg:p-8"
          >
            {/* Depth without gradients: one soft accent bloom, clipped. */}
            <div
              aria-hidden="true"
              className="animate-drift pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/25 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="animate-drift pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-white/5 blur-3xl"
              style={{ animationDelay: "-6s" }}
            />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-white/55">
                  Available balance
                </p>

                {balance ? (
                  <p className="amount animate-count-in mt-2.5 text-4xl font-extrabold tracking-tight lg:text-5xl">
                    {hidden ? "••••••" : formatUSDC(balance.usdc)}
                    <span className="ml-2 align-middle text-sm font-semibold text-white/50">
                      USDC
                    </span>
                  </p>
                ) : (
                  <Skeleton className="mt-3 h-11 w-52 bg-white/10 lg:h-12" />
                )}
              </div>

              <button
                onClick={() => setHidden((h) => !h)}
                aria-label={hidden ? "Show balance" : "Hide balance"}
                aria-pressed={hidden}
                className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/60 transition-[background-color,color,translate,scale] duration-200 hover:bg-white/10 hover:text-white active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                {hidden ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>

            <div className="relative mt-5 flex flex-wrap items-center gap-2">
              {balance && !hidden && (
                <span className="tnum inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85">
                  ≈ {formatLocal(balance.localEstimate)} NGN
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85">
                <BoltIcon className="h-3.5 w-3.5" />
                Settles on Arc in &lt;500ms
              </span>
            </div>
          </section>

          {/* Quick actions */}
          <section aria-label="Quick actions">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {QUICK_ACTIONS.map((a, i) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.href}
                    href={a.href}
                    style={{ ["--i" as string]: i }}
                    className="animate-fade-up group flex min-h-24 flex-col justify-between rounded-xl border border-line bg-surface p-4 shadow-e1 transition-[border-color,box-shadow,translate,scale] duration-200 ease-out-soft hover:-translate-y-1.5 hover:border-accent-line hover:shadow-e3 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink transition-[background-color,color,scale] duration-200 ease-spring group-hover:scale-110 group-hover:bg-accent group-hover:text-white">
                      <Icon className="h-4.5 w-4.5 transition-transform duration-200 ease-spring group-hover:-translate-y-px group-hover:translate-x-px" />
                    </span>
                    <span className="mt-3">
                      <span className="block text-sm font-bold text-ink transition-colors duration-200 group-hover:text-accent">
                        {a.label}
                      </span>
                      <span className="block text-xs text-ink-mute">{a.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Requests waiting on you */}
          {requests.length > 0 && (
            <section aria-label="Payment requests">
              <SectionHeading title="Waiting on you" count={requests.length} />
              <ul className="stagger space-y-2.5">
                {requests.map((r, i) => (
                  <li key={r.id} style={{ ["--i" as string]: i }}>
                    <Card className="border-warn-line bg-warn-soft/40">
                      <div className="flex flex-wrap items-center gap-3">
                        <Avatar
                          username={r.from_user?.username ?? "?"}
                          avatarUrl={r.from_user?.avatar_url}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink">
                            <span className="font-bold">@{r.from_user?.username}</span> requests{" "}
                            <span className="amount font-bold">{formatUSDC(r.amount_usdc)}</span>
                          </p>
                          {r.note && (
                            <p className="truncate text-xs text-ink-soft">“{r.note}”</p>
                          )}
                        </div>
                        <div className="flex w-full gap-2 sm:w-auto">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            disabled={pendingId === r.id}
                            onClick={() => rejectRequest(r.id)}
                          >
                            Decline
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 sm:flex-none"
                            loading={pendingId === r.id}
                            onClick={() => payRequest(r.id)}
                          >
                            Pay {formatUSDC(r.amount_usdc)}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Activity on mobile lives at the bottom of the single column. */}
          <section aria-label="Recent activity" className="lg:hidden">
            <SectionHeading
              title="Recent activity"
              action={
                <Link
                  href="/history"
                  className="inline-flex items-center gap-0.5 rounded text-xs font-bold text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  See all <ChevronRightIcon className="h-3.5 w-3.5" />
                </Link>
              }
            />
            {loading ? <SkeletonList rows={4} /> : <ActivityFeed items={activity.slice(0, 6)} />}
          </section>
        </div>

        {/* ---------------------------------------------- Secondary column */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <SectionHeading
              title="Recent activity"
              action={
                <Link
                  href="/history"
                  className="inline-flex items-center gap-0.5 rounded text-xs font-bold text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  See all <ChevronRightIcon className="h-3.5 w-3.5" />
                </Link>
              }
            />
            {loading ? <SkeletonList rows={6} /> : <ActivityFeed items={activity.slice(0, 8)} />}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
