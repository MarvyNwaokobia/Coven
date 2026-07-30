"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import UserSearch from "@/components/UserSearch";
import { Button, Input, Card, Avatar } from "@/components/ui";
import { MailIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC } from "@/lib/format";

export default function RequestPage() {
  const router = useRouter();
  useAuth();
  const [payer, setPayer] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const amt = parseFloat(amount) || 0;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api("/api/payments/request", {
        json: { toUsername: payer, amountUsdc: amt, note },
      });
      setSent(true);
      setTimeout(() => router.replace("/home"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AppShell title="Request" back>
        <Card className="text-center py-10 space-y-2">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
            <MailIcon className="w-6 h-6" />
          </div>
          <p className="font-bold text-slate-900 text-lg">Request sent to @{payer}</p>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">
            They'll get a notification and can pay in one tap.
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Request Payment" back>
      {!payer ? (
        <UserSearch onSelect={(u) => setPayer(u.username)} placeholder="Who owes you?" />
      ) : (
        <div className="space-y-5">
          <Card className="flex items-center gap-3">
            <Avatar username={payer} />
            <p className="font-bold text-slate-900">@{payer}</p>
            <button
              className="ml-auto text-xs font-semibold text-slate-500 hover:text-slate-900"
              onClick={() => setPayer(null)}
            >
              Change
            </button>
          </Card>

          <div className="text-center py-6 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="text-center text-4xl amount border-none bg-transparent focus:ring-0 font-extrabold text-slate-900"
              autoFocus
            />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">USDC</p>
          </div>

          <Input
            placeholder="What's it for? — dinner last night"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
          />

          <Button className="w-full" onClick={submit} disabled={busy || !amt}>
            {busy ? "Sending…" : `Request ${formatUSDC(amt)}`}
          </Button>
          {error && <p className="text-red-600 text-sm font-medium text-center">{error}</p>}
        </div>
      )}
    </AppShell>
  );
}
