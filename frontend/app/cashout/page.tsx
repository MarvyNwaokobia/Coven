"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import {
  Button,
  Card,
  Input,
  Select,
  AmountInput,
  Alert,
  Skeleton,
  SectionHeading,
} from "@/components/ui";
import { BanknoteIcon, PlusIcon, CheckCircleIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { approveTransfer } from "@/lib/circle/pay";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC, formatLocal } from "@/lib/format";
import type { BankAccount } from "@/lib/types";

export default function CashoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [balance, setBalance] = useState<string | null>(null);
  const [rate, setRate] = useState(0);
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
  const [savingBank, setSavingBank] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  // Amount already sent to the platform for this cash out. If the payout
  // request fails after the transfer, retrying must not ask them to pay again.
  const [sentAmount, setSentAmount] = useState<number | null>(null);
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
  const available = parseFloat(balance ?? "0");
  const overBalance = balance !== null && amt > available;

  async function addBank() {
    setSavingBank(true);
    setError("");
    try {
      const { account } = await api<{ account: BankAccount }>("/api/banks", {
        json: { ...bankForm, country: "NG", currency: "NGN", isDefault: accounts.length === 0 },
      });
      setAccounts((a) => [account, ...a]);
      setSelected(account.id);
      setAddingBank(false);
      setBankForm({ bankCode: "", accountNumber: "", accountName: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save bank");
    } finally {
      setSavingBank(false);
    }
  }

  async function cashOut() {
    setCashingOut(true);
    setError("");
    try {
      if (sentAmount !== amt) {
        await approveTransfer({ kind: "cashout", amountUsdc: amt });
        setSentAmount(amt);
      }
      await api("/api/cashout/initiate", {
        json: { amountUsdc: amt, bankAccountId: selected },
      });
      router.replace("/history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cash out failed");
      setCashingOut(false);
    }
  }

  return (
    <AppShell title="Cash out to bank" back>
      <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-2 lg:items-start">
        {/* ------------------------------------------------ Amount + quote */}
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3.5 shadow-e1">
            <span className="text-xs font-semibold text-ink-soft">Available balance</span>
            {balance !== null ? (
              <span className="amount text-sm font-bold text-ink">
                {formatUSDC(balance)} USDC
              </span>
            ) : (
              <Skeleton className="h-4 w-24" />
            )}
          </div>

          <AmountInput value={amount} onChange={setAmount} autoFocus />

          {balance !== null && available > 0 && (
            <div className="flex justify-center">
              <button
                onClick={() => setAmount(String(available))}
                className="min-h-9 cursor-pointer rounded-full border border-line bg-surface px-4 text-xs font-bold text-ink-soft transition-colors duration-200 hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Cash out everything ({formatUSDC(available)})
              </button>
            </div>
          )}

          {overBalance && (
            <Alert>
              That's more than your balance. You can cash out up to{" "}
              {formatUSDC(available)}.
            </Alert>
          )}

          {/* The quote, shown before confirming and never after. */}
          {amt > 0 && rate > 0 && !overBalance && (
            <Card className="animate-fade-up space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-mute">
                You receive
              </p>
              <p className="amount text-3xl font-extrabold tracking-tight text-ink">
                {formatLocal(receiveLocal)}
                <span className="ml-1.5 align-middle text-sm font-semibold text-ink-mute">
                  NGN
                </span>
              </p>
              <dl className="space-y-2 border-t border-line pt-3 text-xs">
                {[
                  ["Exchange rate", `1 USDC = ₦${rate.toLocaleString()}`],
                  ["Platform fee (1%)", formatUSDC(fee)],
                  ["Estimated arrival", "1–2 business days"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-ink-soft">{k}</dt>
                    <dd className="font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>

        {/* --------------------------------------------------- Destination */}
        <div className="space-y-4">
          <div>
            <SectionHeading
              title="Destination bank"
              action={
                accounts.length > 0 ? (
                  <button
                    onClick={() => setAddingBank((s) => !s)}
                    className="inline-flex items-center gap-1 rounded text-xs font-bold text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {addingBank ? "Cancel" : <>
                      <PlusIcon className="h-3.5 w-3.5" /> Add
                    </>}
                  </button>
                ) : undefined
              }
            />

            <div className="space-y-2.5">
              {accounts.map((a) => {
                const active = selected === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                    aria-pressed={active}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow] duration-200 ease-out-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                      active
                        ? "border-accent bg-accent-soft shadow-e1"
                        : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        active ? "bg-accent text-white" : "bg-surface-2 text-ink-soft"
                      }`}
                    >
                      <BanknoteIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">
                        {a.bank_name}
                      </span>
                      <span className="tnum block truncate text-xs text-ink-soft">
                        ···· {a.account_last4} · {a.account_name}
                      </span>
                    </span>
                    {active && <CheckCircleIcon className="h-5 w-5 shrink-0 text-accent" />}
                  </button>
                );
              })}
            </div>
          </div>

          {addingBank && (
            <Card className="animate-fade-up space-y-3.5">
              <p className="text-sm font-bold text-ink">Add a bank account</p>
              <Select
                label="Bank"
                value={bankForm.bankCode}
                onChange={(e) => setBankForm((f) => ({ ...f, bankCode: e.target.value }))}
              >
                <option value="">Select bank</option>
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Account number"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0123456789"
                value={bankForm.accountNumber}
                onChange={(e) =>
                  setBankForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") }))
                }
              />
              <Input
                label="Account name"
                placeholder="As it appears on your bank statement"
                value={bankForm.accountName}
                onChange={(e) => setBankForm((f) => ({ ...f, accountName: e.target.value }))}
              />
              <Button
                fullWidth
                onClick={addBank}
                loading={savingBank}
                disabled={
                  !bankForm.bankCode || !bankForm.accountNumber || !bankForm.accountName
                }
              >
                Save bank account
              </Button>
            </Card>
          )}

          {error && <Alert>{error}</Alert>}

          <Button
            fullWidth
            size="lg"
            onClick={cashOut}
            loading={cashingOut}
            disabled={!amt || !selected || overBalance}
          >
            {amt && rate && !overBalance
              ? `Cash out ${formatLocal(receiveLocal)}`
              : "Cash out"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
