/**
 * Testnet tracker: every recorded transaction, classified by what it did and which contract it went
 * through, plus each tester's progress through the eligibility stages.
 *
 * Read from the database, which only records a transaction after the server has checked it on-chain
 * (see the confirm routes), so a row here is a transaction that really happened.
 */
import { getSupabaseAdmin } from "@/lib/supabase";

import { STAGES, TX_KINDS, type StageId, type TxKind } from "@/lib/testnet";

export { STAGES, TX_KINDS, type StageId, type TxKind };

export interface TrackerEvent {
  kind: TxKind;
  at: string;
  userId: string;
  counterpartyId: string | null;
  amount: number;
  txHash: string | null;
}

export interface TrackerInput {
  users: { id: string; username: string; wallet_address: string | null; created_at: string; referred_by?: string | null }[];
  circles: { id: string; creator_id: string; created_at: string }[];
  payments: {
    id: string;
    from_user_id: string | null;
    to_user_id: string;
    amount_usdc: number | string;
    tx_hash: string | null;
    status: string | null;
    circle_id: string | null;
    created_at: string;
  }[];
  splits: { id: string; creator_id: string; contract_split_id: string | null; total_amount_usdc: number | string; created_at: string }[];
  split_members: { split_id: string; user_id: string; amount_owed_usdc: number | string; paid: boolean | null; payment_id: string | null; paid_at: string | null }[];
  circle_goals: { id: string; creator_id: string; contract_goal_id: string | null; target_amount_usdc: number | string; created_at: string }[];
  goal_contributions: { id: string; goal_id: string; user_id: string; amount_usdc: number | string; tx_hash: string | null; created_at: string }[];
}

export interface Participant {
  username: string;
  address: string | null;
  joinedAt: string;
  lastActiveAt: string | null;
  counts: Record<TxKind, number>;
  /** Transactions the tester signed themselves (deposits and payouts they received are left out). */
  txCount: number;
  /** USDC the tester moved out: sends, split payments and goal contributions. */
  volume: number;
  circlesCreated: number;
  referrals: number;
  stages: Record<StageId, boolean>;
  eligible: boolean;
}

export interface TrackerData {
  generatedAt: string;
  totals: {
    users: number;
    wallets: number;
    eligible: number;
    transactions: number;
    volume: number;
    circles: number;
    byKind: Record<TxKind, { count: number; volume: number }>;
  };
  stages: { id: StageId; label: string; required: boolean; users: number }[];
  participants: Participant[];
  recent: (Omit<TrackerEvent, "userId" | "counterpartyId"> & {
    username: string;
    address: string | null;
    counterparty: string | null;
  })[];
}

/** Kinds the tester signed, as opposed to money that arrived in their wallet. */
const OUTGOING: TxKind[] = ["send", "group_send", "split_create", "split_pay", "goal_create", "goal_contribute"];
/** Kinds that move the tester's USDC out, and so count toward their volume. */
const MOVES_MONEY: TxKind[] = ["send", "group_send", "split_pay", "goal_contribute"];

const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;
const zeroCounts = () => Object.fromEntries(Object.keys(TX_KINDS).map((k) => [k, 0])) as Record<TxKind, number>;

/** Turn the raw tables into one event per on-chain transaction. */
export function classify(input: TrackerInput): TrackerEvent[] {
  const events: TrackerEvent[] = [];
  const splitPaymentIds = new Set(input.split_members.map((m) => m.payment_id).filter(Boolean));

  for (const p of input.payments) {
    if (splitPaymentIds.has(p.id)) continue; // reported from split_members below
    if (p.status === "failed") continue;
    const amount = num(p.amount_usdc);
    if (p.from_user_id === null) {
      // Money arriving with no Coven sender: a goal paying out to its recipient, or a deposit
      // from outside (the faucet, another wallet, a cross-chain payment).
      events.push({
        kind: p.circle_id ? "goal_payout" : "deposit",
        at: p.created_at,
        userId: p.to_user_id,
        counterpartyId: null,
        amount,
        txHash: p.tx_hash,
      });
      continue;
    }
    if (p.status !== "completed") continue; // an unverified cross-chain send is not settled yet
    events.push({
      kind: p.circle_id ? "group_send" : "send",
      at: p.created_at,
      userId: p.from_user_id,
      counterpartyId: p.to_user_id,
      amount,
      txHash: p.tx_hash,
    });
  }

  const paymentById = new Map(input.payments.map((p) => [p.id, p]));
  for (const m of input.split_members) {
    if (!m.paid) continue;
    const payment = m.payment_id ? paymentById.get(m.payment_id) : undefined;
    events.push({
      kind: "split_pay",
      at: m.paid_at ?? payment?.created_at ?? "",
      userId: m.user_id,
      counterpartyId: null,
      amount: num(m.amount_owed_usdc),
      txHash: payment?.tx_hash ?? null,
    });
  }

  for (const s of input.splits) {
    if (!s.contract_split_id) continue; // legacy off-chain split
    events.push({ kind: "split_create", at: s.created_at, userId: s.creator_id, counterpartyId: null, amount: num(s.total_amount_usdc), txHash: null });
  }
  for (const g of input.circle_goals) {
    if (!g.contract_goal_id) continue; // never confirmed on-chain
    events.push({ kind: "goal_create", at: g.created_at, userId: g.creator_id, counterpartyId: null, amount: num(g.target_amount_usdc), txHash: null });
  }
  for (const c of input.goal_contributions) {
    events.push({ kind: "goal_contribute", at: c.created_at, userId: c.user_id, counterpartyId: null, amount: num(c.amount_usdc), txHash: c.tx_hash });
  }

  return events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function buildTracker(input: TrackerInput, recentLimit = 100): TrackerData {
  const events = classify(input);
  const userById = new Map(input.users.map((u) => [u.id, u]));

  const circlesBy = new Map<string, number>();
  for (const c of input.circles) circlesBy.set(c.creator_id, (circlesBy.get(c.creator_id) ?? 0) + 1);
  const referralsBy = new Map<string, number>();
  // Invitees who went on to set up a wallet. Only these complete the invite stage, so a sign-up
  // that never got past the username screen does not count.
  const activeReferralsBy = new Map<string, number>();
  for (const u of input.users) {
    if (!u.referred_by) continue;
    referralsBy.set(u.referred_by, (referralsBy.get(u.referred_by) ?? 0) + 1);
    if (u.wallet_address) activeReferralsBy.set(u.referred_by, (activeReferralsBy.get(u.referred_by) ?? 0) + 1);
  }

  const byUser = new Map<string, TrackerEvent[]>();
  for (const e of events) {
    const list = byUser.get(e.userId) ?? [];
    list.push(e);
    byUser.set(e.userId, list);
  }

  const participants: Participant[] = input.users.map((u) => {
    const mine = byUser.get(u.id) ?? [];
    const counts = zeroCounts();
    let volume = 0;
    for (const e of mine) {
      counts[e.kind]++;
      if (MOVES_MONEY.includes(e.kind)) volume += e.amount;
    }
    const txCount = OUTGOING.reduce((n, k) => n + counts[k], 0);
    const circlesCreated = circlesBy.get(u.id) ?? 0;
    const stages: Record<StageId, boolean> = {
      wallet: Boolean(u.wallet_address),
      funded: counts.deposit > 0 || volume > 0,
      circle: circlesCreated > 0,
      send: counts.send + counts.group_send > 0,
      split: counts.split_create + counts.split_pay > 0,
      goal: counts.goal_contribute > 0,
      invite: (activeReferralsBy.get(u.id) ?? 0) > 0,
    };
    return {
      username: u.username,
      address: u.wallet_address,
      joinedAt: u.created_at,
      lastActiveAt: mine[0]?.at || null,
      counts,
      txCount,
      volume: round(volume),
      circlesCreated,
      referrals: referralsBy.get(u.id) ?? 0,
      stages,
      eligible: STAGES.every((s) => !s.required || stages[s.id]),
    };
  });

  participants.sort(
    (a, b) =>
      Number(b.eligible) - Number(a.eligible) ||
      b.txCount - a.txCount ||
      b.volume - a.volume ||
      a.joinedAt.localeCompare(b.joinedAt)
  );

  const byKind = Object.fromEntries(Object.keys(TX_KINDS).map((k) => [k, { count: 0, volume: 0 }])) as TrackerData["totals"]["byKind"];
  for (const e of events) {
    byKind[e.kind].count++;
    byKind[e.kind].volume = round(byKind[e.kind].volume + e.amount);
  }

  const outgoing = events.filter((e) => OUTGOING.includes(e.kind));
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      users: input.users.length,
      wallets: input.users.filter((u) => u.wallet_address).length,
      eligible: participants.filter((p) => p.eligible).length,
      transactions: outgoing.length,
      volume: round(outgoing.filter((e) => MOVES_MONEY.includes(e.kind)).reduce((n, e) => n + e.amount, 0)),
      circles: input.circles.length,
      byKind,
    },
    stages: STAGES.map((s) => ({ ...s, users: participants.filter((p) => p.stages[s.id]).length })),
    participants,
    recent: events.slice(0, recentLimit).map((e) => {
      const u = userById.get(e.userId);
      return {
        kind: e.kind,
        at: e.at,
        amount: e.amount,
        txHash: e.txHash,
        username: u?.username ?? "unknown",
        address: u?.wallet_address ?? null,
        counterparty: e.counterpartyId ? userById.get(e.counterpartyId)?.username ?? null : null,
      };
    }),
  };
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

const PAGE = 1000;

/** Every row of a table, a page at a time (PostgREST caps one response at 1000 rows). */
async function allRows<T>(table: string, columns: string, orderBy: string[]): Promise<T[]> {
  const admin = getSupabaseAdmin();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    // A unique sort order, so a row cannot fall between two pages or appear on both.
    let query = admin.from(table).select(columns);
    for (const column of orderBy) query = query.order(column, { ascending: true });
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function loadTrackerInput(): Promise<TrackerInput> {
  const [users, circles, payments, splits, split_members, circle_goals, goal_contributions] = await Promise.all([
    allRows<TrackerInput["users"][number]>("users", "id, username, wallet_address, created_at, referred_by", ["created_at", "id"]),
    allRows<TrackerInput["circles"][number]>("circles", "id, creator_id, created_at", ["created_at", "id"]),
    allRows<TrackerInput["payments"][number]>("payments", "id, from_user_id, to_user_id, amount_usdc, tx_hash, status, circle_id, created_at", ["created_at", "id"]),
    allRows<TrackerInput["splits"][number]>("splits", "id, creator_id, contract_split_id, total_amount_usdc, created_at", ["created_at", "id"]),
    allRows<TrackerInput["split_members"][number]>("split_members", "split_id, user_id, amount_owed_usdc, paid, payment_id, paid_at", ["split_id", "user_id"]),
    allRows<TrackerInput["circle_goals"][number]>("circle_goals", "id, creator_id, contract_goal_id, target_amount_usdc, created_at", ["created_at", "id"]),
    allRows<TrackerInput["goal_contributions"][number]>("goal_contributions", "id, goal_id, user_id, amount_usdc, tx_hash, created_at", ["created_at", "id"]),
  ]);
  return { users, circles, payments, splits, split_members, circle_goals, goal_contributions };
}

/**
 * The tracker data, rebuilt at most every 30 seconds per server instance so a busy tracker page and
 * every tester's Settings screen do not re-read every table on each request.
 */
const TTL_MS = 30_000;
let cached: { at: number; data: TrackerData } | null = null;
let building: Promise<TrackerData> | null = null;

export async function cachedTracker(): Promise<TrackerData> {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    building ??= loadTrackerInput()
      .then((input) => buildTracker(input))
      .finally(() => {
        building = null;
      });
    cached = { at: Date.now(), data: await building };
  }
  return cached.data;
}
