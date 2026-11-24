"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "coven.balance-unit";

/**
 * Whether the Home balance is shown in USDC or converted to the display currency, remembered on
 * this device. Which local currency is used comes from useCurrency.
 */
export type BalanceUnit = "usdc" | "local";

export function useBalanceUnit(): [unit: BalanceUnit, setUnit: (u: BalanceUnit) => void] {
  const [unit, setUnitState] = useState<BalanceUnit>("usdc");

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "local") setUnitState("local");
    } catch {
      // Private mode: start in USDC.
    }
  }, []);

  const setUnit = useCallback((u: BalanceUnit) => {
    setUnitState(u);
    try {
      localStorage.setItem(KEY, u);
    } catch {
      // Private mode: the choice lasts until the page is closed.
    }
  }, []);

  return [unit, setUnit];
}
