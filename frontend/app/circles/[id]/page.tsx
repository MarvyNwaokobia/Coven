"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Button, Card, Avatar, Spinner, StatusChip, Input, EmptyState } from "@/components/ui";
import { api } from "@/lib/api-client";
import { approveTransfer } from "@/lib/circle/pay";
import { createGoal, contributeToGoal, requestGoalWithdrawal, approveGoalWithdrawal } from "@/lib/circle/goals";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC, relativeTime } from "@/lib/format";
import type { Circle, Split, Payment, User, Goal } from "@/lib/types";
import { UserGroupIcon } from "@/components/Icons";

interface CircleDetail {
  circle: Circle & { members: User[] };
  splits: Split[];
  goals: Goal[];
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

  const [showGoal, setShowGoal] = useState(false);
  const [goalDescription, setGoalDescription] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalBusy, setGoalBusy] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [contributeAmounts, setContributeAmounts] = useState<Record<string, string>>({});
  const [withdrawRecipient, setWithdrawRecipient] = useState<Record<string, string>>({});
  const [goalActionBusy, setGoalActionBusy] = useState<string | null>(null);

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
      await approveTransfer({ kind: "split", splitId });
      await api(`/api/splits/${splitId}/pay`, { json: {} });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Payment failed");
    }
  }

  async function handleCreateGoal() {
    if (!data || !user) return;
    setGoalBusy(true);
    setGoalError("");
    try {
      await createGoal({
        circleId: id,
        memberUsernames: data.circle.members.filter((m) => m.id !== user.id).map((m) => m.username),
        targetAmountUsdc: parseFloat(goalTarget),
        description: goalDescription,
      });
      setShowGoal(false);
      setGoalDescription("");
      setGoalTarget("");
      load();
    } catch (e) {
      setGoalError(e instanceof Error ? e.message : "Could not create goal");
    } finally {
      setGoalBusy(false);
    }
  }

  async function handleContribute(goalId: string) {
    const amount = parseFloat(contributeAmounts[goalId] ?? "");
    if (!amount || amount <= 0) return;
    setGoalActionBusy(goalId);
    try {
      await contributeToGoal(goalId, amount);
      setContributeAmounts((a) => ({ ...a, [goalId]: "" }));
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Contribution failed");
    } finally {
      setGoalActionBusy(null);
    }
  }

  async function handleRequestWithdrawal(goalId: string) {
    const recipient = withdrawRecipient[goalId]?.trim();
    if (!recipient) return;
    setGoalActionBusy(goalId);
    try {
      await requestGoalWithdrawal(goalId, recipient);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Withdrawal request failed");
    } finally {
      setGoalActionBusy(null);
    }
  }

  async function handleApproveWithdrawal(goalId: string) {
    setGoalActionBusy(goalId);
    try {
      await approveGoalWithdrawal(goalId);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setGoalActionBusy(null);
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

  const { circle, splits, goals, payments } = data;

  return (
    <AppShell title={`${circle.name}`} back>
      <div className="space-y-5">
        <div className="flex -space-x-2 items-center bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          {circle.members.slice(0, 6).map((m) => (
            <Avatar key={m.id} username={m.username} avatarUrl={m.avatar_url} size={32} />
          ))}
          <span className="pl-4 text-xs font-semibold text-slate-500">
            {circle.members.length} members
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              className="px-4 py-2 text-xs"
              onClick={() => setShowGoal((s) => !s)}
            >
              {showGoal ? "Cancel" : "+ Savings Goal"}
            </Button>
            <Button className="px-4 py-2 text-xs" onClick={() => setShowSplit((s) => !s)}>
              {showSplit ? "Cancel" : "+ Split a bill"}
            </Button>
          </div>
        </div>

        {showSplit && (
          <Card className="space-y-3">
            <p className="font-bold text-sm text-slate-900">New Bill Split</p>
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
            {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
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
                <p className="font-bold text-slate-900">{s.description}</p>
                <StatusChip status={s.status} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5 font-semibold">
                  <span className="amount text-slate-900">
                    {formatUSDC(s.collected_usdc)} / {formatUSDC(s.total_amount_usdc)}
                  </span>
                  <span className="text-slate-500">{pct}%</span>
                </div>
                {/* Solid blue progress bar — NO GRADIENT */}
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/60">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              {unpaid.length > 0 && (
                <p className="text-xs text-slate-500 font-medium">
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

        {showGoal && (
          <Card className="space-y-3">
            <p className="font-bold text-sm text-slate-900">New Savings Goal</p>
            <Input
              placeholder='What for? — "Vacation Fund"'
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
            />
            <Input
              inputMode="decimal"
              placeholder="Target amount (USDC)"
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value.replace(/[^0-9.]/g, ""))}
            />
            <p className="text-xs text-slate-500">
              Any member can contribute any amount. Withdrawing requires every member to approve.
            </p>
            <Button
              className="w-full"
              onClick={handleCreateGoal}
              disabled={goalBusy || !goalDescription.trim() || !parseFloat(goalTarget)}
            >
              {goalBusy ? "Creating…" : "Create goal"}
            </Button>
            {goalError && <p className="text-red-600 text-sm font-medium">{goalError}</p>}
          </Card>
        )}

        {goals.filter((g) => g.status === "open").map((g) => {
          const pct = Math.min(
            100,
            Math.round((Number(g.collected_usdc) / Number(g.target_amount_usdc)) * 100)
          );
          const pendingWithdrawal = g.withdrawal?.find((w) => w.status === "pending");
          const iApproved = pendingWithdrawal?.approvals?.some((a) => a.user_id === user?.id);
          const busy = goalActionBusy === g.id;

          return (
            <Card key={g.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-900">{g.description}</p>
                <StatusChip status={g.status} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5 font-semibold">
                  <span className="amount text-slate-900">
                    {formatUSDC(g.collected_usdc)} / {formatUSDC(g.target_amount_usdc)}
                  </span>
                  <span className="text-slate-500">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/60">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {pendingWithdrawal ? (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <p className="text-xs text-slate-600 font-medium">
                    @{pendingWithdrawal.requester?.username} requested to withdraw to @
                    {pendingWithdrawal.recipient?.username} — {pendingWithdrawal.approvals?.length ?? 0}/
                    {g.members?.length ?? 0} approved
                  </p>
                  {!iApproved && (
                    <Button className="w-full" disabled={busy} onClick={() => handleApproveWithdrawal(g.id)}>
                      {busy ? "Approving…" : "Approve Withdrawal"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    inputMode="decimal"
                    placeholder="Amount"
                    className="flex-1"
                    value={contributeAmounts[g.id] ?? ""}
                    onChange={(e) =>
                      setContributeAmounts((a) => ({
                        ...a,
                        [g.id]: e.target.value.replace(/[^0-9.]/g, ""),
                      }))
                    }
                  />
                  <Button disabled={busy} onClick={() => handleContribute(g.id)}>
                    {busy ? "…" : "Contribute"}
                  </Button>
                </div>
              )}

              {!pendingWithdrawal && Number(g.collected_usdc) > 0 && (
                <div className="flex gap-2 pt-1 border-t border-slate-100">
                  <Input
                    placeholder="Withdraw to @username"
                    className="flex-1"
                    value={withdrawRecipient[g.id] ?? ""}
                    onChange={(e) => setWithdrawRecipient((r) => ({ ...r, [g.id]: e.target.value }))}
                  />
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => handleRequestWithdrawal(g.id)}
                  >
                    {busy ? "…" : "Withdraw"}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}

        <section>
          <h2 className="font-bold text-slate-900 text-sm tracking-wide mb-2.5">Activity</h2>
          {payments.length === 0 ? (
            <EmptyState
              icon={<UserGroupIcon className="w-6 h-6 text-slate-600" />}
              title="No payments in this circle yet"
            />
          ) : (
            <ul className="space-y-2">
              {payments.map((p) => (
                <li key={p.id}>
                  <Card className="flex items-center gap-3 py-3 text-sm">
                    <Avatar username={p.from_user?.username ?? "?"} size={32} />
                    <p className="flex-1 min-w-0 truncate font-medium text-slate-800">
                      @{p.from_user?.username} paid @{p.to_user?.username}
                      {p.note ? ` · “${p.note}”` : ""}
                    </p>
                    <div className="text-right">
                      <p className="amount font-bold text-slate-900">{formatUSDC(p.amount_usdc)}</p>
                      <p className="text-xs text-slate-500">{relativeTime(p.created_at)}</p>
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
