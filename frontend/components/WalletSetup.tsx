"use client";

import { useState } from "react";
import { Button, Card, Alert } from "./ui";
import { api } from "@/lib/api-client";
import { runChallenge, type ChallengeCredentials } from "@/lib/circle/challenge";
import { LockIcon, CheckCircleIcon } from "./Icons";

type InitResponse =
  | { alreadyInitialized: true; walletAddress: string | null }
  | ({ alreadyInitialized: false } & ChallengeCredentials);

const ASSURANCES = [
  "No seed phrase to write down or lose",
  "Your PIN never leaves Circle's secure widget",
  "Coven can't move your funds without you",
];

/** Onboarding step: set a PIN via Circle's hosted widget to provision the Arc wallet. */
export default function WalletSetup({
  onComplete,
}: {
  onComplete: (walletAddress: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const initRes = await api<InitResponse>("/api/circle/init", { json: {} });

      if (initRes.alreadyInitialized) {
        onComplete(initRes.walletAddress);
        return;
      }

      await runChallenge(initRes);

      const { walletAddress } = await api<{ walletAddress: string }>("/api/circle/complete", {
        json: {},
      });
      onComplete(walletAddress);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <LockIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-bold text-ink">Secure your wallet</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Set a PIN to protect your Arc wallet. This is the only thing standing
            between anyone and your money, so pick something you won't forget.
          </p>
        </div>
      </div>

      <ul className="space-y-2 rounded-lg border border-line bg-canvas p-4">
        {ASSURANCES.map((a) => (
          <li key={a} className="flex items-start gap-2 text-xs font-medium text-ink-soft">
            <CheckCircleIcon className="mt-px h-4 w-4 shrink-0 text-pos" />
            {a}
          </li>
        ))}
      </ul>

      <Button fullWidth size="lg" onClick={start} loading={busy}>
        {busy ? "Opening secure setup…" : "Set up wallet"}
      </Button>

      {error && <Alert>{error}</Alert>}
    </Card>
  );
}
