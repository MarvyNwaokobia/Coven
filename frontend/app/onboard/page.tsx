"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card, Alert } from "@/components/ui";
import Stepper from "@/components/Stepper";
import WalletSetup from "@/components/WalletSetup";
import { CovenMark } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { validateUsername } from "@/lib/format";
import { useAuth } from "@/lib/useAuth";

const STEPS = ["Handle", "Wallet"];

/** Username selection, then wallet PIN setup, after first login. */
export default function OnboardPage() {
  const router = useRouter();
  useAuth(); // redirects to /signup if unauthenticated
  const [step, setStep] = useState<"username" | "wallet">("username");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  // Validate as they type, but only surface it once they've moved on.
  const clientError = username ? validateUsername(username) : null;
  const showError = touched ? clientError : null;

  async function claim() {
    setBusy(true);
    setError("");
    try {
      await api("/api/users/create", { json: { username, displayName } });
      setStep("wallet");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not claim username");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-canvas px-5 py-8 text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-3xl max-w-[130vw] -translate-x-1/2 rounded-full bg-accent/8 blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <CovenMark className="h-9 w-9 text-accent" />

        <div className="mt-6">
          <Stepper steps={STEPS} current={step === "username" ? 0 : 1} />
        </div>

        {step === "username" ? (
          <div className="animate-fade-up mt-8">
            <h1 className="text-2xl font-extrabold tracking-tight">Choose your @username</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              It's unique, permanent, and how friends find and pay you. Pick
              carefully, because you can't change it later.
            </p>

            <Card className="mt-6 space-y-4">
              <Input
                label="Username"
                prefix="@"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                onBlur={() => setTouched(true)}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                autoFocus
                required
                error={showError ?? undefined}
                hint="3–20 characters. Letters, numbers and underscores."
              />

              <Input
                label="Display name (optional)"
                placeholder="How your name shows up"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
              />

              {error && <Alert>{error}</Alert>}

              <Button
                fullWidth
                size="lg"
                onClick={claim}
                loading={busy}
                disabled={!username || !!clientError}
              >
                Claim @{username || "username"}
              </Button>
            </Card>
          </div>
        ) : (
          <div className="animate-fade-up mt-8">
            <h1 className="text-2xl font-extrabold tracking-tight">One more step</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              <span className="font-bold text-ink">@{username}</span> is yours.
              Now secure the wallet behind it.
            </p>
            <div className="mt-6">
              <WalletSetup onComplete={() => router.replace("/home")} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
