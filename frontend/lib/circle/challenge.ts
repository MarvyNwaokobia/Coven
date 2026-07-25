"use client";

import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

export interface ChallengeCredentials {
  userToken: string;
  encryptionKey: string;
  challengeId: string;
}

/**
 * Runs a Circle challenge (PIN setup, PIN entry to approve a transfer, etc.)
 * via the hosted Web SDK widget. Resolves once the challenge completes;
 * rejects on error or user cancellation.
 */
export function runChallenge(creds: ChallengeCredentials): Promise<void> {
  return new Promise((resolve, reject) => {
    const sdk = new W3SSdk({
      appSettings: { appId: process.env.NEXT_PUBLIC_CIRCLE_APP_ID! },
    });
    sdk.setAuthentication({ userToken: creds.userToken, encryptionKey: creds.encryptionKey });
    sdk.execute(creds.challengeId, (error) => {
      if (error) {
        // The SDK's callback type says Error, but in practice can pass a
        // plain {code, message} object — normalize so callers always get
        // a real Error with a usable message instead of a silent fallback.
        reject(error instanceof Error ? error : new Error(String((error as { message?: string })?.message ?? error)));
      } else {
        resolve();
      }
    });
  });
}
