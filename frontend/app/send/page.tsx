"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import UserSearch from "@/components/UserSearch";
import PaymentSuccess from "@/components/PaymentSuccess";
import Stepper from "@/components/Stepper";
import { Button, Input, Card, Avatar, AmountInput, Alert } from "@/components/ui";
import { BoltIcon, SendIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { approveTransfer } from "@/lib/circle/pay";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC } from "@/lib/format";

const STEPS = ["Recipient", "Amount", "Confirm"];
const PRESETS = [5, 10, 20, 50];

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
  const stepIndex = { who: 0, amount: 1, confirm: 2 }[step];

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
    <AppShell title={recipient ? `Send to @${recipient}` : "Send money"} back>
      <div className="mx-auto max-w-lg">
        <Stepper steps={STEPS} current={stepIndex} />

        {step === "who" && (
          <div className="mt-6">
            <UserSearch
              onSelect={(u) => {
                setRecipient(u.username);
                setStep("amount");
              }}
            />
          </div>
        )}

        {step === "amount" && recipient && (
          <div className="mt-6 space-y-4">
            <Card className="flex items-center gap-3 py-3">
              <Avatar username={recipient} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">@{recipient}</p>
                <p className="text-xs text-ink-mute">Receives instantly on Arc</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRecipient(null);
                  setStep("who");
                }}
              >
                Change
              </Button>
            </Card>

            <AmountInput value={amount} onChange={setAmount} autoFocus />

            <div className="flex flex-wrap justify-center gap-2">
              {PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className={`amount min-h-9 cursor-pointer rounded-full border px-4 text-sm font-bold transition-[background-color,border-color,color,translate,scale] duration-200 ease-out-soft active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                    amount === String(v)
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink"
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>

            <Input
              label="Note (optional)"
              placeholder="What's it for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={100}
              hint={`${note.length}/100`}
            />

            <Button fullWidth size="lg" disabled={!amt} onClick={() => setStep("confirm")}>
              Continue
            </Button>
          </div>
        )}

        {step === "confirm" && recipient && (
          <div className="animate-fade-up mt-6 space-y-4">
            <Card className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <Avatar username={recipient} size={48} />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-ink">@{recipient}</p>
                  <p className="text-xs text-ink-mute">Coven balance → Arc</p>
                </div>
              </div>

              <dl className="space-y-2.5 border-t border-line pt-4 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">Amount</dt>
                  <dd className="amount text-lg font-extrabold text-ink">
                    {formatUSDC(amt)} <span className="text-xs text-ink-mute">USDC</span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">Network fee</dt>
                  <dd className="amount font-semibold text-pos">$0.00</dd>
                </div>
                {note && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="shrink-0 text-ink-soft">Note</dt>
                    <dd className="truncate text-right font-medium text-ink">“{note}”</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2.5">
                  <dt className="font-bold text-ink">They receive</dt>
                  <dd className="amount text-lg font-extrabold text-ink">{formatUSDC(amt)}</dd>
                </div>
              </dl>
            </Card>

            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-mute">
              <BoltIcon className="h-3.5 w-3.5" />
              Settles on Arc in under 500ms
            </p>

            {error && <Alert>{error}</Alert>}

            <div className="flex gap-2.5">
              <Button
                variant="secondary"
                size="lg"
                disabled={busy}
                onClick={() => setStep("amount")}
              >
                Back
              </Button>
              <Button
                fullWidth
                size="lg"
                icon={<SendIcon className="h-4 w-4" />}
                loading={busy}
                onClick={confirm}
              >
                {busy ? "Waiting for PIN…" : `Send ${formatUSDC(amt)}`}
              </Button>
            </div>
          </div>
        )}
      </div>
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
