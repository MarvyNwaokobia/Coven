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
    <AppShell title={recipient ? `Send to @${recipient}` : "Send Money"} back>
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

          <div className="flex gap-2 justify-center">
            {[5, 10, 20, 50].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="rounded-full bg-slate-100 border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-[#0a192f] hover:text-white hover:border-[#0a192f] transition-all"
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
          <Card className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar username={recipient} />
              <div>
                <p className="font-bold text-slate-900">@{recipient}</p>
                <p className="text-xs font-medium text-slate-500">PayCircle Balance → Arc</p>
              </div>
            </div>
            <div className="border-t border-slate-200/80 pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Amount</span>
                <span className="amount font-bold text-slate-900">{formatUSDC(amt)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Network Fee</span>
                <span className="amount text-emerald-600 font-semibold">$0.00 (P2P on Arc)</span>
              </div>
              {note && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Note</span>
                  <span className="text-slate-900 font-medium">“{note}”</span>
                </div>
              )}
            </div>
          </Card>

          <p className="text-center text-xs font-semibold text-slate-400">Settles on Arc in &lt;500ms</p>

          <Button className="w-full" onClick={confirm} disabled={busy}>
            {busy ? "Waiting for PIN approval…" : `Confirm & Send ${formatUSDC(amt)}`}
          </Button>
          {error && <p className="text-red-600 text-sm font-medium text-center">{error}</p>}
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
