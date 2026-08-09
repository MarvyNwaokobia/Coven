"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Button, Input, Card, Skeleton, Alert, SectionHeading } from "@/components/ui";
import { CopyIcon, CheckCircleIcon, ReceiveIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";

/** Generate a QR to receive: static (any amount) or dynamic (merchant mode). */
export default function ReceivePage() {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  /** `withAmount` distinguishes merchant mode from the open "pay me anything" QR. */
  const generate = useCallback(
    async (withAmount: boolean, nextAmount = amount, nextNote = note) => {
      setBusy(true);
      setError("");
      try {
        const { qr } = await api<{ qr: string }>("/api/qr/generate", {
          json: withAmount
            ? { amount: parseFloat(nextAmount) || undefined, note: nextNote || undefined }
            : {},
        });
        setQr(qr);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate QR code");
      } finally {
        setBusy(false);
      }
    },
    [amount, note]
  );

  useEffect(() => {
    if (user) generate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function copyHandle() {
    if (!user) return;
    await navigator.clipboard.writeText(`@${user.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <AppShell title="Receive USDC" back>
      <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-2 lg:items-start">
        {/* QR */}
        <Card className="flex flex-col items-center px-6 py-8">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="QR code to pay this account"
              width={256}
              height={256}
              className="animate-scale-in h-64 w-64 rounded-xl border border-line bg-white p-2"
            />
          ) : (
            <Skeleton className="h-64 w-64 rounded-xl" />
          )}

          <p className="mt-5 text-xl font-extrabold tracking-tight text-ink">
            @{user?.username ?? "…"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {amount ? `Requesting $${amount} USDC` : "Scan to pay any amount"}
          </p>

          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={copyHandle}
            icon={
              copied ? (
                <CheckCircleIcon className="h-4 w-4 text-pos" />
              ) : (
                <CopyIcon className="h-4 w-4" />
              )
            }
          >
            {copied ? "Copied" : "Copy handle"}
          </Button>
        </Card>

        {/* Merchant mode */}
        <div className="space-y-4">
          <Card className="space-y-4">
            <SectionHeading title="Merchant mode" />
            <p className="-mt-1 text-sm leading-relaxed text-ink-soft">
              Lock the QR to a specific amount so a customer can't underpay.
              Leave it blank for an open code you can reuse.
            </p>

            <Input
              label="Amount"
              inputMode="decimal"
              placeholder="0.00"
              prefix="$"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            />
            <Input
              label="Note"
              placeholder="e.g. jollof rice"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={100}
            />

            {error && <Alert>{error}</Alert>}

            <div className="flex gap-2.5">
              <Button
                fullWidth
                onClick={() => generate(true)}
                loading={busy}
                disabled={!amount}
              >
                Update QR
              </Button>
              <Button
                variant="secondary"
                disabled={busy || (!amount && !note)}
                onClick={() => {
                  setAmount("");
                  setNote("");
                  generate(false, "", "");
                }}
              >
                Reset
              </Button>
            </div>
          </Card>

          <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <ReceiveIcon className="h-4 w-4" />
            </span>
            <p className="text-xs leading-relaxed text-ink-soft">
              Anyone can pay this code from Ethereum, Base, Polygon and more.
              CCTP routes it to your Arc balance automatically. You'll be
              credited once the mint lands.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
