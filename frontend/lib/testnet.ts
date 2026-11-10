import { NETWORK } from "@/lib/network";

/**
 * The tracker lists every user's username, wallet address and payments, which is fine for testers
 * and not for real users. It exists only on a testnet deployment; on mainnet its page and API 404.
 */
/** Circle's public faucet for testnet USDC. */
export const FAUCET_URL = "https://faucet.circle.com";

export const TRACKER_ENABLED = NETWORK === "testnet";

/** Testnet tracker labels and eligibility stages, shared by the server and the tracker page. */

export type TxKind =
  | "send"
  | "group_send"
  | "split_create"
  | "split_pay"
  | "goal_create"
  | "goal_contribute"
  | "goal_payout"
  | "deposit";

export const TX_KINDS: Record<TxKind, { label: string; contract: string }> = {
  send: { label: "Send", contract: "USDC transfer" },
  group_send: { label: "Circle send", contract: "USDC transfer" },
  split_create: { label: "Split created", contract: "SplitEscrow" },
  split_pay: { label: "Split paid", contract: "SplitEscrow" },
  goal_create: { label: "Goal created", contract: "GoalPool" },
  goal_contribute: { label: "Goal contribution", contract: "GoalPool" },
  goal_payout: { label: "Goal payout", contract: "GoalPool" },
  deposit: { label: "Deposit", contract: "Inbound USDC" },
};

/**
 * The stages a tester must complete. `required` stages decide eligibility; the rest are shown as
 * progress. Keep this list and the tester guide in step.
 */
export type StageId = "wallet" | "funded" | "circle" | "send" | "split" | "goal" | "invite";

export const STAGES: { id: StageId; label: string; required: boolean }[] = [
  { id: "wallet", label: "Wallet set up", required: true },
  { id: "funded", label: "Funded from faucet", required: false },
  { id: "circle", label: "Created a circle", required: true },
  { id: "send", label: "Sent money", required: true },
  { id: "split", label: "Split a bill", required: true },
  { id: "goal", label: "Contributed to a goal", required: true },
  { id: "invite", label: "Invited a friend", required: true },
];
