import { sameAddress } from "@/lib/server/goals";
import { SPLIT_STATUS, type OnChainSplit } from "@/lib/server/splits";

/** Split actions other than creating and paying: leaving a split that will not complete. */
export const SPLIT_ACTIONS = ["cancel", "expire", "claim-refund"] as const;

export type SplitAction = (typeof SPLIT_ACTIONS)[number];

export function isSplitAction(value: unknown): value is SplitAction {
  return typeof value === "string" && (SPLIT_ACTIONS as readonly string[]).includes(value);
}

/** The SplitEscrow function each action calls; all take the split id. */
export const SPLIT_ACTION_SIGNATURE: Record<SplitAction, string> = {
  cancel: "cancel(bytes32)",
  expire: "expire(bytes32)",
  "claim-refund": "claimRefund(bytes32)",
};

/**
 * Why `action` cannot be taken right now, judged only from what the contract says, or null when
 * it can. Mirrors SplitEscrow's own checks so people hear about a problem before they approve a
 * PIN, not after a failed transaction.
 */
export function splitActionBlockedReason(action: SplitAction, split: OnChainSplit, wallet: string): string | null {
  const open = split.status === SPLIT_STATUS.Open;

  switch (action) {
    case "cancel":
      if (!open) return "This split is no longer open";
      if (!sameAddress(split.creator, wallet)) return "Only the person who created this split can cancel it";
      return null;

    case "expire":
      if (!open) return "This split is no longer open";
      if (split.now < split.deadline) return "The deadline has not passed yet";
      return null;

    case "claim-refund":
      if (split.status !== SPLIT_STATUS.Expired) return "This split has not been cancelled or expired";
      if (!split.paidByWallet) return "You did not pay into this split";
      if (split.refundClaimedByWallet) return "You have already claimed your refund";
      return null;
  }
}
