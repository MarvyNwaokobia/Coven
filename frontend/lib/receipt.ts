import { STATEMENT_KINDS, type StatementRow } from "@/lib/statement-types";

/** Everything the transaction details screen shows. Built from a statement row or, failing that, an activity item. */
export interface Receipt {
  /** Coven's own reference for the transaction. */
  id: string;
  at: string;
  /** e.g. "To @ada", "From @bola", "Cash out to bank". */
  title: string;
  /** Short type, e.g. "Sent", "Received". */
  kindLabel: string;
  direction: "in" | "out" | "neutral";
  amount: number | null;
  fee: number;
  /** @username (or the goal) on the other side, without the "@". */
  counterparty: string | null;
  note: string | null;
  /** On-chain transaction hash, when there is one. */
  txHash: string | null;
  /** completed | pending | processing | failed, or null when the item has no status of its own. */
  status: string | null;
}

export function statementTitle(r: Pick<StatementRow, "kind" | "counterparty">): string {
  const who = r.counterparty ? `@${r.counterparty}` : "";
  switch (r.kind) {
    case "sent": return who ? `To ${who}` : "Sent";
    case "received": return who ? `From ${who}` : "Received";
    case "deposit": return "Deposit from outside Coven";
    case "circle_send": return who ? `Circle payment to ${who}` : "Circle payment";
    case "split_pay": return who ? `Split share to ${who}` : "Split share";
    case "goal_contribution": return r.counterparty ? `Goal: ${r.counterparty}` : "Goal contribution";
    case "goal_payout": return "Goal payout";
    case "cash_out": return "Cash out to bank";
  }
}

export function receiptFromStatement(r: StatementRow): Receipt {
  return {
    id: r.id,
    at: r.at,
    title: statementTitle(r),
    kindLabel: STATEMENT_KINDS[r.kind].label,
    direction: r.direction,
    amount: r.amount,
    fee: r.fee,
    counterparty: r.counterparty,
    note: r.note,
    txHash: r.txHash,
    status: r.status,
  };
}

export const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  pending: "Pending",
  processing: "Processing",
  failed: "Failed",
};

export function formatReceiptDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Plain-text receipt for sharing or pasting into a chat. */
export function receiptText(r: Receipt, opts: { username?: string; network: string; money: (n: number) => string }): string {
  const lines = ["Coven receipt", ""];
  if (r.amount != null) {
    lines.push(`Amount: ${r.direction === "in" ? "+" : r.direction === "out" ? "−" : ""}${opts.money(r.amount)} USDC`);
  }
  lines.push(r.title);
  if (opts.username && r.direction === "out" && r.counterparty) lines.push(`From: @${opts.username}`);
  if (opts.username && r.direction === "in" && r.counterparty) lines.push(`To: @${opts.username}`);
  if (r.status) lines.push(`Status: ${STATUS_LABELS[r.status] ?? r.status}`);
  lines.push(`Date: ${formatReceiptDate(r.at)}`);
  if (r.note) lines.push(`Description: ${r.note}`);
  if (r.fee > 0) lines.push(`Fee: ${opts.money(r.fee)}`);
  lines.push(`Transaction ID: ${r.id}`);
  if (r.txHash) lines.push(`Network hash: ${r.txHash}`);
  lines.push(`Network: ${opts.network}`);
  return lines.join("\n");
}
