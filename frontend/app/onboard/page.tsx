"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card } from "@/components/ui";
import { api } from "@/lib/api-client";
import { validateUsername } from "@/lib/format";
import { useAuth } from "@/lib/useAuth";

/** Username selection + profile setup after first login. */
export default function OnboardPage() {
  const router = useRouter();
  useAuth(); // redirects to /signup if unauthenticated
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const clientError = username ? validateUsername(username) : null;

  async function claim() {
    setBusy(true);
    setError("");
    try {
      await api("/api/users/create", { json: { username, displayName } });
      router.replace("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not claim username");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md flex-1 flex flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-extrabold mb-1">Choose your @username</h1>
      <p className="text-text-2 text-sm mb-8">
        It's unique, permanent, and how friends find and pay you.
      </p>

      <Card className="space-y-4">
        <div className="relative">
          <span className="absolute left-4 top-3 text-text-2">@</span>
          <Input
            className="pl-9"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            maxLength={20}
          />
        </div>
        {clientError && <p className="text-warning text-xs">{clientError}</p>}

        <Input
          placeholder="Display name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
        />

        <Button
          className="w-full"
          onClick={claim}
          disabled={busy || !username || !!clientError}
        >
          {busy ? "Claiming…" : `Claim @${username || "username"}`}
        </Button>
        {error && <p className="text-danger text-sm">{error}</p>}
      </Card>

      <p className="text-xs text-text-2/70 mt-6 text-center">
        Your Circle wallet on Arc is created automatically — no seed phrase needed.
      </p>
    </div>
  );
}
