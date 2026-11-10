"use client";

import AppShell from "@/components/AppShell";
import { useTheme, type ThemePreference } from "@/lib/useTheme";

const OPTIONS: { id: ThemePreference; label: string; hint: string }[] = [
  { id: "system", label: "System", hint: "Match your device, and switch automatically" },
  { id: "light", label: "Light", hint: "Always light" },
  { id: "dark", label: "Dark", hint: "Always dark" },
];

/** Light / dark / system theme choice, saved on this device. */
export default function AppearancePage() {
  const { preference, setPreference } = useTheme();

  return (
    <AppShell title="Appearance" subtitle="Light or dark" back>
      <div className="mx-auto max-w-xl">
        <div role="radiogroup" aria-label="Theme" className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-e1">
          {OPTIONS.map((o) => {
            const on = preference === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPreference(o.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-accent" : "border-line-strong"}`}
                >
                  {on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{o.label}</span>
                  <span className="block text-xs text-ink-mute">{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
