"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Button, Card, Input, Spinner } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC, formatLocal } from "@/lib/format";
import type { BankAccount } from "@/lib/types";

export default function CashoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [balance, setBalance] = useState<string>("0");
  const [rate, setRate] = useState<number>(0);
  const [amount, setAmount] = useState("");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [addingBank, setAddingBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankCode: "",
    accountNumber: "",
    accountName: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      api<{ usdc: string; rate: number }>("/api/balance"),
      api<{ accounts: BankAccount[]; banks: { code: string; name: string }[] }>("/api/banks"),
    ]).then(([b, a]) => {
      if (b.status === "fulfilled") {
        setBalance(b.value.usdc);
        setRate(b.value.rate);
      }
      if (a.status === "fulfilled") {
        setAccounts(a.value.accounts);
        setBanks(a.value.banks);
        const def = a.value.accounts.find((x) => x.is_default) ?? a.value.accounts[0];
        if (def) setSelected(def.id);
        else setAddingBank(true);
      }
    });
  }, [user]);

  const amt = parseFloat(amount) || 0;
  const fee = amt * 0.01;
  const receiveLocal = (amt - fee) * rate;

  async function addBank() {
    setBusy(true);
    setError("");
    try {
      const { account } = await api<{ account: BankAccount }>("/api/banks", {
        json: { ...bankForm, country: "NG", currency: "NGN", isDefault: accounts.length === 0 },
      });
      setAccounts((a) => [account, ...a]);
      setSelected(account.id);
      setAddingBank(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save bank");
    } finally {
      setBusy(false);
    }
  }

  async function cashOut() {
    setBusy(true);
    setError("");
    try {
      await api("/api/cashout/initiate", {
        json: { amountUsdc: amt, bankAccountId: selected },
      });
      router.replace("/history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cash out failed");
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <AppShell title="Cash Out" back>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Cash Out" back>
      <div className="space-y-5">
        <p className="text-sm text-text-2">
          Available: <span className="amount text-text">{formatUSDC(balance)} USDC</span>
        </p>

        <Card className="space-y-3">
          <Input
            inputMode="decimal"
            placeholder="Amount in USDC"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            autoFocus
          />
          {amt > 0 && rate > 0 && (
            <div className="text-sm space-y-1">
              <p className="text-lg font-bold amount">
                ≈ {formatLocal(receiveLocal)} <span className="text-sm font-medium">NGN</span>
              </p>
              <p className="text-text-2">Rate: 1 USDC = ₦{rate.toLocaleString()}</p>
              <p className="text-text-2">Fee: {formatUSDC(fee)} (1%)</p>
              <p className="text-text-2">Arrival: 1–2 business days</p>
            </div>
          )}
        </Card>

        <div className="space-y-2">
          <p className="font-semibold text-sm">Send to</p>
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a.id)}
              className={`w-full text-left rounded-card border p-3.5 transition-colors ${
                selected === a.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface"
              }`}
            >
              <p className="font-medium text-sm">
                {a.bank_name} — **** {a.account_last4}
              </p>
              <p className="text-xs text-text-2">{a.account_name}</p>
            </button>
          ))}
          <button
            onClick={() => setAddingBank((s) => !s)}
            className="text-sm text-accent font-medium"
          >
            {addingBank ? "Cancel" : "+ Add new bank account"}
          </button>
        </div>

        {addingBank && (
          <Card className="space-y-3">
            <select
              className="w-full rounded-card bg-surface-2 border border-border px-4 py-3 text-text"
              value={bankForm.bankCode}
              onChange={(e) => setBankForm((f) => ({ ...f, bankCode: e.target.value }))}
            >
              <option value="">Select bank</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
            <Input
              inputMode="numeric"
              placeholder="Account number"
              value={bankForm.accountNumber}
              onChange={(e) =>
                setBankForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") }))
              }
            />
            <Input
              placeholder="Account name"
              value={bankForm.accountName}
              onChange={(e) => setBankForm((f) => ({ ...f, accountName: e.target.value }))}
            />
            <Button
              className="w-full"
              onClick={addBank}
              disabled={
                busy || !bankForm.bankCode || !bankForm.accountNumber || !bankForm.accountName
              }
            >
              {busy ? "Saving…" : "Save bank account"}
            </Button>
          </Card>
        )}

        <Button
          className="w-full"
          onClick={cashOut}
          disabled={busy || !amt || !selected || amt > parseFloat(balance)}
        >
          {busy
            ? "Processing…"
            : amt && rate
              ? `Cash Out ${formatLocal(receiveLocal)}`
              : "Cash Out"}
        </Button>
        {error && <p className="text-danger text-sm text-center">{error}</p>}
      </div>
    </AppShell>
  );
}
