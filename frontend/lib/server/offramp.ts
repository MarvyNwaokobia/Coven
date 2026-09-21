import { ethers } from "ethers";

/**
 * Platform wallet that receives a user's USDC before a cash-out payout is
 * requested. Null when unset or malformed, so callers fail closed instead of
 * paying out against a deposit that went nowhere.
 */
export function offrampCollectionAddress(): string | null {
  const address = process.env.OFFRAMP_COLLECTION_ADDRESS;
  return address && ethers.isAddress(address) ? address : null;
}

/**
 * Whether Yellow Card credentials are configured. Cash out takes the user's
 * USDC before it requests the payout, so it must be refused up front when
 * the payout cannot be made, not after the deposit. Yellow Card issues an
 * API key and a secret; both must be set.
 */
export function offrampCredentialsConfigured(): boolean {
  return Boolean(process.env.YELLOW_CARD_API_KEY && process.env.YELLOW_CARD_API_SECRET);
}

/** Amounts are USDC with 6 decimals; round so the challenge and the verification agree exactly. */
export function roundUsdc(amount: number): number {
  return Math.round(amount * 1e6) / 1e6;
}
