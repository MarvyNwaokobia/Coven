"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "coven.balance-hidden";

/**
 * Whether the user has chosen to hide their balance, remembered on this device across reloads and
 * page changes. Until the saved choice is read (right after mount) it reports hidden, so a balance
 * the user hid is never flashed on screen.
 */
export function useBalanceHidden(): [hidden: boolean, toggle: () => void] {
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setSaved(localStorage.getItem(KEY) === "1");
    } catch {
      setSaved(false);
    }
  }, []);

  const toggle = useCallback(() => {
    setSaved((prev) => {
      const next = !(prev ?? false);
      try {
        if (next) localStorage.setItem(KEY, "1");
        else localStorage.removeItem(KEY);
      } catch {
        // Private mode: the choice lasts until the page is closed.
      }
      return next;
    });
  }, []);

  return [saved ?? true, toggle];
}
