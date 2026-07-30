"use client";

import { useState } from "react";
import { Button, Card, Spinner } from "./ui";
import { api } from "@/lib/api-client";
import { runChallenge, type ChallengeCredentials } from "@/lib/circle/challenge";
import { LockIcon } from "./Icons";

type InitResponse =
  | { alreadyInitialized: true; walletAddress: string | null }
  | ({ alreadyInitialized: false } & ChallengeCredentials);

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
    <Card className="space-y-4 text-center py-8">
      <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
        <LockIcon className="w-6 h-6" />
      </div>
      <div>
        <p className="font-bold text-slate-900 text-lg">Secure your wallet</p>
        <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
          Set a PIN to protect your Arc wallet — no seed phrase, just a PIN only you know.
        </p>
      </div>
      <Button className="w-full" onClick={start} disabled={busy}>
        {busy ? <Spinner className="mx-auto" /> : "Set up wallet"}
      </Button>
      {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
    </Card>
  );
}
