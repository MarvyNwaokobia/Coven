"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import {
  Button,
  Card,
  Avatar,
  AvatarStack,
  StatusChip,
  Input,
  EmptyState,
  Alert,
  ProgressBar,
  SectionHeading,
  SkeletonList,
  Skeleton,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { approveTransfer } from "@/lib/circle/pay";
import {
  createGoal,
  contributeToGoal,
  requestGoalWithdrawal,
  approveGoalWithdrawal,
  goalAction,
  type GoalAction,
} from "@/lib/circle/goals";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC, relativeTime } from "@/lib/format";
import type { Circle, Split, Payment, User, Goal } from "@/lib/types";
import { UserGroupIcon, PlusIcon, TargetIcon, BanknoteIcon } from "@/components/Icons";

/** How long an exit countdown runs. Must match GOAL_EXIT_DELAY_DAYS when GoalPool is deployed. */
const GOAL_EXIT_DAYS = 30;

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
  const [loadFailed, setLoadFailed] = useState(false);

  const [showSplit, setShowSplit] = useState(false);
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payingSplit, setPayingSplit] = useState<string | null>(null);

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
      .catch(() => setLoadFailed(true));
  }, [id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function createSplit() {
    if (!data || !user) return;
    const others = data.circle.members.filter((m) => m.id !== user.id);
    const share = Math.floor((parseFloat(total) / (others.length + 1)) * 100) / 100;
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
    setPayingSplit(splitId);
    setError("");
    try {
      await approveTransfer({ kind: "split", splitId });
      await api(`/api/splits/${splitId}/pay`, { json: {} });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPayingSplit(null);
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
    setGoalError("");
    try {
      await contributeToGoal(goalId, amount);
      setContributeAmounts((a) => ({ ...a, [goalId]: "" }));
      load();
    } catch (e) {
      setGoalError(e instanceof Error ? e.message : "Contribution failed");
    } finally {
      setGoalActionBusy(null);
    }
  }

  async function handleRequestWithdrawal(goalId: string) {
    const recipient = withdrawRecipient[goalId]?.trim();
    if (!recipient) return;
    setGoalActionBusy(goalId);
    setGoalError("");
    try {
      await requestGoalWithdrawal(goalId, recipient);
      load();
    } catch (e) {
      setGoalError(e instanceof Error ? e.message : "Withdrawal request failed");
    } finally {
      setGoalActionBusy(null);
    }
  }

  async function handleApproveWithdrawal(goalId: string) {
    setGoalActionBusy(goalId);
    setGoalError("");
    try {
      await approveGoalWithdrawal(goalId);
      load();
    } catch (e) {
      setGoalError(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setGoalActionBusy(null);
    }
  }

  async function handleGoalAction(goalId: string, action: GoalAction) {
    setGoalActionBusy(goalId);
    setGoalError("");
    try {
      await goalAction(goalId, action);
      load();
    } catch (e) {
      setGoalError(e instanceof Error ? e.message : "That did not go through");
    } finally {
      setGoalActionBusy(null);
    }
  }

  if (loadFailed) {
    return (
      <AppShell title="Circle" back>
        <div className="mx-auto max-w-lg">
          <EmptyState
            icon={<UserGroupIcon className="h-5 w-5" />}
            title="Couldn't load this circle"
            subtitle="It may have been deleted, or you may no longer be a member."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setLoadFailed(false);
                  load();
                }}
              >
                Try again
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title="Circle" back>
        <div className="space-y-5">
          <Skeleton className="h-20 rounded-xl" />
          <SkeletonList rows={3} />
        </div>
      </AppShell>
    );
  }

  const { circle, splits, goals, payments } = data;
  const openSplits = splits.filter((s) => s.status === "open");
  const openGoals = goals.filter((g) => g.status === "open");
  const dissolvedGoals = goals.filter((g) => g.status === "cancelled");

  return (
    <AppShell
      title={circle.name}
      subtitle={`${circle.members.length} member${circle.members.length === 1 ? "" : "s"}`}
      back
      wide
    >
      <div className="space-y-5">
        {/* ------------------------------------------------------- Members */}
        <Card className="flex flex-wrap items-center gap-4">
          <AvatarStack users={circle.members} max={6} />
          <p className="text-sm font-semibold text-ink-soft">
            {circle.members.map((m) => `@${m.username}`).slice(0, 3).join(", ")}
            {circle.members.length > 3 && ` +${circle.members.length - 3} more`}
          </p>
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<TargetIcon className="h-4 w-4" />}
              onClick={() => setShowGoal((s) => !s)}
            >
              {showGoal ? "Cancel" : "Savings goal"}
            </Button>
            <Button
              size="sm"
              icon={<PlusIcon className="h-4 w-4" />}
              onClick={() => setShowSplit((s) => !s)}
            >
              {showSplit ? "Cancel" : "Split a bill"}
            </Button>
          </div>
        </Card>

        {error && <Alert>{error}</Alert>}

        {/* --------------------------------------------------- New split */}
        {showSplit && (
          <Card className="animate-fade-up mx-auto max-w-lg space-y-3.5">
            <p className="text-sm font-bold text-ink">New bill split</p>
            <Input
              label="What's it for?"
              placeholder="Dinner at Nkoyo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
              required
            />
            <Input
              label="Total amount"
              inputMode="decimal"
              prefix="$"
              placeholder="0.00"
              value={total}
              onChange={(e) => setTotal(e.target.value.replace(/[^0-9.]/g, ""))}
              hint={
                parseFloat(total) > 0
                  ? `Split ${circle.members.length} ways, ${formatUSDC(
                      Math.floor((parseFloat(total) / circle.members.length) * 100) / 100
                    )} each`
                  : "Split equally across everyone in the circle."
              }
              required
            />
            <Button
              fullWidth
              onClick={createSplit}
              loading={busy}
              disabled={!description.trim() || !parseFloat(total)}
            >
              Create split
            </Button>
          </Card>
        )}

        {/* --------------------------------------------------- New goal */}
        {showGoal && (
          <Card className="animate-fade-up mx-auto max-w-lg space-y-3.5">
            <p className="text-sm font-bold text-ink">New savings goal</p>
            <Input
              label="What are you saving for?"
              placeholder="Vacation fund"
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
              autoFocus
              required
            />
            <Input
              label="Target amount"
              inputMode="decimal"
              prefix="$"
              placeholder="0.00"
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value.replace(/[^0-9.]/g, ""))}
              required
            />
            <Alert tone="info">
              Any member can contribute any amount. Withdrawing requires every
              member to approve.
            </Alert>
            {goalError && <Alert>{goalError}</Alert>}
            <Button
              fullWidth
              onClick={handleCreateGoal}
              loading={goalBusy}
              disabled={!goalDescription.trim() || !parseFloat(goalTarget)}
            >
              Create goal
            </Button>
          </Card>
        )}

        {/* -------------------------------------------- Splits and goals */}
        {(openSplits.length > 0 || openGoals.length > 0 || dissolvedGoals.length > 0) && (
          <div className="grid gap-4 lg:grid-cols-2">
            {openSplits.map((s) => {
              const pct = Math.round(
                (Number(s.collected_usdc) / Number(s.total_amount_usdc)) * 100
              );
              const mine = s.members?.find((m) => m.user_id === user?.id);
              const unpaid = (s.members ?? []).filter((m) => !m.paid);
              return (
                <Card key={s.id} className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{s.description}</p>
                      <p className="text-xs text-ink-mute">Bill split</p>
                    </div>
                    <StatusChip status={s.status} />
                  </div>

                  <div>
                    <div className="mb-1.5 flex justify-between text-sm font-semibold">
                      <span className="amount text-ink">
                        {formatUSDC(s.collected_usdc)}{" "}
                        <span className="text-ink-mute">/ {formatUSDC(s.total_amount_usdc)}</span>
                      </span>
                      <span className="tnum text-ink-soft">{pct}%</span>
                    </div>
                    <ProgressBar
                      value={pct}
                      tone={pct >= 100 ? "pos" : "accent"}
                      label={`${s.description} collected`}
                    />
                  </div>

                  {unpaid.length > 0 && (
                    <p className="text-xs leading-relaxed text-ink-soft">
                      <span className="font-semibold">Still owed:</span>{" "}
                      {unpaid
                        .map((m) => `@${m.user?.username} ${formatUSDC(m.amount_owed_usdc)}`)
                        .join(" · ")}
                    </p>
                  )}

                  {mine && !mine.paid && (
                    <Button
                      fullWidth
                      loading={payingSplit === s.id}
                      onClick={() => paySplit(s.id)}
                    >
                      Pay your share · {formatUSDC(mine.amount_owed_usdc)}
                    </Button>
                  )}
                </Card>
              );
            })}

            {openGoals.map((g) => {
              const pct = Math.min(
                100,
                Math.round((Number(g.collected_usdc) / Number(g.target_amount_usdc)) * 100)
              );
              const pendingWithdrawal = g.withdrawal?.find((w) => w.status === "pending");
              const iApproved = pendingWithdrawal?.approvals?.some((a) => a.user_id === user?.id);
              const acting = goalActionBusy === g.id;

              return (
                <Card key={g.id} className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                        <TargetIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-ink">{g.description}</p>
                        <p className="text-xs text-ink-mute">Savings goal</p>
                      </div>
                    </div>
                    <StatusChip status={g.status} />
                  </div>

                  <div>
                    <div className="mb-1.5 flex justify-between text-sm font-semibold">
                      <span className="amount text-ink">
                        {formatUSDC(g.collected_usdc)}{" "}
                        <span className="text-ink-mute">/ {formatUSDC(g.target_amount_usdc)}</span>
                      </span>
                      <span className="tnum text-ink-soft">{pct}%</span>
                    </div>
                    <ProgressBar
                      value={pct}
                      tone={pct >= 100 ? "pos" : "accent"}
                      label={`${g.description} progress`}
                    />
                  </div>

                  {pendingWithdrawal ? (
                    <div className="space-y-2.5 rounded-lg border border-warn-line bg-warn-soft p-3.5">
                      <p className="text-xs font-medium leading-relaxed text-warn">
                        <span className="font-bold">
                          @{pendingWithdrawal.requester?.username}
                        </span>{" "}
                        requested a withdrawal of {formatUSDC(pendingWithdrawal.amount_usdc)} to{" "}
                        <span className="font-bold">
                          @{pendingWithdrawal.recipient?.username}
                        </span>{" "}
                        · {pendingWithdrawal.approvals?.length ?? 0}/{g.members?.length ?? 0}{" "}
                        approved. Contributions are paused until it is paid out or cancelled.
                      </p>
                      <div className="flex gap-2">
                        {!iApproved && (
                          <Button
                            fullWidth
                            size="sm"
                            loading={acting}
                            onClick={() => handleApproveWithdrawal(g.id)}
                          >
                            Approve withdrawal
                          </Button>
                        )}
                        {pendingWithdrawal.requested_by === user?.id && (
                          <Button
                            fullWidth={iApproved}
                            size="sm"
                            variant="ghost"
                            loading={acting}
                            onClick={() => handleGoalAction(g.id, "cancel-withdrawal")}
                          >
                            Cancel request
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Input
                          inputMode="decimal"
                          prefix="$"
                          placeholder="0.00"
                          aria-label={`Contribute to ${g.description}`}
                          className="flex-1"
                          value={contributeAmounts[g.id] ?? ""}
                          onChange={(e) =>
                            setContributeAmounts((a) => ({
                              ...a,
                              [g.id]: e.target.value.replace(/[^0-9.]/g, ""),
                            }))
                          }
                        />
                        <Button
                          loading={acting}
                          disabled={!parseFloat(contributeAmounts[g.id] ?? "")}
                          onClick={() => handleContribute(g.id)}
                        >
                          Contribute
                        </Button>
                      </div>

                      {Number(g.collected_usdc) > 0 && (
                        <div className="flex gap-2 border-t border-line pt-3.5">
                          <Input
                            placeholder="@username"
                            aria-label={`Withdraw ${g.description} to`}
                            className="flex-1"
                            value={withdrawRecipient[g.id] ?? ""}
                            onChange={(e) =>
                              setWithdrawRecipient((r) => ({ ...r, [g.id]: e.target.value }))
                            }
                          />
                          <Button
                            variant="secondary"
                            loading={acting}
                            disabled={!withdrawRecipient[g.id]?.trim()}
                            onClick={() => handleRequestWithdrawal(g.id)}
                          >
                            Withdraw
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {/* A way out when the group can never reach unanimity (lost key, absent member). */}
                  <div className="space-y-2 border-t border-line pt-3.5">
                    {g.dissolve_at ? (
                      <>
                        <p className="text-xs leading-relaxed text-ink-soft">
                          {new Date(g.dissolve_at).getTime() <= Date.now()
                            ? "The exit countdown has finished. Any member can dissolve this goal."
                            : `An exit countdown is running. Any member can dissolve this goal after ${new Date(g.dissolve_at).toLocaleDateString()}.`}{" "}
                          Everyone then claims back exactly what they put in.
                        </p>
                        <div className="flex gap-2">
                          {new Date(g.dissolve_at).getTime() <= Date.now() && (
                            <Button
                              size="sm"
                              variant="danger"
                              loading={acting}
                              onClick={() => handleGoalAction(g.id, "dissolve")}
                            >
                              Dissolve goal
                            </Button>
                          )}
                          {g.dissolve_initiator_id === user?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={acting}
                              onClick={() => handleGoalAction(g.id, "cancel-exit")}
                            >
                              Cancel exit
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs leading-relaxed text-ink-mute">
                          Can&apos;t get everyone to approve? Starting an exit begins a {GOAL_EXIT_DAYS}-day
                          countdown. After it, any member can dissolve the goal and everyone claims back
                          exactly what they put in.
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={acting}
                          onClick={() => handleGoalAction(g.id, "start-exit")}
                        >
                          Exit this goal
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}

            {dissolvedGoals.map((g) => (
              <Card key={g.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{g.description}</p>
                    <p className="text-xs text-ink-mute">Savings goal</p>
                  </div>
                  <StatusChip status={g.status} />
                </div>
                <p className="text-xs leading-relaxed text-ink-soft">
                  This goal was dissolved. If you contributed, your contribution is waiting for you.
                </p>
                <Button
                  fullWidth
                  size="sm"
                  variant="secondary"
                  loading={goalActionBusy === g.id}
                  onClick={() => handleGoalAction(g.id, "claim-refund")}
                >
                  Claim my contribution
                </Button>
              </Card>
            ))}
          </div>
        )}

        {goalError && !showGoal && <Alert>{goalError}</Alert>}

        {/* ------------------------------------------------------ Payments */}
        <section>
          <SectionHeading title="Circle activity" count={payments.length} />
          {payments.length === 0 ? (
            <EmptyState
              icon={<BanknoteIcon className="h-5 w-5" />}
              title="No payments in this circle yet"
              subtitle="Split a bill or start a savings goal to get things moving."
            />
          ) : (
            <ul className="stagger divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-e1">
              {payments.map((p, i) => (
                <li
                  key={p.id}
                  style={{ ["--i" as string]: i }}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-2/60"
                >
                  <Avatar username={p.from_user?.username ?? "?"} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      @{p.from_user?.username} paid @{p.to_user?.username}
                    </p>
                    <p className="truncate text-xs text-ink-mute">
                      {p.note ? `“${p.note}” · ` : ""}
                      {relativeTime(p.created_at)}
                    </p>
                  </div>
                  <p className="amount shrink-0 text-sm font-bold text-ink">
                    {formatUSDC(p.amount_usdc)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
