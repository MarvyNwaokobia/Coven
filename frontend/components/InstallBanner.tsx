"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useInstall, installBannerSnoozed, snoozeInstallBanner } from "@/lib/useInstall";

const BTN =
  "mt-3 inline-flex h-9 items-center rounded-full bg-accent px-4 text-xs font-bold text-white transition-[background-color,scale] duration-200 hover:bg-accent/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

/**
 * "Install the app" card. On Home it is dismissible (snoozed 14 days); pass dismissible={false}
 * where installing matters, like next to notifications. Hidden once Coven is installed.
 */
export default function InstallBanner({ dismissible = true, message }: { dismissible?: boolean; message?: string }) {
  const { mode, install } = useInstall();
  // Read after mount: localStorage does not exist during server render.
  const [snoozed, setSnoozed] = useState(dismissible);
  useEffect(() => setSnoozed(dismissible && installBannerSnoozed()), [dismissible]);

  if (snoozed || mode === "installed") return null;

  const dismiss = () => {
    snoozeInstallBanner();
    setSnoozed(true);
  };

  return (
    <section
      aria-label="Install Coven"
      className="animate-fade-up flex items-start gap-3 rounded-xl border border-accent-line bg-accent-soft/50 p-4"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">Install Coven</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          {message ?? "Add Coven to your home screen or dock to open it like an app and get payment alerts."}
        </p>
        {mode === "prompt" ? (
          <button type="button" onClick={install} className={BTN}>
            Install now
          </button>
        ) : (
          <Link href="/settings/install" className={BTN}>
            How to install
          </Link>
        )}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-mute transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </section>
  );
}
