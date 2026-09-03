"use client";

import { api } from "@/lib/api-client";
import { runChallenge, type ChallengeCredentials } from "./challenge";

/** Create a bill split held in escrow: one PIN challenge (createSplit on-chain), then a confirm. */
export async function createSplit(params: {
  circleId: string;
  memberUsernames: string[];
  amounts: number[];
  description: string;
  deadlineHours?: number;
}): Promise<{ split: { id: string } }> {
  const creds = await api<ChallengeCredentials>("/api/splits/create-challenge", { json: params });
  await runChallenge(creds);
  return api("/api/splits/create-confirm", { json: { circleId: params.circleId } });
}

/**
 * Pay your share into escrow. If the escrow's allowance is short, the first challenge is an
 * approve() for exactly your share; this loops through it and then the payment itself so the
 * caller sees one call. `complete` is true when yours was the last share and the escrow has
 * released the total to the creator.
 */
export async function paySplitShare(splitId: string): Promise<{ complete: boolean }> {
  for (let i = 0; i < 2; i++) {
    const creds = await api<ChallengeCredentials & { step: "approve" | "pay" }>(
      `/api/splits/${splitId}/pay-challenge`,
      { json: {} }
    );
    await runChallenge(creds);
    const result = await api<{ approved?: boolean; complete?: boolean }>(`/api/splits/${splitId}/pay-confirm`, {
      json: { step: creds.step },
    });
    if (creds.step === "pay") return { complete: result.complete === true };
  }
  throw new Error("Your payment could not be completed. Please try again.");
}

export type SplitAction = "cancel" | "expire" | "claim-refund";

/** Cancel a split you created, expire one past its deadline, or claim your refund from either. */
export async function splitAction(splitId: string, action: SplitAction): Promise<void> {
  const creds = await api<ChallengeCredentials>(`/api/splits/${splitId}/action-challenge`, { json: { action } });
  await runChallenge(creds);
  await api(`/api/splits/${splitId}/action-confirm`, { json: { action } });
}
