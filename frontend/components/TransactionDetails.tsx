"use client";

import { useEffect, useRef, useState } from "react";
import { CovenMark, CopyIcon, CheckCircleIcon } from "./Icons";
import { Spinner } from "./ui";
import { formatUSDC } from "@/lib/format";
import { explorerTxUrl } from "@/lib/explorer";
import { NETWORK_LABEL } from "@/lib/network";
import { formatReceiptDate, receiptText, STATUS_LABELS, type Receipt } from "@/lib/receipt";

const STATUS_TONE: Record<string, string> = {
  completed: "bg-pos-soft text-pos border-pos-line",
  pending: "bg-warn-soft text-warn border-warn-line",
  processing: "bg-warn-soft text-warn border-warn-line",
  failed: "bg-neg-soft text-neg border-neg-line",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard can be blocked (older iOS, insecure context): fall back to a temporary textarea.
      const t = document.createElement("textarea");
      t.value = value;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(t);
      }
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={done ? `${label} copied` : `Copy ${label}`}
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-mute transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {done ? <CheckCircleIcon className="h-4 w-4 text-pos" /> : <CopyIcon className="h-4 w-4" />}
    </button>
  );
}

function Field({ label, children, copy }: { label: string; children: React.ReactNode; copy?: { value: string; label: string } }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-xs font-semibold text-ink-mute">{label}</dt>
      <dd className="flex min-w-0 items-start gap-1 text-right text-sm font-semibold text-ink">
        <span className="min-w-0 break-all">{children}</span>
        {copy && <CopyButton value={copy.value} label={copy.label} />}
      </dd>
    </div>
  );
}

/**
 * Full transaction details, laid out like a receipt so a screenshot works as proof of payment.
 * Pass `receipt` once it is known; while it loads, pass `loading`, and on failure `error`.
 */
export default function TransactionDetails({
  receipt,
  loading,
  error,
  username,
  onClose,
}: {
  receipt: Receipt | null;
  loading?: boolean;
  error?: string;
  /** The signed-in user's handle, so the receipt can name both sides. */
  username?: string;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Parents often pass a fresh onClose each render; keep it in a ref so the effect below runs once.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [shared, setShared] = useState<"" | "copied">("");

  // Escape closes; the page behind stops scrolling; focus moves into the dialog and returns after.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const tx = receipt?.txHash ? explorerTxUrl(receipt.txHash) : undefined;
  const sign = receipt?.direction === "in" ? "+" : receipt?.direction === "out" ? "−" : "";
  const text = receipt ? receiptText(receipt, { username, network: NETWORK_LABEL, money: formatUSDC }) : "";

  async function share() {
    if (!receipt) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Coven receipt", text });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShared("copied");
      setTimeout(() => setShared(""), 1800);
    } catch {
      // Nothing more to try; the per-field copy buttons still work.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="animate-fade-in absolute inset-0 cursor-default bg-black/55"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Transaction details"
        tabIndex={-1}
        className="animate-slide-up pb-safe relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-surface shadow-e4 focus-visible:outline-none sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <CovenMark className="h-6 w-6 text-accent" />
            <span className="text-sm font-extrabold tracking-tight text-ink">Transaction details</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink-mute transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 pt-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2.5 py-16 text-sm font-medium text-ink-soft">
              <Spinner /> Loading details…
            </div>
          ) : error || !receipt ? (
            <p role="alert" className="py-10 text-center text-sm font-semibold text-neg">
              {error || "Could not load this transaction."}
            </p>
          ) : (
            <>
              <div className="text-center">
                <p className="text-xs font-semibold text-ink-mute">{receipt.title}</p>
                {receipt.amount != null && (
                  <p className={`amount mt-1.5 text-4xl font-extrabold tracking-tight ${receipt.direction === "in" ? "text-pos" : "text-ink"}`}>
                    {sign}
                    {formatUSDC(receipt.amount)}
                    <span className="ml-1.5 align-middle text-sm font-semibold text-ink-mute">USDC</span>
                  </p>
                )}
                {receipt.status && (
                  <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${STATUS_TONE[receipt.status] ?? "bg-surface-2 text-ink-soft border-line"}`}>
                    {STATUS_LABELS[receipt.status] ?? receipt.status}
                  </span>
                )}
              </div>

              <dl className="mt-5 divide-y divide-line border-y border-line">
                <Field label="Type">{receipt.kindLabel}</Field>
                {receipt.direction === "out" && username && receipt.counterparty && <Field label="From">@{username}</Field>}
                {receipt.counterparty && (
                  <Field label={receipt.direction === "in" ? "From" : "To"}>
                    {receipt.kindLabel.startsWith("Goal") ? receipt.counterparty : `@${receipt.counterparty}`}
                  </Field>
                )}
                {receipt.direction === "in" && username && receipt.counterparty && <Field label="To">@{username}</Field>}
                <Field label="Date and time">{formatReceiptDate(receipt.at)}</Field>
                {receipt.note && <Field label="Description">{receipt.note}</Field>}
                {receipt.fee > 0 && <Field label="Fee">{formatUSDC(receipt.fee)}</Field>}
                {receipt.fee > 0 && receipt.amount != null && receipt.direction === "out" && (
                  <Field label="Total">{formatUSDC(receipt.amount + receipt.fee)}</Field>
                )}
                <Field label="Transaction ID" copy={{ value: receipt.id, label: "transaction ID" }}>
                  <span className="font-mono text-xs">{receipt.id}</span>
                </Field>
                {receipt.txHash && (
                  <Field label="Network hash" copy={{ value: receipt.txHash, label: "network hash" }}>
                    <span className="font-mono text-xs">{receipt.txHash}</span>
                  </Field>
                )}
                <Field label="Network">{NETWORK_LABEL}</Field>
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={share}
                  className="inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-full bg-brand px-5 text-sm font-bold text-white transition-[background-color,scale] duration-200 hover:bg-brand-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  {shared === "copied" ? "Copied" : "Share receipt"}
                </button>
                {tx && (
                  <a
                    href={tx}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-line-strong px-5 text-sm font-bold text-ink transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    View on explorer
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
