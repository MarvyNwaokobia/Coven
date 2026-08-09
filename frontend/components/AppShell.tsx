"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import NotificationBell from "./NotificationBell";
import { Avatar, Skeleton } from "./ui";
import { useAuth, signOut } from "@/lib/useAuth";
import {
  HomeIcon,
  CirclesIcon,
  ScanIcon,
  HistoryIcon,
  SettingsIcon,
  SendIcon,
  ArrowLeftIcon,
  CovenMark,
  LogoutIcon,
} from "./Icons";

const TABS = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/circles", label: "Circles", icon: CirclesIcon },
  { href: "/scan", label: "Scan", icon: ScanIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function useActiveTab() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/* ------------------------------------------------------------- Desktop nav */

function Sidebar() {
  const isActive = useActiveTab();
  const { user } = useAuth({ optional: true });

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-6">
        <Link
          href="/home"
          className="inline-flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-70"
        >
          <CovenMark className="h-7 w-7 text-accent" />
          <span className="text-lg font-extrabold tracking-tight text-ink">Coven</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`
                group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold
                transition-[background-color,color] duration-200 ease-out-soft
                ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                }
              `}
            >
              {/* Active marker: position + colour, not colour alone. */}
              <span
                aria-hidden="true"
                className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent transition-transform duration-200 ease-out-soft ${
                  active ? "scale-y-100" : "scale-y-0"
                }`}
              />
              <Icon className="h-5 w-5 shrink-0 transition-transform duration-200 ease-spring group-hover:scale-110" />
              {t.label}
            </Link>
          );
        })}

        <div className="px-1 pt-5">
          <Link
            href="/send"
            className="sheen group/cta flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-e1 transition-[background-color,box-shadow,translate,scale] duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-brand-hover hover:shadow-e3 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <SendIcon className="h-4 w-4 transition-transform duration-200 ease-spring group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5" />
            Send money
          </Link>
        </div>
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          {user ? (
            <Avatar username={user.username} avatarUrl={user.avatar_url} size={36} />
          ) : (
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          )}
          <div className="min-w-0 flex-1">
            {user ? (
              <p className="truncate text-sm font-bold text-ink">@{user.username}</p>
            ) : (
              <Skeleton className="h-3.5 w-24" />
            )}
            <p className="mt-0.5 truncate text-xs text-ink-mute">Arc · USDC</p>
          </div>
          <button
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-mute transition-colors duration-200 hover:bg-neg-soft hover:text-neg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <LogoutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------- Mobile nav */

function BottomTabs() {
  const isActive = useActiveTab();

  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-lg lg:hidden"
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`
                relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 pt-1.5 pb-1
                text-[0.625rem] font-bold tracking-tight
                transition-colors duration-200 ease-out-soft
                ${active ? "text-accent" : "text-ink-mute active:text-ink"}
              `}
            >
              <span
                aria-hidden="true"
                className={`absolute top-0 h-0.5 w-8 rounded-full bg-accent transition-transform duration-200 ease-out-soft ${
                  active ? "scale-x-100" : "scale-x-0"
                }`}
              />
              <Icon
                className={`h-5 w-5 transition-transform duration-200 ease-spring ${
                  active ? "-translate-y-px scale-110" : ""
                }`}
              />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------- Shell */

export default function AppShell({
  title,
  subtitle,
  children,
  back,
  action,
  /** Full-bleed content grid for dashboard-style pages. */
  wide = false,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  back?: boolean;
  action?: ReactNode;
  wide?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth({ optional: true });

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <Sidebar />

      <div className="lg:pl-64">
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-lg">
          <div
            className={`mx-auto flex h-16 items-center gap-3 px-4 lg:px-8 ${
              wide ? "max-w-7xl" : "max-w-5xl"
            }`}
          >
            {back ? (
              <button
                onClick={() => router.back()}
                aria-label="Go back"
                className="-ml-2 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,color,translate,scale] duration-200 hover:bg-surface-2 hover:text-ink active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ArrowLeftIcon />
              </button>
            ) : (
              <Link
                href="/home"
                className="shrink-0 transition-opacity hover:opacity-70 lg:hidden"
                aria-label="Coven home"
              >
                <CovenMark className="h-7 w-7 text-accent" />
              </Link>
            )}

            <div className="min-w-0 flex-1">
              {title && (
                <h1 className="truncate text-base font-bold tracking-tight text-ink lg:text-xl">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="truncate text-xs text-ink-mute lg:text-sm">{subtitle}</p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {action}
              <NotificationBell />
              <Link
                href="/settings"
                aria-label="Your profile"
                className="hidden rounded-full transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 lg:block"
              >
                <Avatar username={user?.username ?? "?"} avatarUrl={user?.avatar_url} size={34} />
              </Link>
            </div>
          </div>
        </header>

        {/* Keying on pathname replays the fade on every route change, so
            navigation reads as a transition rather than a hard swap. */}
        <main
          id="main"
          key={pathname}
          className={`animate-fade-in mx-auto w-full px-4 pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-14 ${
            wide ? "max-w-7xl" : "max-w-5xl"
          }`}
        >
          {children}
        </main>
      </div>

      <BottomTabs />
    </div>
  );
}
