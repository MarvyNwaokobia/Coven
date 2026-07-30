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
    <AppShell title="Cash Out to Bank" back>
      <div className="space-y-5">
        <div className="flex justify-between items-center bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Available Balance</span>
          <span className="amount font-bold text-slate-900 text-sm">{formatUSDC(balance)} USDC</span>
        </div>

        <Card className="space-y-3">
          <Input
            inputMode="decimal"
            placeholder="Amount in USDC"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            autoFocus
          />
          {amt > 0 && rate > 0 && (
            <div className="text-sm space-y-1.5 pt-1 border-t border-slate-100">
              <p className="text-[#0a192f] text-xl font-extrabold amount">
                ≈ {formatLocal(receiveLocal)} <span className="text-sm font-semibold text-slate-500">NGN</span>
              </p>
              <div className="text-xs text-slate-500 space-y-1 font-medium">
                <div className="flex justify-between">
                  <span>Exchange Rate</span>
                  <span className="font-semibold text-slate-700">1 USDC = ₦{rate.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Fee</span>
                  <span className="font-semibold text-slate-700">{formatUSDC(fee)} (1%)</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Arrival</span>
                  <span className="font-semibold text-slate-700">1–2 business days</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-2">
          <p className="font-bold text-slate-900 text-sm">Destination Bank</p>
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a.id)}
              className={`w-full text-left rounded-2xl border p-4 transition-all ${
                selected === a.id
                  ? "border-[#0a192f] bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
              }`}
            >
              <p className="font-bold text-sm">
                {a.bank_name} — **** {a.account_last4}
              </p>
              <p className={`text-xs mt-0.5 ${selected === a.id ? "text-slate-300" : "text-slate-500"}`}>
                {a.account_name}
              </p>
            </button>
          ))}
          <button
            onClick={() => setAddingBank((s) => !s)}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 pt-1"
          >
            {addingBank ? "Cancel" : "+ Add new bank account"}
          </button>
        </div>

        {addingBank && (
          <Card className="space-y-3">
            <select
              className="w-full rounded-2xl bg-white border border-slate-200 px-4 py-3 text-slate-900 font-medium outline-none focus:border-blue-600"
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
        {error && <p className="text-red-600 text-sm font-medium text-center">{error}</p>}
      </div>
    </AppShell>
  );
}
