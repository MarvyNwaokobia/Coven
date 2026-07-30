"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Button, Input, Card, Spinner } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";

/** Generate a QR to receive — static (any amount) or dynamic (merchant mode). */
export default function ReceivePage() {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate(withAmount: boolean) {
    setBusy(true);
    try {
      const { qr } = await api<{ qr: string }>("/api/qr/generate", {
        json: withAmount
          ? { amount: parseFloat(amount) || undefined, note: note || undefined }
          : {},
      });
      setQr(qr);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (user) generate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <AppShell title="Receive USDC" back>
      <div className="space-y-5">
        <Card className="flex flex-col items-center py-8">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Payment QR code" className="rounded-2xl w-64 h-64 border border-slate-200 p-2 bg-white shadow-2xs" />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center">
              <Spinner />
            </div>
          )}
          <p className="mt-4 font-bold text-slate-900 text-lg">@{user?.username}</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            {amount ? `Requesting $${amount} USDC` : "Scan to pay any amount"}
          </p>
        </Card>

        <Card className="space-y-3">
          <p className="text-sm font-bold text-slate-900">Merchant mode — set amount</p>
          <Input
            inputMode="decimal"
            placeholder="Amount in USDC"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <Input
            placeholder="Note — e.g. jollof rice"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => generate(true)} disabled={busy}>
              Update QR
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setAmount("");
                setNote("");
                generate(false);
              }}
              disabled={busy}
            >
              Reset
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
