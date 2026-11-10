"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export const THEME_KEY = "coven.theme";

/**
 * Runs inline in <head> (see layout.tsx) so the right theme is on <html> before the first paint.
 * Kept as a string so it is not subject to hydration or bundling. Mirrors resolve()/apply() below.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");var d=p==="dark"||((p!=="light")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

/** The saved theme choice (System, Light or Dark) and a setter. System follows the device live. */
export function useTheme() {
  const [preference, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    setPref(readPreference());
  }, []);

  // In System mode, follow the device when it flips between light and dark.
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    try {
      if (p === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, p);
    } catch {
      // Private mode: the choice lasts for this visit.
    }
    apply(p);
  }, []);

  return { preference, setPreference };
}
