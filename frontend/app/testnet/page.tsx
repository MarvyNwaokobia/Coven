"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CovenMark, SearchIcon, CheckCircleIcon } from "@/components/Icons";
import { Card, SectionHeading, Skeleton, Alert, Button } from "@/components/ui";
import { formatUSDC, relativeTime } from "@/lib/format";
import { NETWORK, NETWORK_LABEL } from "@/lib/network";
import { STAGES, TX_KINDS, type TxKind } from "@/lib/testnet";
import type { TrackerData, Participant } from "@/lib/server/testnet-tracker";
import { getSupabaseBrowser } from "@/lib/supabase";

/* ============================================================================
   Core-team testnet tracker: totals, stage progress, every tester's progress
   and the live transaction feed. Data from /api/testnet (team emails only),
   refreshed every 30s. Opens with the shared access code (or a team sign-in);
   anyone else sees the code form and no data.
   ========================================================================== */

const REFRESH_MS = 30_000;
const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ?? (NETWORK === "testnet" ? "https://explorer.testnet.arc.io" : undefined);
const PAGE_SIZE = 50;

const KIND_TONE: Record<string, string> = {
  "USDC transfer": "bg-accent-soft text-accent border-accent-line",
  SplitEscrow: "bg-warn-soft text-warn border-warn-line",
  GoalPool: "bg-pos-soft text-pos border-pos-line",
  "Inbound USDC": "bg-surface-2 text-ink-soft border-line",
};

const shortAddress = (a: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

function AddressLink({ address }: { address: string | null }) {
  if (!address) return <span className="text-ink-mute">—</span>;
  const text = <span className="font-mono text-xs">{shortAddress(address)}</span>;
  return EXPLORER_URL ? (
    <a href={`${EXPLORER_URL}/address/${address}`} target="_blank" rel="noreferrer" className="text-accent hover:underline" title={address}>
      {text}
    </a>
  ) : (
    text
  );
}

function KindBadge({ kind }: { kind: TxKind }) {
  const info = TX_KINDS[kind];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.6875rem] font-bold ${KIND_TONE[info.contract] ?? ""}`}>
      {info.label}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="tnum mt-1 text-2xl font-extrabold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-mute">{hint}</p>}
    </Card>
  );
}

function toCsv(rows: Participant[]): string {
  const kinds = Object.keys(TX_KINDS) as TxKind[];
  const header = ["username", "address", "eligible", ...STAGES.map((s) => s.id), "tx_count", "volume_usdc", ...kinds, "circles_created", "referrals", "joined_at", "last_active_at"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((p) =>
    [p.username, p.address, p.eligible, ...STAGES.map((s) => p.stages[s.id]), p.txCount, p.volume, ...kinds.map((k) => p.counts[k]), p.circlesCreated, p.referrals, p.joinedAt, p.lastActiveAt]
      .map(esc)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const CODE_KEY = "coven-tracker-code";

/** The access code is remembered on this device so the team does not retype it on every visit. */
function readCode(): string | null {
  try {
    return localStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
}

function storeCode(code: string | null) {
  try {
    if (code) localStorage.setItem(CODE_KEY, code);
    else localStorage.removeItem(CODE_KEY);
  } catch {
    // storage blocked: the code just is not remembered
  }
}

export default function TestnetTrackerPage() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [feedKind, setFeedKind] = useState<TxKind | "all">("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [gate, setGate] = useState<"checking" | "open" | "locked">("checking");
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const codeRef = useRef<string | null>(null);

  /** Returns false when the server refused the credentials. */
  const load = useCallback(async (): Promise<boolean> => {
    try {
      const headers: Record<string, string> = {};
      if (codeRef.current) headers["x-access-code"] = codeRef.current;
      const { data: auth } = await getSupabaseBrowser().auth.getSession();
      if (auth.session?.access_token) headers.Authorization = `Bearer ${auth.session.access_token}`;

      const res = await fetch("/api/testnet", { cache: "no-store", headers });
      if (res.status === 401 || res.status === 403) {
        if (codeRef.current) {
          codeRef.current = null;
          storeCode(null);
          setCodeError("That access code is not right.");
        }
        setGate("locked");
        setData(null);
        return false;
      }
      setGate("open");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Tracker is unavailable");
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tracker is unavailable");
    }
    return true;
  }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    const code = codeInput.trim();
    if (!code) return;
    setUnlocking(true);
    setCodeError(null);
    codeRef.current = code;
    if (await load()) storeCode(code);
    setUnlocking(false);
  }

  useEffect(() => {
    codeRef.current = readCode();
    load();
  }, [load]);

  useEffect(() => {
    if (gate !== "open") return;
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [gate, load]);

  const participants = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase().replace(/^@/, "");
    return data.participants.filter(
      (p) =>
        (!onlyEligible || p.eligible) &&
        (!q || p.username.toLowerCase().includes(q) || (p.address ?? "").toLowerCase().includes(q))
    );
  }, [data, query, onlyEligible]);

  const feed = useMemo(
    () => (data ? data.recent.filter((e) => feedKind === "all" || e.kind === feedKind) : []),
    [data, feedKind]
  );

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <CovenMark className="h-7 w-7 text-accent" />
            <span className="text-lg font-extrabold tracking-tight text-ink">Coven</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/docs" className="rounded-lg px-2.5 py-2 text-sm font-semibold text-ink-soft hover:text-ink">Docs</Link>
          <a href="/whitepaper" target="_blank" rel="noopener noreferrer" className="hidden rounded-lg px-2.5 py-2 text-sm font-semibold text-ink-soft hover:text-ink sm:inline-block">Whitepaper</a>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {NETWORK_LABEL}
          </span>
          </div>
        </div>
      </header>

      {gate !== "open" ? (
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          {gate === "checking" ? (
            <Skeleton className="mx-auto h-24" />
          ) : (
            <Card className="py-8">
              <h1 className="text-xl font-extrabold tracking-tight text-ink">Team only</h1>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                The testnet tracker is for the Coven core team. Enter the access code to open it.
              </p>
              <form onSubmit={unlock} className="mt-5 space-y-3 text-left">
                <label className="block">
                  <span className="sr-only">Access code</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="Access code"
                    className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                {codeError && <p className="text-sm font-semibold text-neg">{codeError}</p>}
                <Button type="submit" fullWidth loading={unlocking} disabled={!codeInput.trim()}>
                  Open tracker
                </Button>
              </form>
            </Card>
          )}
        </main>
      ) : (
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Testnet tracker</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Internal view for the core team: every verified testnet transaction and each tester&apos;s progress. A tester is
            eligible once every required stage is ticked. Updates every 30 seconds
            {data && <> · last updated {relativeTime(data.generatedAt)}</>}.
          </p>
        </div>

        {error && <Alert tone="neg">{error}</Alert>}

        {/* Totals */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {data ? (
            <>
              <Stat label="Testers" value={data.totals.users.toLocaleString()} hint={`${data.totals.wallets.toLocaleString()} with a wallet`} />
              <Stat label="Eligible" value={data.totals.eligible.toLocaleString()} />
              <Stat label="Transactions" value={data.totals.transactions.toLocaleString()} />
              <Stat label="USDC moved" value={formatUSDC(data.totals.volume)} />
              <Stat label="Circles" value={data.totals.circles.toLocaleString()} />
            </>
          ) : (
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24" />)
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Stage progress */}
          <section>
            <SectionHeading title="Eligibility stages" />
            <Card className="space-y-3.5">
              {data
                ? data.stages.map((s) => {
                    const pct = data.totals.users ? (s.users / data.totals.users) * 100 : 0;
                    return (
                      <div key={s.id}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-semibold text-ink">
                            {s.label}
                            {!s.required && <span className="ml-1.5 text-xs font-normal text-ink-mute">optional</span>}
                          </span>
                          <span className="tnum text-ink-soft">
                            {s.users.toLocaleString()} <span className="text-ink-mute">({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                : <Skeleton className="h-56" />}
            </Card>
          </section>

          {/* By contract */}
          <section>
            <SectionHeading title="Activity by type" />
            <Card className="p-0">
              {data ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-ink-soft">
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 font-semibold">Contract</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Count</th>
                      <th className="px-4 py-2.5 text-right font-semibold">USDC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(TX_KINDS) as TxKind[]).map((k) => (
                      <tr key={k} className="border-b border-line last:border-0">
                        <td className="px-4 py-2"><KindBadge kind={k} /></td>
                        <td className="px-4 py-2 text-ink-soft">{TX_KINDS[k].contract}</td>
                        <td className="tnum px-4 py-2 text-right text-ink">{data.totals.byKind[k].count.toLocaleString()}</td>
                        <td className="tnum px-4 py-2 text-right text-ink">{formatUSDC(data.totals.byKind[k].volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Skeleton className="h-56" />
              )}
            </Card>
          </section>
        </div>

        {/* Leaderboard */}
        <section>
          <SectionHeading
            title="Testers"
            count={participants.length}
            action={
              data && (
                <Button variant="secondary" size="sm" onClick={() => download(`coven-testnet-${data.generatedAt.slice(0, 10)}.csv`, toCsv(participants))}>
                  Export CSV
                </Button>
              )
            }
          />
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(PAGE_SIZE);
                }}
                placeholder="Search @username or 0x address"
                className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={onlyEligible} onChange={(e) => setOnlyEligible(e.target.checked)} />
              Eligible only
            </label>
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="px-4 py-2.5 font-semibold">#</th>
                  <th className="px-4 py-2.5 font-semibold">Tester</th>
                  <th className="px-4 py-2.5 font-semibold">Address</th>
                  {STAGES.map((s) => (
                    <th key={s.id} className="px-2 py-2.5 text-center font-semibold" title={s.label}>
                      {s.label.split(" ")[0]}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-semibold">Txs</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Volume</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {!data && (
                  <tr>
                    <td colSpan={STAGES.length + 6} className="p-4"><Skeleton className="h-40" /></td>
                  </tr>
                )}
                {data && participants.length === 0 && (
                  <tr>
                    <td colSpan={STAGES.length + 6} className="px-4 py-10 text-center text-ink-soft">No testers match.</td>
                  </tr>
                )}
                {participants.slice(0, shown).map((p, i) => (
                  <tr key={p.username} className="border-b border-line last:border-0">
                    <td className="tnum px-4 py-2.5 text-ink-mute">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-ink">@{p.username}</span>
                      <span className="block text-xs text-ink-mute">
                        {p.lastActiveAt ? `active ${relativeTime(p.lastActiveAt)}` : `joined ${relativeTime(p.joinedAt)}`}
                        {p.referrals > 0 && ` · ${p.referrals} invited`}
                      </span>
                    </td>
                    <td className="px-4 py-2.5"><AddressLink address={p.address} /></td>
                    {STAGES.map((s) => (
                      <td key={s.id} className="px-2 py-2.5 text-center">
                        {p.stages[s.id] ? (
                          <CheckCircleIcon className="mx-auto h-4 w-4 text-pos" aria-label="done" />
                        ) : (
                          <span className="text-ink-mute" aria-label="not yet">·</span>
                        )}
                      </td>
                    ))}
                    <td className="tnum px-4 py-2.5 text-right text-ink" title={(Object.keys(TX_KINDS) as TxKind[]).filter((k) => p.counts[k]).map((k) => `${TX_KINDS[k].label}: ${p.counts[k]}`).join("\n")}>
                      {p.txCount}
                    </td>
                    <td className="tnum px-4 py-2.5 text-right text-ink">{formatUSDC(p.volume)}</td>
                    <td className="px-4 py-2.5">
                      {p.eligible ? (
                        <span className="rounded-full border border-pos-line bg-pos-soft px-2 py-0.5 text-[0.6875rem] font-bold text-pos">Eligible</span>
                      ) : (
                        <span className="text-xs text-ink-mute">
                          {STAGES.filter((s) => s.required && p.stages[s.id]).length}/{STAGES.filter((s) => s.required).length}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {participants.length > shown && (
            <div className="mt-3 text-center">
              <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                Show more
              </Button>
            </div>
          )}
        </section>

        {/* Live feed */}
        <section>
          <SectionHeading title="Latest transactions" />
          <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 py-1">
            {(["all", ...Object.keys(TX_KINDS)] as (TxKind | "all")[]).map((k) => (
              <button
                key={k}
                onClick={() => setFeedKind(k)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                  feedKind === k ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink-soft hover:border-line-strong"
                }`}
              >
                {k === "all" ? "All" : TX_KINDS[k].label}
              </button>
            ))}
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="px-4 py-2.5 font-semibold">When</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Contract</th>
                  <th className="px-4 py-2.5 font-semibold">Tester</th>
                  <th className="px-4 py-2.5 font-semibold">Address</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 font-semibold">Tx</th>
                </tr>
              </thead>
              <tbody>
                {data && feed.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-ink-soft">No transactions yet.</td>
                  </tr>
                )}
                {feed.map((e, i) => (
                  <tr key={`${e.txHash ?? e.at}-${i}`} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">{e.at ? relativeTime(e.at) : "—"}</td>
                    <td className="px-4 py-2.5"><KindBadge kind={e.kind} /></td>
                    <td className="px-4 py-2.5 text-ink-soft">{TX_KINDS[e.kind].contract}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-ink">@{e.username}</span>
                      {e.counterparty && <span className="text-ink-mute"> → @{e.counterparty}</span>}
                    </td>
                    <td className="px-4 py-2.5"><AddressLink address={e.address} /></td>
                    <td className="tnum px-4 py-2.5 text-right text-ink">{formatUSDC(e.amount)}</td>
                    <td className="px-4 py-2.5">
                      {e.txHash?.startsWith("0x") && EXPLORER_URL ? (
                        <a href={`${EXPLORER_URL}/tx/${e.txHash}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent hover:underline">
                          {shortAddress(e.txHash)}
                        </a>
                      ) : (
                        <span className="text-ink-mute">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      </main>
      )}
    </div>
  );
}
