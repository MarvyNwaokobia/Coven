"use client";

import { useEffect, useState } from "react";
import { useInstall, installBannerSnoozed, snoozeInstallBanner } from "@/lib/useInstall";

/** Dismissible "install the app" card for Home. Hidden once installed, unsupported, or snoozed for 14 days. */
export default function InstallBanner() {
  const { mode, install } = useInstall();
  // Read after mount: localStorage does not exist during server render.
  const [snoozed, setSnoozed] = useState(true);
  useEffect(() => setSnoozed(installBannerSnoozed()), []);

  if (snoozed || (mode !== "prompt" && mode !== "ios")) return null;

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
          {mode === "ios"
            ? "Tap Share, then Add to Home Screen, to open Coven like an app and get payment alerts."
            : "Add Coven to your home screen for one-tap access and payment alerts."}
        </p>
        {mode === "prompt" && (
          <button
            type="button"
            onClick={install}
            className="mt-3 inline-flex h-9 items-center rounded-full bg-accent px-4 text-xs font-bold text-white transition-[background-color,scale] duration-200 hover:bg-accent/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Install
          </button>
        )}
      </div>
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
    </section>
  );
}
