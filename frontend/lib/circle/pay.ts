"use client";

import { api } from "@/lib/api-client";
import { runChallenge, type ChallengeCredentials } from "./challenge";

export type TransferChallengeRequest =
  | { kind: "send"; toUsername: string; amountUsdc: number }
  | { kind: "circle-member"; toUsername: string; amountUsdc: number }
  | { kind: "request"; requestId: string }
  | { kind: "split"; splitId: string };

/**
 * Requests a transfer challenge from the backend, then runs it through the
 * Circle Web SDK's PIN widget. Resolves once the user has approved the
 * transfer — the caller should then call whichever route actually records
 * the payment (that route independently re-verifies the transfer settled).
 */
export async function approveTransfer(req: TransferChallengeRequest): Promise<void> {
  const creds = await api<ChallengeCredentials>("/api/circle/transfer-challenge", { json: req });
  await runChallenge(creds);
}
