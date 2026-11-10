"use client";

import Link from "next/link";
import { useInstall } from "@/lib/useInstall";

const CLS =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-bold text-white transition-[background-color,scale] duration-200 hover:bg-accent/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

function DownloadGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
    </svg>
  );
}

/** "Install" pill for the app header. Gone once Coven is installed. One tap where the browser allows it, otherwise opens the how-to page. */
export default function InstallPill() {
  const { mode, install } = useInstall();
  if (mode === "installed") return null;

  const label = (
    <>
      <DownloadGlyph />
      <span className="hidden sm:inline">Install</span>
    </>
  );
  return mode === "prompt" ? (
    <button type="button" onClick={install} aria-label="Install Coven" className={CLS}>
      {label}
    </button>
  ) : (
    <Link href="/settings/install" aria-label="Install Coven" className={CLS}>
      {label}
    </Link>
  );
}
