import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { TRACKER_ENABLED } from "@/lib/testnet";

// Internal page for the core team: keep it out of search results.
export const metadata: Metadata = {
  title: "Testnet tracker · Coven team",
  robots: { index: false, follow: false },
};

export default function TestnetLayout({ children }: { children: ReactNode }) {
  if (!TRACKER_ENABLED) notFound();
  return children;
}
