"use client";

import { api } from "@/lib/api-client";
import { runChallenge, type ChallengeCredentials } from "./challenge";

/** Create a savings goal - one PIN challenge (createGoal on-chain). */
export async function createGoal(params: {
  circleId: string;
  memberUsernames: string[];
  targetAmountUsdc: number;
  description: string;
}): Promise<{ goal: { id: string } }> {
  const creds = await api<ChallengeCredentials>("/api/goals/create-challenge", { json: params });
  await runChallenge(creds);
  return api("/api/goals/create-confirm", { json: params });
}

/**
 * Contribute to a goal. First-time contributors need an approve() challenge
 * before the actual contribute() challenge - this loops through both
 * automatically so the caller just sees one call.
 */
export async function contributeToGoal(goalId: string, amountUsdc: number): Promise<void> {
  for (let i = 0; i < 2; i++) {
    const creds = await api<ChallengeCredentials & { step: "approve" | "contribute" }>(
      `/api/goals/${goalId}/contribute-challenge`,
      { json: { amountUsdc } }
    );
    await runChallenge(creds);
    const result = await api<{ approved?: boolean }>(`/api/goals/${goalId}/contribute-confirm`, {
      json: { amountUsdc, step: creds.step },
    });
    if (creds.step === "contribute" || result.approved !== true) return;
    // step was "approve" - loop once more to get the real contribute challenge
  }
}

/** Request to withdraw a goal's full pooled balance to a recipient. */
export async function requestGoalWithdrawal(goalId: string, recipientUsername: string): Promise<void> {
  const creds = await api<ChallengeCredentials>(`/api/goals/${goalId}/withdraw-request-challenge`, {
    json: { recipientUsername },
  });
  await runChallenge(creds);
  await api(`/api/goals/${goalId}/withdraw-request-confirm`, { json: { recipientUsername } });
}

/** Approve the goal's currently pending withdrawal request. */
export async function approveGoalWithdrawal(goalId: string): Promise<{ executed: boolean }> {
  const creds = await api<ChallengeCredentials>(`/api/goals/${goalId}/withdraw-approve-challenge`, {
    json: {},
  });
  await runChallenge(creds);
  return api(`/api/goals/${goalId}/withdraw-approve-confirm`, { json: {} });
}

export type GoalAction = "start-exit" | "cancel-exit" | "dissolve" | "claim-refund" | "cancel-withdrawal";

/**
 * Run one of the goal actions that is neither a contribution nor an approval:
 * a time-locked exit, claiming a refund after a goal is dissolved, or calling
 * off your own withdrawal request. One PIN challenge, then a confirm.
 */
export async function goalAction(goalId: string, action: GoalAction): Promise<void> {
  const creds = await api<ChallengeCredentials>(`/api/goals/${goalId}/action-challenge`, { json: { action } });
  await runChallenge(creds);
  await api(`/api/goals/${goalId}/action-confirm`, { json: { action } });
}
