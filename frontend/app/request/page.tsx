"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import UserSearch from "@/components/UserSearch";
import { Button, Input, Card, Avatar, AmountInput, Alert } from "@/components/ui";
import { MailIcon, RequestIcon } from "@/components/Icons";
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
      setTimeout(() => router.replace("/home"), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AppShell title="Request sent" back>
        <div className="mx-auto max-w-lg">
          <Card className="animate-scale-in space-y-3 px-6 py-12 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
              <MailIcon className="h-6 w-6" />
            </span>
            <p className="text-lg font-bold text-ink">
              Request sent to @{payer}
            </p>
            <p className="mx-auto max-w-xs text-sm leading-relaxed text-ink-soft">
              They'll get a notification and can settle it in one tap. You'll see
              it land in your activity.
            </p>
            <p className="amount pt-2 text-2xl font-extrabold text-ink">{formatUSDC(amt)}</p>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Request payment" back>
      <div className="mx-auto max-w-lg">
        {!payer ? (
          <UserSearch
            label="Who owes you?"
            placeholder="Search @username or phone"
            onSelect={(u) => setPayer(u.username)}
          />
        ) : (
          <div className="space-y-4">
            <Card className="flex items-center gap-3 py-3">
              <Avatar username={payer} />
              <p className="min-w-0 flex-1 truncate font-bold text-ink">@{payer}</p>
              <Button variant="ghost" size="sm" onClick={() => setPayer(null)}>
                Change
              </Button>
            </Card>

            <AmountInput value={amount} onChange={setAmount} autoFocus />

            <Input
              label="What's it for?"
              placeholder="Dinner last night"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={100}
              hint="Helps them recognise the request."
            />

            {error && <Alert>{error}</Alert>}

            <Button
              fullWidth
              size="lg"
              icon={<RequestIcon className="h-4 w-4" />}
              onClick={submit}
              loading={busy}
              disabled={!amt}
            >
              {busy ? "Sending…" : `Request ${formatUSDC(amt)}`}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
