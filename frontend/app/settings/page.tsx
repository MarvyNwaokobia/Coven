"use client";

import Link from "next/link";
import AppShell from "@/components/AppShell";
import { SettingsGroup, SettingsRow } from "@/components/SettingsList";
import { Avatar, Card } from "@/components/ui";
import {
  BanknoteIcon,
  ChevronRightIcon,
  CreditCardIcon,
  GlobeIcon,
  LockIcon,
  LogoutIcon,
  NotificationBellIcon,
  ShieldIcon,
  UserGroupIcon,
} from "@/components/Icons";
import { useAuth } from "@/lib/useAuth";
import { NETWORK, NETWORK_LABEL } from "@/lib/network";

/** The Settings home: a short list of sections, each opening its own page. */
export default function SettingsPage() {
  const { user, signOut } = useAuth();

  return (
    <AppShell title="Settings" subtitle="Your handle, wallet and payouts">
      <div className="mx-auto max-w-xl space-y-6">
        <Link href="/settings/profile" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Card interactive className="flex items-center gap-4 py-4">
            <Avatar username={user?.username ?? "?"} avatarUrl={user?.avatar_url} size={56} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold tracking-tight text-ink">@{user?.username ?? "…"}</p>
              <p className="truncate text-xs font-semibold text-ink-mute">{user?.display_name || "View and edit your profile"}</p>
            </div>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-mute" />
          </Card>
        </Link>

        <SettingsGroup title="Account">
          <SettingsRow href="/settings/wallet" icon={<LockIcon className="h-4 w-4" />} label="Wallet and PIN" hint="Your address, change or reset your PIN" />
          <SettingsRow href="/settings/invite" icon={<UserGroupIcon className="h-4 w-4" />} label="Invite friends" hint="Share your link so friends can pay you" />
        </SettingsGroup>

        <SettingsGroup title="Money">
          <SettingsRow href="/settings/cashout" icon={<BanknoteIcon className="h-4 w-4" />} label="Cash out" hint="Bank accounts for payouts" />
        </SettingsGroup>

        <SettingsGroup title="App">
          <SettingsRow href="/settings/notifications" icon={<NotificationBellIcon className="h-4 w-4" />} label="Notifications" hint="Get alerts on this device" />
          <SettingsRow
            href="/settings/network"
            icon={<GlobeIcon className="h-4 w-4" />}
            label={NETWORK === "testnet" ? "Testnet and free USDC" : "Network"}
            hint={NETWORK === "testnet" ? `${NETWORK_LABEL} · get free test USDC from Circle` : NETWORK_LABEL}
          />
        </SettingsGroup>

        <SettingsGroup title="Support and legal">
          <SettingsRow href="/settings/help" icon={<CreditCardIcon className="h-4 w-4" />} label="Help and bug reports" hint="Contact us, copy debug info" />
          <SettingsRow href="/terms" icon={<ShieldIcon className="h-4 w-4" />} label="Terms and privacy" hint="How Coven works and what we keep" />
        </SettingsGroup>

        <SettingsGroup title="Session" tone="danger">
          <SettingsRow tone="danger" icon={<LogoutIcon className="h-4 w-4" />} label="Sign out" hint="You can sign back in with Google" onClick={signOut} />
        </SettingsGroup>
      </div>
    </AppShell>
  );
}
