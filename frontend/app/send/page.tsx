"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import UserSearch from "@/components/UserSearch";
import PaymentSuccess from "@/components/PaymentSuccess";
import { Button, Input, Card, Avatar } from "@/components/ui";
import { api } from "@/lib/api-client";
import { approveTransfer } from "@/lib/circle/pay";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC } from "@/lib/format";

function SendFlow() {
  const router = useRouter();
  const params = useSearchParams();
  useAuth();

  // QR scans land here pre-filled: /send?to=alice&amount=20&note=jollof
  const [recipient, setRecipient] = useState<string | null>(params.get("to"));
  const [amount, setAmount] = useState(params.get("amount") ?? "");
  const [note, setNote] = useState(params.get("note") ?? "");
  const [step, setStep] = useState<"who" | "amount" | "confirm">(
    params.get("to") ? "amount" : "who"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const amt = parseFloat(amount) || 0;

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await approveTransfer({ kind: "send", toUsername: recipient!, amountUsdc: amt });
      await api("/api/payments/send", {
        json: { toUsername: recipient, amountUsdc: amt, note },
      });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  if (success && recipient) {
    return (
      <PaymentSuccess
        username={recipient}
        amount={amt}
        onDone={() => router.replace("/home")}
      />
    );
  }

  return (
    <AppShell title={recipient ? `Send to @${recipient}` : "Send"} back>
      {step === "who" && (
        <UserSearch
          onSelect={(u) => {
            setRecipient(u.username);
            setStep("amount");
          }}
        />
      )}

      {step === "amount" && recipient && (
        <div className="space-y-5">
          <div className="text-center py-6">
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="text-center text-4xl amount border-none bg-transparent focus:border-none"
              autoFocus
            />
            <p className="text-text-2 text-sm mt-1">USDC</p>
          </div>

          <div className="flex gap-2 justify-center">
            {[5, 10, 20, 50].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="rounded-full bg-surface-2 border border-border px-4 py-1.5 text-sm hover:border-primary transition-colors"
              >
                ${v}
              </button>
            ))}
          </div>

          <Input
            placeholder="Note (optional) — for coffee"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
          />

          <Button className="w-full" disabled={!amt} onClick={() => setStep("confirm")}>
            Continue
          </Button>
        </div>
      )}

      {step === "confirm" && recipient && (
        <div className="space-y-5">
          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar username={recipient} />
              <div>
                <p className="font-semibold">@{recipient}</p>
                <p className="text-xs text-text-2">PayCircle balance → Arc</p>
              </div>
            </div>
            <div className="border-t border-border pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-text-2">Amount</span>
                <span className="amount">{formatUSDC(amt)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">Fee</span>
                <span className="amount text-success">$0.00 (P2P on Arc)</span>
              </div>
              {note && (
                <div className="flex justify-between">
                  <span className="text-text-2">Note</span>
                  <span>“{note}”</span>
                </div>
              )}
            </div>
          </Card>

          <p className="text-center text-xs text-text-2">Settles on Arc in &lt;500ms ⚡</p>

          <Button className="w-full" onClick={confirm} disabled={busy}>
            {busy ? "Waiting for PIN approval…" : `Confirm & Send ${formatUSDC(amt)}`}
          </Button>
          {error && <p className="text-danger text-sm text-center">{error}</p>}
        </div>
      )}
    </AppShell>
  );
}

export default function SendPage() {
  return (
    <Suspense>
      <SendFlow />
    </Suspense>
  );
}
