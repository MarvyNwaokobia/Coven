"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { SkeletonList, EmptyState, Button, Alert } from "@/components/ui";
import { HistoryIcon, ReceiveIcon, SendIcon } from "@/components/Icons";
import { api, apiDownload } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC } from "@/lib/format";
import TransactionDetails from "@/components/TransactionDetails";
import { receiptFromStatement, statementTitle } from "@/lib/receipt";
import { STATEMENT_KINDS, type StatementRow, type Totals } from "@/lib/statement-types";

type Direction = "all" | "in" | "out";
type PresetId = "all" | "month" | "lastMonth" | "last3" | "year" | "custom";

const DIRECTIONS: { id: Direction; label: string }[] = [
  { id: "all", label: "All" },
  { id: "in", label: "Money in" },
  { id: "out", label: "Money out" },
];

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "month", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "last3", label: "Last 3 months" },
  { id: "year", label: "This year" },
  { id: "custom", label: "Custom dates" },
];

interface Range {
  from?: string;
  to?: string;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
/** A yyyy-mm-dd from a date input, read as a day on this device's calendar. */
const localDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function rangeFor(preset: PresetId, customFrom: string, customTo: string): Range {
  const now = new Date();
  switch (preset) {
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
    case "lastMonth":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString(),
      };
    case "last3":
      return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString() };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1).toISOString() };
    case "custom":
      return {
        from: customFrom ? startOfDay(localDay(customFrom)).toISOString() : undefined,
        to: customTo ? endOfDay(localDay(customTo)).toISOString() : undefined,
      };
    default:
      return {};
  }
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return null;
  const tone =
    status === "failed"
      ? "border-neg-line bg-neg-soft text-neg"
      : "border-warn-line bg-warn-soft text-warn";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[0.6875rem] font-bold capitalize ${tone}`}>{status}</span>
  );
}

function Row({ r, onOpen }: { r: StatementRow; onOpen: (r: StatementRow) => void }) {
  const incoming = r.direction === "in";
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(r)}
        aria-label={`${statementTitle(r)}, ${incoming ? "received" : "sent"} ${formatUSDC(r.amount)}. View details`}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            incoming ? "bg-pos-soft text-pos" : "bg-surface-2 text-ink-soft"
          }`}
        >
          {incoming ? <ReceiveIcon className="h-4 w-4" /> : <SendIcon className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{statementTitle(r)}</p>
          <p className="truncate text-xs text-ink-mute">
            {STATEMENT_KINDS[r.kind].label} ·{" "}
            {new Date(r.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            {r.note ? ` · ${r.note}` : ""}
          </p>
        </div>
        <div className="shrink-0 space-y-1 text-right">
          <p className={`amount text-sm font-extrabold ${incoming ? "text-pos" : "text-ink"}`}>
            {incoming ? "+" : "−"}
            {formatUSDC(r.amount)}
          </p>
          <StatusBadge status={r.status} />
        </div>
      </button>
    </li>
  );
}

const CHIP =
  "min-h-9 shrink-0 cursor-pointer rounded-full border px-4 text-xs font-bold transition-[background-color,border-color,color,translate,scale] duration-200 ease-out-soft active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
const chipTone = (on: boolean) =>
  on ? "border-brand bg-brand text-white shadow-e1" : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink";

export default function HistoryPage() {
  const { user } = useAuth();
  const [preset, setPreset] = useState<PresetId>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [direction, setDirection] = useState<Direction>("all");

  const [rows, setRows] = useState<StatementRow[] | null>(null);
  const [open, setOpen] = useState<StatementRow | null>(null);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const rangeQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (range.from) q.set("from", range.from);
    if (range.to) q.set("to", range.to);
    return q;
  }, [range]);
  const customInvalid = preset === "custom" && !!customFrom && !!customTo && customFrom > customTo;

  type Page = { rows: StatementRow[]; total: number; nextOffset: number | null; totals: Totals; truncated: boolean };

  // A new range or direction starts again from the newest.
  useEffect(() => {
    if (!user || customInvalid) return;
    let stale = false;
    setRows(null);
    setError("");
    const q = new URLSearchParams(rangeQuery);
    q.set("direction", direction);
    api<Page>(`/api/history?${q}`)
      .then((p) => {
        if (stale) return;
        setRows(p.rows);
        setTotal(p.total);
        setTotals(p.totals);
        setNextOffset(p.nextOffset);
        setTruncated(p.truncated);
      })
      .catch((e) => {
        if (stale) return;
        setRows([]);
        setError(e instanceof Error ? e.message : "Could not load your history");
      });
    return () => {
      stale = true;
    };
  }, [user, rangeQuery, direction, customInvalid]);

  const loadMore = useCallback(async () => {
    if (nextOffset === null) return;
    setLoadingMore(true);
    try {
      const q = new URLSearchParams(rangeQuery);
      q.set("direction", direction);
      q.set("offset", String(nextOffset));
      const p = await api<Page>(`/api/history?${q}`);
      setRows((r) => [...(r ?? []), ...p.rows]);
      setNextOffset(p.nextOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more");
    } finally {
      setLoadingMore(false);
    }
  }, [nextOffset, rangeQuery, direction]);

  async function download() {
    setDownloading(true);
    setError("");
    try {
      await apiDownload(`/api/history/export?${rangeQuery}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  // Heading above the first row of each day.
  const grouped = useMemo(() => {
    const out: { day: string; rows: StatementRow[] }[] = [];
    for (const r of rows ?? []) {
      const day = dayLabel(r.at);
      const last = out[out.length - 1];
      if (last?.day === day) last.rows.push(r);
      else out.push({ day, rows: [r] });
    }
    return out;
  }, [rows]);

  return (
    <AppShell title="Transaction history" subtitle="Everything that moved through your account">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Dates */}
        <div className="scroll-fade-x no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1" role="group" aria-label="Date range">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => setPreset(p.id)} aria-pressed={preset === p.id} className={`${CHIP} ${chipTone(preset === p.id)}`}>
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "From", value: customFrom, set: setCustomFrom, max: customTo || undefined, min: undefined },
              { label: "To", value: customTo, set: setCustomTo, max: undefined, min: customFrom || undefined },
            ].map((f) => (
              <label key={f.label} className="space-y-1 text-xs font-semibold text-ink-soft">
                {f.label}
                <input
                  type="date"
                  value={f.value}
                  min={f.min}
                  max={f.max}
                  onChange={(e) => f.set(e.target.value)}
                  className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </label>
            ))}
          </div>
        )}
        {customInvalid && <Alert>The start date is after the end date.</Alert>}

        {/* Direction */}
        <div className="flex gap-2" role="group" aria-label="Direction">
          {DIRECTIONS.map((d) => (
            <button key={d.id} onClick={() => setDirection(d.id)} aria-pressed={direction === d.id} className={`${CHIP} ${chipTone(direction === d.id)}`}>
              {d.label}
            </button>
          ))}
        </div>

        {/* In / out for the whole range, not just the rows loaded so far */}
        {totals && rows !== null && totals.count > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-e1">
              <p className="text-xs font-semibold text-ink-soft">Money in</p>
              <p className="amount mt-1 text-xl font-extrabold text-pos">+{formatUSDC(totals.moneyIn)}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-e1">
              <p className="text-xs font-semibold text-ink-soft">Money out</p>
              <p className="amount mt-1 text-xl font-extrabold text-ink">−{formatUSDC(totals.moneyOut)}</p>
            </div>
          </div>
        )}

        {/* Export */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-mute">
            {rows === null ? "Loading…" : `${total} ${total === 1 ? "transaction" : "transactions"}`}
            {totals && totals.count > 0 && ` · ${totals.count} settled`}
          </p>
          <div className="flex gap-2">
            {customInvalid ? (
              <Button size="sm" variant="secondary" disabled>
                Download PDF
              </Button>
            ) : (
              <a
                href={`/history/statement?${rangeQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-sm font-bold text-ink shadow-e1 transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Download PDF
              </a>
            )}
            <Button size="sm" variant="secondary" onClick={download} loading={downloading} disabled={customInvalid}>
              Download CSV
            </Button>
          </div>
        </div>

        {error && <Alert>{error}</Alert>}
        {truncated && (
          <Alert>This range has a very large number of transactions. Narrow the dates to see all of them.</Alert>
        )}

        {rows === null ? (
          <SkeletonList rows={6} />
        ) : rows.length === 0 && !error ? (
          <EmptyState
            icon={<HistoryIcon className="h-5 w-5" />}
            title="No transactions here"
            subtitle={preset === "all" && direction === "all" ? "Payments you send and receive will show up here." : "Try a different date range or filter."}
            action={
              preset !== "all" || direction !== "all" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPreset("all");
                    setDirection("all");
                  }}
                >
                  Show everything
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => (
              <section key={g.day} aria-label={g.day} className="space-y-2">
                <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-mute">{g.day}</h2>
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-e1">
                  {g.rows.map((r) => (
                    <Row key={r.id} r={r} onOpen={(row) => setOpen(row)} />
                  ))}
                </ul>
              </section>
            ))}
            {nextOffset !== null && (
              <div className="flex justify-center pt-1">
                <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="px-1 text-xs leading-relaxed text-ink-mute">
          The CSV and PDF cover the dates you picked. CSV times are in UTC; the PDF uses your time zone. For a PDF, choose “Save as PDF” in the print window. Pending and failed payments are listed but not counted in the totals.
        </p>
      </div>
      {open && (
        <TransactionDetails receipt={receiptFromStatement(open)} username={user?.username} onClose={() => setOpen(null)} />
      )}
    </AppShell>
  );
}
