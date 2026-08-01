"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import NotificationBell from "./NotificationBell";
import { HomeIcon, CirclesIcon, ScanIcon, HistoryIcon, SettingsIcon } from "./Icons";

const TABS = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/circles", label: "Circles", icon: CirclesIcon },
  { href: "/scan", label: "Scan", icon: ScanIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

/** Mobile-first shell: sticky header + bottom tab bar + enlarged background money watermarks. */
export default function AppShell({
  title,
  children,
  back,
}: {
  title?: string;
  children: ReactNode;
  back?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen bg-slate-50/60 text-slate-900 flex flex-col antialiased">
      {/* Background Watermarks — Enlarged Faded Money & Transfer Icons */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none opacity-[0.035] text-[#0a192f]">
        {/* Top-right Send / Arrow icon watermark */}
        <svg
          className="absolute -top-12 -right-16 w-80 h-80 -rotate-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
        </svg>

        {/* Mid-left Receive / Download icon watermark */}
        <svg
          className="absolute top-1/3 -left-20 w-80 h-80 rotate-45"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>

        {/* Bottom-right Money/Banknote watermark */}
        <svg
          className="absolute bottom-16 -right-12 w-96 h-96 -rotate-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5a1.5 1.5 0 011.5 1.5v9.75a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5zm12 6a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md flex-1 flex flex-col pb-24">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-3.5 border-b border-slate-200/80 shadow-2xs">
          {back ? (
            <button
              onClick={() => history.back()}
              className="text-slate-600 hover:text-slate-900 text-lg font-medium p-1 -ml-1 transition-colors"
              aria-label="Back"
            >
              ←
            </button>
          ) : (
            <Link href="/home" className="font-extrabold text-lg tracking-tight text-[#0a192f]">
              Coven
            </Link>
          )}
          {title && <h1 className="font-bold text-slate-900 text-base">{title}</h1>}
          <div className="ml-auto flex items-center">
            <NotificationBell />
          </div>
        </header>

        {/* Main Content Container */}
        <main className="flex-1 px-4 py-4">{children}</main>

        {/* Fixed Bottom Navigation */}
        <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-lg">
          <div className="mx-auto max-w-md flex">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                    active ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <div className={`p-1 rounded-xl transition-all ${active ? "bg-blue-50 text-blue-600" : ""}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
