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

/** installed: running as an app. prompt: one tap via the browser. ios/manual: not installed, but the user can add it by hand. */
export type InstallMode = "installed" | "prompt" | "ios" | "manual";
export type InstallPlatform = "ios" | "android" | "safari-mac" | "chromium" | "firefox" | "other";

export function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/firefox/i.test(ua)) return "firefox";
  if (/chrome|chromium|edg\//i.test(ua)) return "chromium";
  if (/safari/i.test(ua) && /Macintosh/.test(ua)) return "safari-mac";
  return "other";
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function mode(): InstallMode {
  if (installed || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (detectPlatform() === "ios") return "ios";
  return "manual";
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Whether Coven can be installed here, and how: a native prompt, iPhone Home Screen steps, or not at all. */
export function useInstall() {
  const current = useSyncExternalStore(subscribe, mode, () => "manual" as InstallMode);

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
