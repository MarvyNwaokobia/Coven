"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, Avatar, Button, Spinner } from "@/components/ui";
import { useAuth, signOut } from "@/lib/useAuth";
import { api } from "@/lib/api-client";
import type { BankAccount } from "@/lib/types";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    if (!user) return;
    api<{ accounts: BankAccount[] }>("/api/banks")
      .then(({ accounts }) => setAccounts(accounts))
      .catch(() => {});
  }, [user]);

  if (loading || !user) {
    return (
      <AppShell title="Settings">
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings">
      <div className="space-y-5">
        <Card className="flex items-center gap-4">
          <Avatar username={user.username} avatarUrl={user.avatar_url} size={56} />
          <div className="flex-1 min-w-0">
            <p className="font-bold">@{user.username}</p>
            {user.display_name && <p className="text-sm text-text-2">{user.display_name}</p>}
            <p className="text-xs text-text-2 truncate mt-0.5">
              {user.email ?? user.phone}
            </p>
          </div>
        </Card>

        <Card className="space-y-2">
          <p className="font-semibold text-sm">Arc Wallet</p>
          {user.wallet_address ? (
            <p className="amount text-xs text-text-2 break-all">{user.wallet_address}</p>
          ) : (
            <p className="text-xs text-warning">
              Wallet not provisioned yet — it will be retried automatically.
            </p>
          )}
        </Card>

        <Card className="space-y-3">
          <p className="font-semibold text-sm">Bank accounts</p>
          {accounts.length === 0 ? (
            <p className="text-xs text-text-2">
              None saved. Add one in the Cash Out flow.
            </p>
          ) : (
            accounts.map((a) => (
              <div key={a.id} className="flex justify-between text-sm">
                <span>
                  {a.bank_name} — **** {a.account_last4}
                </span>
                {a.is_default && <span className="text-xs text-accent">default</span>}
              </div>
            ))
          )}
        </Card>

        <Button variant="danger" className="w-full" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </AppShell>
  );
}
