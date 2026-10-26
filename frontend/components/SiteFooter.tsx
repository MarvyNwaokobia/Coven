"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NETWORK, NETWORK_LABEL } from "@/lib/network";
import { CovenMark, ShieldIcon } from "./Icons";

// One footer for every page, rendered once from app/layout.tsx. It carries what every visitor should
// see each time: where things are, where the contracts live, and a standing safety notice.

const GITHUB_URL = "https://github.com/MarvyNwaokobia/Coven";
// Mainnet has no default: set NEXT_PUBLIC_EXPLORER_URL, or the addresses show without a link.
const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ??
  (NETWORK === "testnet" ? "https://explorer.testnet.arc.io" : undefined);

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const GROUPS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Send money", href: "/send" },
      { label: "Request a payment", href: "/request" },
      { label: "Receive by QR", href: "/receive" },
      { label: "Circles", href: "/circles" },
      { label: "Cash out", href: "/cashout" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Create an account", href: "/signup" },
      { label: "Home", href: "/home" },
      { label: "History", href: "/history" },
      { label: "Settings", href: "/settings" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Features", href: "/#features" },
      { label: "Cash out to a bank", href: "/#cashout" },
      { label: "Documentation", href: `${GITHUB_URL}/tree/main/docs`, external: true },
    ],
  },
  {
    title: "Built with",
    links: [
      { label: "Arc", href: "https://www.arc.io", external: true },
      { label: "Circle wallets", href: "https://www.circle.com", external: true },
      { label: "Yellow Card", href: "https://yellowcard.io", external: true },
      { label: "Source on GitHub", href: GITHUB_URL, external: true },
    ],
  },
];

// Read at build time (NEXT_PUBLIC_*), so these must be referenced literally.
const CONTRACTS = [
  { name: "PayCircle", address: process.env.NEXT_PUBLIC_PAYCIRCLE_CONTRACT },
  { name: "SplitEscrow", address: process.env.NEXT_PUBLIC_SPLIT_ESCROW_CONTRACT },
  { name: "GoalPool", address: process.env.NEXT_PUBLIC_GOAL_POOL_CONTRACT },
];

const linkClass =
  "rounded text-sm text-ink-soft transition-colors duration-200 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function FooterAnchor({ link }: { link: FooterLink }) {
  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {link.label} <span aria-hidden="true">↗</span>
    </a>
  ) : (
    <Link href={link.href} className={linkClass}>
      {link.label}
    </Link>
  );
}

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// Routes that are not wrapped in AppShell (no sidebar, no bottom tab bar).
const STANDALONE = ["/signup", "/onboard", "/auth"];

export default function SiteFooter() {
  const pathname = usePathname();
  const inShell =
    pathname !== "/" && !STANDALONE.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    // Inside the app, clear the fixed sidebar (desktop) and the bottom tab bar (mobile).
    <footer className={`border-t border-line bg-surface ${inShell ? "pb-20 lg:pb-0 lg:pl-64" : ""}`}>
      {/* Standing safety notice: shown on every page, every time */}
      <div className="border-b border-warn-line bg-warn-soft">
        <div className="mx-auto flex max-w-7xl items-start gap-2.5 px-5 py-3 lg:px-8">
          <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <p className="text-xs leading-relaxed text-ink-soft">
            <strong className="font-bold text-ink">Stay safe.</strong> Coven will never ask for your
            PIN, a one-time code or a seed phrase, and a payment on Arc is final: check the @username
            and amount before you confirm.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 pb-7 pt-10 lg:px-8">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-70"
            >
              <CovenMark className="h-7 w-7 text-accent" />
              <span className="text-lg font-extrabold tracking-tight text-ink">Coven</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
              Social USDC payments on Arc. Send to an @username, split bills, save toward shared
              goals, with cash out to a local bank coming soon.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-pos">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-pos" />
              {NETWORK_LABEL}
            </p>
            <div className="mt-4">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Coven on GitHub"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors duration-200 hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
                </svg>
              </a>
            </div>
          </div>

          {GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="mb-3.5 text-xs font-bold uppercase tracking-[0.08em] text-ink">
                {group.title}
              </h2>
              <ul className="flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <FooterAnchor link={link} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-9 flex flex-col gap-4 border-t border-line pt-5 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs text-ink-mute">
            © {new Date().getFullYear()} Coven. Built on Arc, USDC native.
          </p>
          <ul
            aria-label="Deployed contracts"
            className="flex flex-wrap items-center gap-x-5 gap-y-1.5 font-numeric text-[0.6875rem] text-ink-mute"
          >
            {CONTRACTS.map((c) => (
              <li key={c.name} className="flex items-center gap-1.5">
                <span>{c.name}:</span>
                {c.address && EXPLORER_URL ? (
                  <a
                    href={`${EXPLORER_URL}/address/${c.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {shorten(c.address)} <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <span>{c.address ? shorten(c.address) : "not configured"}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
