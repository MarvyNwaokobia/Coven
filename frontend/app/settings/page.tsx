"use client";

import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import WalletSetup from "@/components/WalletSetup";
import {
  Avatar,
  Button,
  Card,
  Input,
  Select,
  Spinner,
  Skeleton,
  Alert,
  SectionHeading,
} from "@/components/ui";
import {
  LockIcon,
  CreditCardIcon,
  CheckCircleIcon,
  CopyIcon,
  CameraIcon,
  BanknoteIcon,
  PlusIcon,
  LogoutIcon,
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
    setTimeout(() => setCopied(false), 1800);
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
    <AppShell title="Settings" subtitle="Your handle, wallet and payouts">
      <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-2 lg:items-start">
        {/* ------------------------------------------------------- Profile */}
        <div className="space-y-5">
          <Card className="flex items-center gap-4 py-5">
            <div className="relative">
              <Avatar username={user?.username ?? "?"} avatarUrl={user?.avatar_url} size={64} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                aria-label="Change profile picture"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-brand text-white ring-4 ring-surface transition-[background-color,translate,scale] duration-200 ease-out-soft hover:bg-brand-hover active:scale-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {avatarBusy ? <Spinner /> : <CameraIcon className="h-4 w-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-extrabold tracking-tight text-ink">
                @{user?.username ?? "…"}
              </p>
              <p className="text-xs font-semibold text-ink-mute">
                {user?.display_name || "Your Coven handle"}
              </p>
            </div>
          </Card>

          {avatarError && <Alert>{avatarError}</Alert>}

          {/* Wallet */}
          <Card className="space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <LockIcon className="h-4 w-4" />
                </span>
                <span className="text-sm font-bold text-ink">Arc wallet PIN</span>
              </div>

              {wallet === undefined ? (
                <Skeleton className="h-6 w-16 rounded-full" />
              ) : wallet ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-pos-line bg-pos-soft px-2.5 py-1 text-[0.6875rem] font-bold text-pos">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Active
                </span>
              ) : (
                <Button size="sm" onClick={() => setShowSetup(true)}>
                  Set PIN
                </Button>
              )}
            </div>

            {wallet && (
              <div className="flex items-center gap-2 border-t border-line pt-3">
                <p className="amount min-w-0 flex-1 break-all text-xs text-ink-soft">{wallet}</p>
                <button
                  onClick={copyAddress}
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-ink-soft transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {copied ? (
                    <CheckCircleIcon className="h-3.5 w-3.5 text-pos" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
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

          {/* Network */}
          <Card className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-soft">
              <CreditCardIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Network</p>
              <p className="text-xs text-ink-mute">
                Arc Testnet · sub-500ms settlement · zero gas on P2P
              </p>
            </div>
          </Card>
        </div>

        {/* --------------------------------------------------------- Banks */}
        <div className="space-y-5">
          <Card className="space-y-3.5">
            <SectionHeading
              title="Bank accounts"
              count={accounts.length}
              action={
                <button
                  onClick={() => setAddingBank((s) => !s)}
                  className="inline-flex items-center gap-1 rounded text-xs font-bold text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {addingBank ? (
                    "Cancel"
                  ) : (
                    <>
                      <PlusIcon className="h-3.5 w-3.5" /> Add
                    </>
                  )}
                </button>
              }
            />

            {accounts.length === 0 && !addingBank && (
              <p className="text-xs leading-relaxed text-ink-soft">
                None saved yet. Add one so you can cash out USDC straight to
                your bank.
              </p>
            )}

            {accounts.length > 0 && (
              <ul className="divide-y divide-line">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-soft">
                      <BanknoteIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{a.bank_name}</p>
                      <p className="tnum truncate text-xs text-ink-mute">
                        ···· {a.account_last4} · {a.account_name}
                      </p>
                    </div>
                    {a.is_default && (
                      <span className="shrink-0 rounded-full border border-accent-line bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-bold text-accent">
                        Default
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {addingBank && (
              <div className="animate-fade-up space-y-3.5 border-t border-line pt-3.5">
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
                {bankError && <Alert>{bankError}</Alert>}
                <Button
                  fullWidth
                  onClick={addBank}
                  loading={bankBusy}
                  disabled={
                    !bankForm.bankCode || !bankForm.accountNumber || !bankForm.accountName
                  }
                >
                  Save bank account
                </Button>
              </div>
            )}
          </Card>

          {/* Sign out sits apart from everything else, on purpose. */}
          <div className="border-t border-line pt-5">
            <Button
              variant="danger"
              fullWidth
              icon={<LogoutIcon className="h-4 w-4" />}
              onClick={signOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
