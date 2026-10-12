"use client";

import { useCallback, useEffect, useState } from "react";
import { detectCurrency, getCurrency, type DisplayCurrency } from "@/lib/currency";

const STORAGE_KEY = "coven.currency";
export const AUTO = "auto";

function readPreference(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === AUTO || getCurrency(v) ? (v as string) : AUTO;
  } catch {
    return AUTO;
  }
}

/**
 * The currency shown next to USDC amounts. "auto" re-detects from the device location on every
 * load, so it follows the user when they travel; picking a currency pins it.
 */
export function useCurrency(): {
  currency: DisplayCurrency;
  preference: string;
  setPreference: (p: string) => void;
} {
  const [preference, setPref] = useState<string>(AUTO);
  const [detected, setDetected] = useState<string>("NGN");

  useEffect(() => {
    setPref(readPreference());
    setDetected(detectCurrency());
  }, []);

  const setPreference = useCallback((p: string) => {
    setPref(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* private mode: the choice lasts for this page view */
    }
  }, []);

  const currency = getCurrency(preference === AUTO ? detected : preference) ?? getCurrency("NGN")!;
  return { currency, preference, setPreference };
}
