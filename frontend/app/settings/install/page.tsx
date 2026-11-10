"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui";
import { useInstall, detectPlatform, type InstallPlatform } from "@/lib/useInstall";

const STEPS: Record<InstallPlatform, { name: string; steps: string[] }> = {
  ios: {
    name: "iPhone and iPad (Safari)",
    steps: ["Tap the Share button at the bottom of Safari.", "Scroll down and tap Add to Home Screen.", "Tap Add, then open Coven from your Home Screen."],
  },
  android: {
    name: "Android (Chrome)",
    steps: ["Tap the menu (three dots) at the top right.", "Tap Install app, or Add to Home screen.", "Confirm, then open Coven from your home screen."],
  },
  "safari-mac": {
    name: "Mac (Safari)",
    steps: ["In the menu bar choose File, then Add to Dock.", "Or click the Share button in the toolbar and choose Add to Dock.", "Open Coven from your Dock."],
  },
  chromium: {
    name: "Chrome and Edge (computer)",
    steps: ["Click the install icon at the right end of the address bar.", "Or open the browser menu and choose Install Coven (Chrome: Cast, save and share, then Install page as app).", "Open Coven from your apps or desktop."],
  },
  firefox: {
    name: "Firefox",
    steps: ["Firefox on computers cannot install web apps. Use Chrome, Edge or Safari to install Coven.", "On Android, open the menu and tap Install."],
  },
  other: {
    name: "Other browsers",
    steps: ["Look for Install app, Add to Home Screen or Add to Dock in your browser's menu or share sheet."],
  },
};

/** How to install Coven on this device, with one-tap install where the browser supports it. */
export default function InstallPage() {
  const { mode, install } = useInstall();
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  useEffect(() => setPlatform(detectPlatform()), []);

  const order = platform ? [platform, ...(Object.keys(STEPS) as InstallPlatform[]).filter((p) => p !== platform)] : [];

  return (
    <AppShell title="Install Coven" subtitle="Open it like an app" back>
      <div className="mx-auto max-w-xl space-y-4">
        {mode === "installed" ? (
          <Card className="py-4">
            <p className="text-sm font-bold text-ink">Coven is installed</p>
            <p className="mt-0.5 text-xs text-ink-soft">You&apos;re using it as an app. You can turn on payment alerts in Settings, then Notifications.</p>
          </Card>
        ) : (
          <>
            <Card className="py-4">
              <p className="text-sm font-bold text-ink">Why install</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                One tap to open, full screen, and payment alerts on your phone. On iPhone, alerts only work once Coven is installed.
              </p>
              {mode === "prompt" && (
                <button
                  type="button"
                  onClick={install}
                  className="mt-3 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-bold text-white transition-[background-color,scale] duration-200 hover:bg-accent/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Install now
                </button>
              )}
            </Card>

            {order.map((p, i) => (
              <Card key={p} className="py-4">
                <p className="text-sm font-bold text-ink">
                  {STEPS[p].name}
                  {i === 0 && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-bold text-accent">Your device</span>}
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-ink-soft">
                  {STEPS[p].steps.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ol>
              </Card>
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}
