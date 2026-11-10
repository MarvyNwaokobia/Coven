"use client";

import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui";
import { usePush } from "@/lib/usePush";
import InstallBanner from "@/components/InstallBanner";

const NOTES: Record<string, string> = {
  unsupported: "This browser doesn't support push notifications.",
  "ios-install": "On iPhone, add Coven to your Home Screen first (Share, then Add to Home Screen), then open it from there to turn notifications on.",
  blocked: "Notifications are blocked for Coven. Allow them in your browser or system settings, then come back.",
};

/** Push notification opt-in for this device. */
export default function NotificationSettingsPage() {
  const { state, busy, error, enable, disable } = usePush();
  const on = state === "on";
  const actionable = state === "on" || state === "off";

  return (
    <AppShell title="Notifications" subtitle="Alerts on this device" back>
      <div className="mx-auto max-w-xl space-y-4">
        <InstallBanner
          dismissible={false}
          message={
            state === "ios-install"
              ? "On iPhone, payment alerts only work once Coven is installed. Install it, then come back and turn alerts on."
              : "Install Coven for the most reliable payment alerts, and to open it like an app."
          }
        />
        <Card className="flex items-center justify-between gap-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">Push notifications</p>
            <p className="mt-0.5 text-xs text-ink-soft">
              Get alerted when you&apos;re paid, someone requests money, a split is created, a goal withdrawal needs your approval, or a cash out finishes.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Push notifications"
            disabled={!actionable || busy}
            onClick={on ? disable : enable}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
              on ? "bg-accent" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left] duration-200 ${
                on ? "left-[1.375rem]" : "left-0.5"
              }`}
            />
          </button>
        </Card>
        {NOTES[state] && <p className="px-1 text-xs leading-relaxed text-ink-soft">{NOTES[state]}</p>}
        {error && <p className="px-1 text-xs font-semibold text-neg">{error}</p>}
      </div>
    </AppShell>
  );
}
