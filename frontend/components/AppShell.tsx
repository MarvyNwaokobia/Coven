"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import NotificationBell from "./NotificationBell";

const TABS = [
  { href: "/home", label: "Home", icon: "🏠" },
  { href: "/circles", label: "Circles", icon: "👥" },
  { href: "/scan", label: "Scan", icon: "📷" },
  { href: "/history", label: "History", icon: "🕘" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

/** Mobile-first shell: sticky header + bottom tab bar. */
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
    <div className="mx-auto w-full max-w-md flex-1 flex flex-col pb-20">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-bg/90 backdrop-blur px-4 py-3 border-b border-border">
        {back ? (
          <button
            onClick={() => history.back()}
            className="text-text-2 hover:text-text text-lg"
            aria-label="Back"
          >
            ←
          </button>
        ) : (
          <Link href="/home" className="font-extrabold text-lg tracking-tight">
            Pay<span className="text-primary">Circle</span>
          </Link>
        )}
        {title && <h1 className="font-semibold">{title}</h1>}
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-md flex">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                pathname.startsWith(t.href) ? "text-accent" : "text-text-2"
              }`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
