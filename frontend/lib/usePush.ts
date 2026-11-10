"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api-client";

export type PushState = "loading" | "unsupported" | "ios-install" | "blocked" | "off" | "on";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** iOS only allows web push for a site added to the Home Screen. */
function needsIosInstall() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/** Web push enable/disable for this device. Registers /sw.js on first enable. */
export function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (needsIosInstall()) return setState("ios-install");
    if (!VAPID || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return setState("unsupported");
    }
    if (Notification.permission === "denied") return setState("blocked");
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    setState(sub && Notification.permission === "granted" ? "on" : "off");
  }, []);

  useEffect(() => {
    refresh().catch(() => setState("unsupported"));
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID!),
        }));
      await api("/api/push/subscribe", { json: sub.toJSON() });
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn on notifications");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/push/subscribe", { method: "DELETE", json: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn off notifications");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, enable, disable };
}
