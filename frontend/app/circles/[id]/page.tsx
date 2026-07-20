"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Button, Card, Avatar, Spinner, StatusChip, Input, EmptyState } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC, relativeTime } from "@/lib/format";
import type { Circle, Split, Payment, User } from "@/lib/types";

interface CircleDetail {
  circle: Circle & { members: User[] };
  splits: Split[];
  payments: (Payment & {
    from_user?: { username: string };
    to_user?: { username: string };
  })[];
}

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<CircleDetail | null>(null);
  const [showSplit, setShowSplit] = useState(false);
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<CircleDetail>(`/api/circles/${id}`)
      .then(setData)
      .catch(() => setData(null));
  }, [id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function createSplit() {
    if (!data || !user) return;
    const others = data.circle.members.filter((m) => m.id !== user.id);
    const share =
      Math.floor((parseFloat(total) / (others.length + 1)) * 100) / 100;
    setBusy(true);
    setError("");
    try {
      await api("/api/splits/create", {
        json: {
          memberUsernames: others.map((m) => m.username),
          amounts: others.map(() => share),
          description,
          circleId: id,
        },
      });
      setShowSplit(false);
      setDescription("");
      setTotal("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create split");
    } finally {
      setBusy(false);
    }
  }

  async function paySplit(splitId: string) {
    try {
      await api(`/api/splits/${splitId}/pay`, { json: {} });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Payment failed");
    }
  }

  if (!data) {
    return (
      <AppShell back>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  const { circle, splits, payments } = data;

  return (
    <AppShell title={`${circle.emoji} ${circle.name}`} back>
      <div className="space-y-5">
        <div className="flex -space-x-2 items-center">
          {circle.members.slice(0, 6).map((m) => (
            <Avatar key={m.id} username={m.username} avatarUrl={m.avatar_url} size={32} />
          ))}
          <span className="pl-4 text-xs text-text-2">
            {circle.members.length} members
          </span>
          <Button
            className="ml-auto px-4 py-2 text-xs"
            onClick={() => setShowSplit((s) => !s)}
          >
            {showSplit ? "Cancel" : "+ Split a bill"}
          </Button>
        </div>

        {showSplit && (
          <Card className="space-y-3">
            <Input
              placeholder='What for? — "Dinner at Nkoyo"'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Input
              inputMode="decimal"
              placeholder="Total amount (USDC) — split equally"
              value={total}
              onChange={(e) => setTotal(e.target.value.replace(/[^0-9.]/g, ""))}
            />
            <Button
              className="w-full"
              onClick={createSplit}
              disabled={busy || !description.trim() || !parseFloat(total)}
            >
              {busy ? "Creating…" : "Create split"}
            </Button>
            {error && <p className="text-danger text-sm">{error}</p>}
          </Card>
        )}

        {splits.filter((s) => s.status === "open").map((s) => {
          const pct = Math.round(
            (Number(s.collected_usdc) / Number(s.total_amount_usdc)) * 100
          );
          const mine = s.members?.find((m) => m.user_id === user?.id);
          const unpaid = (s.members ?? []).filter((m) => !m.paid);
          return (
            <Card key={s.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{s.description}</p>
                <StatusChip status={s.status} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="amount">
                    {formatUSDC(s.collected_usdc)} / {formatUSDC(s.total_amount_usdc)}
                  </span>
                  <span className="text-text-2">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              {unpaid.length > 0 && (
                <p className="text-xs text-text-2">
                  Still owed:{" "}
                  {unpaid.map((m) => `@${m.user?.username} ${formatUSDC(m.amount_owed_usdc)}`).join(" · ")}
                </p>
              )}
              {mine && !mine.paid && (
                <Button className="w-full" onClick={() => paySplit(s.id)}>
                  Pay your share — {formatUSDC(mine.amount_owed_usdc)}
                </Button>
              )}
            </Card>
          );
        })}

        <section>
          <h2 className="font-semibold mb-2">Activity</h2>
          {payments.length === 0 ? (
            <EmptyState emoji="💤" title="No payments in this circle yet" />
          ) : (
            <ul className="space-y-2">
              {payments.map((p) => (
                <li key={p.id}>
                  <Card className="flex items-center gap-3 py-3 text-sm">
                    <Avatar username={p.from_user?.username ?? "?"} size={32} />
                    <p className="flex-1 min-w-0 truncate">
                      @{p.from_user?.username} paid @{p.to_user?.username}
                      {p.note ? ` · “${p.note}”` : ""}
                    </p>
                    <div className="text-right">
                      <p className="amount font-semibold">{formatUSDC(p.amount_usdc)}</p>
                      <p className="text-xs text-text-2">{relativeTime(p.created_at)}</p>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
