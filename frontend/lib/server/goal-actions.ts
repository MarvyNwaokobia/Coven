import { GOAL_STATUS, WITHDRAWAL_STATUS, sameAddress, type OnChainGoal, type OnChainWithdrawal } from "@/lib/server/goals";

/**
 * Goal actions that are not a contribution or an approval: leaving a goal that
 * cannot reach unanimity (a time-locked exit), and calling off your own
 * withdrawal request.
 */
export const GOAL_ACTIONS = [
  "start-exit",
  "cancel-exit",
  "dissolve",
  "claim-refund",
  "cancel-withdrawal",
] as const;

export type GoalAction = (typeof GOAL_ACTIONS)[number];

export function isGoalAction(value: unknown): value is GoalAction {
  return typeof value === "string" && (GOAL_ACTIONS as readonly string[]).includes(value);
}

/** The GoalPool function each action calls. Every one takes the goal id, except cancel-withdrawal (the request id). */
export const ACTION_SIGNATURE: Record<GoalAction, string> = {
  "start-exit": "startExit(bytes32)",
  "cancel-exit": "cancelExit(bytes32)",
  dissolve: "dissolve(bytes32)",
  "claim-refund": "claimRefund(bytes32)",
  "cancel-withdrawal": "cancelWithdrawalRequest(uint256)",
};

/**
 * Why `action` cannot be taken right now, judged only from what the contract
 * says, or null when it can. Mirrors GoalPool's own checks so members hear
 * about a problem before they approve a PIN, not after a failed transaction.
 */
export function actionBlockedReason(
  action: GoalAction,
  goal: OnChainGoal,
  wallet: string,
  withdrawal: OnChainWithdrawal | null
): string | null {
  const open = goal.status === GOAL_STATUS.Open;

  switch (action) {
    case "start-exit":
      if (!open) return "This goal is no longer open";
      if (goal.exitAt !== 0) return "An exit countdown is already running";
      return null;

    case "cancel-exit":
      if (!open) return "This goal is no longer open";
      if (goal.exitAt === 0) return "No exit countdown is running";
      if (!sameAddress(goal.exitInitiator, wallet)) {
        return "Only the member who started the countdown can cancel it";
      }
      return null;

    case "dissolve":
      if (!open) return "This goal is no longer open";
      if (goal.exitAt === 0) return "No exit countdown is running";
      if (goal.now < goal.exitAt) return "The exit countdown has not finished yet";
      return null;

    case "claim-refund":
      if (goal.status !== GOAL_STATUS.Cancelled) return "This goal has not been dissolved";
      if (goal.contributionOfWallet === BigInt(0)) return "You have nothing to claim from this goal";
      return null;

    case "cancel-withdrawal":
      if (!withdrawal) return "There is no pending withdrawal request";
      if (withdrawal.status !== WITHDRAWAL_STATUS.Pending) return "This withdrawal request is no longer pending";
      if (!sameAddress(withdrawal.requester, wallet)) {
        return "Only the member who made the request can cancel it";
      }
      return null;
  }
}
