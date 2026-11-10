"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Button, Card, Skeleton } from "@/components/ui";
import { BanknoteIcon, CheckCircleIcon, CreditCardIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { NETWORK, NETWORK_LABEL } from "@/lib/network";
import { FAUCET_URL, STAGES } from "@/lib/testnet";
import type { Participant } from "@/lib/server/testnet-tracker";

export default function NetworkSettingsPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  // undefined while loading, null when there is nothing to show (not on the tracker, or it failed).
  const [progress, setProgress] = useState<Participant | null | undefined>(undefined);

  useEffect(() => {
    if (!user || NETWORK !== "testnet") return;
    api<{ walletAddress: string | null }>("/api/circle/status")
      .then(({ walletAddress }) => setWallet(walletAddress))
      .catch(() => setWallet(null));
    api<{ progress: Participant | null }>("/api/testnet/me")
      .then(({ progress }) => setProgress(progress))
      .catch(() => setProgress(null));
  }, [user]);

  async function copyAddress() {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <AppShell title={NETWORK === "testnet" ? "Testnet and free USDC" : "Network"} subtitle={NETWORK_LABEL} back>
      <div className="mx-auto max-w-xl space-y-5">
        {/* Testnet only: where to get free test USDC */}
        {NETWORK === "testnet" && wallet && (
          <Card className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                <BanknoteIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">Get free test USDC</p>
                <p className="text-xs text-ink-mute">Free, and it only takes a minute.</p>
              </div>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-ink-soft">
              <li>Tap <strong className="text-ink">Copy my address</strong>.</li>
              <li>Open the Circle faucet.</li>
              <li>Choose <strong className="text-ink">Arc Testnet</strong> and <strong className="text-ink">USDC</strong>, paste your address and send the request.</li>
              <li>Come back here. The USDC shows up on Home within a minute or two.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={copyAddress}>
                {copied ? "Address copied" : "Copy my address"}
              </Button>
              <a
                href={FAUCET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg bg-ink px-3.5 py-2 text-sm font-bold text-surface transition-colors duration-200 hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Open Circle faucet <span aria-hidden="true" className="ml-1">↗</span>
              </a>
            </div>
          </Card>
        )}

        {/* Testnet only: how far this tester is through the eligibility stages */}
        {NETWORK === "testnet" && progress !== null && (
          <Card className="space-y-3">
            {progress === undefined ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink">Your testnet progress</p>
                    <p className="text-xs text-ink-mute">
                      {STAGES.filter((s) => s.required && progress.stages[s.id]).length} of{" "}
                      {STAGES.filter((s) => s.required).length} required stages
                    </p>
                  </div>
                  {progress.eligible && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-pos-line bg-pos-soft px-2.5 py-1 text-[0.6875rem] font-bold text-pos">
                      <CheckCircleIcon className="h-3.5 w-3.5" /> Eligible
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {STAGES.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      {progress.stages[s.id] ? (
                        <CheckCircleIcon className="h-4 w-4 shrink-0 text-pos" />
                      ) : (
                        <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border border-line-strong" />
                      )}
                      <span className={progress.stages[s.id] ? "text-ink" : "text-ink-soft"}>
                        {s.label}
                        {!s.required && <span className="text-ink-mute"> (optional)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-ink-mute">Updates about every 30 seconds.</p>
              </>
            )}
          </Card>
        )}

        <Card className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-soft">
            <CreditCardIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">{NETWORK_LABEL}</p>
            <p className="text-xs text-ink-mute">Sub-500ms settlement · zero gas on P2P</p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
