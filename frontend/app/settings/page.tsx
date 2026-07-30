"use client";

import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import WalletSetup from "@/components/WalletSetup";
import { Avatar, Button, Card, Input, Spinner } from "@/components/ui";
import {
  LockIcon,
  CreditCardIcon,
  CheckCircleIcon,
  CopyIcon,
  CameraIcon,
  BanknoteIcon,
} from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import type { BankAccount } from "@/lib/types";

export default function SettingsPage() {
  const { user, setUser, signOut } = useAuth();
  const [wallet, setWallet] = useState<string | null | undefined>(undefined);
  const [showSetup, setShowSetup] = useState(false);
  const [copied, setCopied] = useState(false);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [addingBank, setAddingBank] = useState(false);
  const [bankForm, setBankForm] = useState({ bankCode: "", accountNumber: "", accountName: "" });
  const [bankBusy, setBankBusy] = useState(false);
  const [bankError, setBankError] = useState("");

  useEffect(() => {
    if (!user) return;
    api<{ walletAddress: string | null }>("/api/circle/status")
      .then(({ walletAddress }) => setWallet(walletAddress))
      .catch(() => setWallet(null));
    api<{ accounts: BankAccount[]; banks: { code: string; name: string }[] }>("/api/banks")
      .then(({ accounts, banks }) => {
        setAccounts(accounts);
        setBanks(banks);
      })
      .catch(() => {});
  }, [user]);

  async function copyAddress() {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { avatarUrl } = await api<{ avatarUrl: string }>("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      setUser((u) => (u ? { ...u, avatar_url: avatarUrl } : u));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function addBank() {
    setBankBusy(true);
    setBankError("");
    try {
      const { account } = await api<{ account: BankAccount }>("/api/banks", {
        json: { ...bankForm, country: "NG", currency: "NGN", isDefault: accounts.length === 0 },
      });
      setAccounts((a) => [account, ...a]);
      setAddingBank(false);
      setBankForm({ bankCode: "", accountNumber: "", accountName: "" });
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Could not save bank");
    } finally {
      setBankBusy(false);
    }
  }

  return (
    <AppShell title="Settings">
      <div className="space-y-5">
        <Card className="flex items-center gap-4 py-5">
          <div className="relative">
            <Avatar username={user?.username ?? "?"} avatarUrl={user?.avatar_url} size={56} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center border-2 border-white"
              aria-label="Change profile picture"
            >
              {avatarBusy ? <Spinner className="w-3 h-3" /> : <CameraIcon className="w-3.5 h-3.5" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p className="font-extrabold text-slate-900 text-lg">@{user?.username}</p>
            <p className="text-xs font-semibold text-slate-500">PayCircle Handle</p>
          </div>
        </Card>
        {avatarError && <p className="text-red-600 text-xs font-medium">{avatarError}</p>}

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <LockIcon className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900 text-sm">Arc Wallet PIN</span>
            </div>
            {wallet === undefined ? (
              <Spinner />
            ) : wallet ? (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircleIcon className="w-3.5 h-3.5" /> Active
              </span>
            ) : (
              <Button className="px-3 py-1 text-xs" onClick={() => setShowSetup(true)}>
                Set PIN
              </Button>
            )}
          </div>
          {wallet && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <p className="amount text-xs text-slate-500 font-mono break-all flex-1">{wallet}</p>
              <button
                onClick={copyAddress}
                className="shrink-0 flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <CopyIcon className="w-3.5 h-3.5" />
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
        </Card>

        {showSetup && (
          <WalletSetup
            onComplete={(addr) => {
              setWallet(addr);
              setShowSetup(false);
            }}
          />
        )}

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <BanknoteIcon className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900 text-sm">Bank Accounts</span>
            </div>
            <button
              onClick={() => setAddingBank((s) => !s)}
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              {addingBank ? "Cancel" : "+ Add"}
            </button>
          </div>

          {accounts.length === 0 && !addingBank && (
            <p className="text-xs text-slate-500">
              None saved yet — add one to cash out to your bank.
            </p>
          )}
          {accounts.map((a) => (
            <div key={a.id} className="flex justify-between text-sm pt-1 border-t border-slate-100">
              <div>
                <p className="font-semibold text-slate-800">{a.bank_name}</p>
                <p className="text-xs text-slate-500">**** {a.account_last4} · {a.account_name}</p>
              </div>
              {a.is_default && (
                <span className="text-xs font-bold text-blue-600 self-center">Default</span>
              )}
            </div>
          ))}

          {addingBank && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
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
                  bankBusy || !bankForm.bankCode || !bankForm.accountNumber || !bankForm.accountName
                }
              >
                {bankBusy ? "Saving…" : "Save bank account"}
              </Button>
              {bankError && <p className="text-red-600 text-xs font-medium">{bankError}</p>}
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <CreditCardIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Network</p>
              <p className="text-xs text-slate-500 font-medium">Arc Testnet (Fast, sub-500ms, zero-gas)</p>
            </div>
          </div>
        </Card>

        <Button variant="danger" className="w-full" onClick={signOut}>
          Sign Out
        </Button>
      </div>
    </AppShell>
  );
}
