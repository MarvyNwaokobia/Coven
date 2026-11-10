"use client";

import { useCallback, useSyncExternalStore } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Module-level so the browser's one-shot `beforeinstallprompt` is kept even if it fires before
// the screen that shows the install button has mounted. <InstallCapture /> in the root layout
// is what loads this file on every page.
let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export type InstallMode = "installed" | "prompt" | "ios" | "none";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Other iOS browsers cannot add to the Home Screen the same way; CriOS/FxiOS/EdgiOS are Chrome/Firefox/Edge.
  return ios && !/crios|fxios|edgios/i.test(ua);
}

function mode(): InstallMode {
  if (installed || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIosSafari()) return "ios";
  return "none";
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Whether Coven can be installed here, and how: a native prompt, iPhone Home Screen steps, or not at all. */
export function useInstall() {
  const current = useSyncExternalStore(subscribe, mode, () => "none" as InstallMode);

  const install = useCallback(async () => {
    if (!deferred) return;
    const ev = deferred;
    deferred = null; // a prompt can only be shown once
    emit();
    await ev.prompt();
    await ev.userChoice.catch(() => {});
  }, []);

  return { mode: current, install };
}

const DISMISS_KEY = "coven:install-dismissed";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export function installBannerSnoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function snoozeInstallBanner() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Private mode: it just comes back next visit.
  }
}
