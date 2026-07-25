"use client";

import { useState } from "react";
import { Button, Card, Spinner } from "./ui";
import { api } from "@/lib/api-client";
import { runChallenge, type ChallengeCredentials } from "@/lib/circle/challenge";

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
      <p className="text-3xl">🔐</p>
      <div>
        <p className="font-semibold">Secure your wallet</p>
        <p className="text-sm text-text-2 mt-1">
          Set a PIN to protect your Arc wallet — no seed phrase, just a PIN only you know.
        </p>
      </div>
      <Button className="w-full" onClick={start} disabled={busy}>
        {busy ? <Spinner className="mx-auto" /> : "Set up wallet"}
      </Button>
      {error && <p className="text-danger text-sm">{error}</p>}
    </Card>
  );
}
