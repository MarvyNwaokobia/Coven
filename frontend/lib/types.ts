// Shared domain types mirroring the Supabase schema

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  circle_wallet_id: string | null;
  wallet_address: string | null;
  bio: string | null;
  total_sent: number;
  total_received: number;
  created_at: string;
}

export interface Payment {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount_usdc: number;
  fee_usdc: number;
  note: string | null;
  source_chain: string;
  tx_hash: string | null;
  cctp_nonce: number | null;
  status: "pending" | "completed" | "failed";
  circle_id: string | null;
  created_at: string;
}

export interface PaymentRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount_usdc: number;
  note: string | null;
  status: "pending" | "paid" | "cancelled" | "expired";
  payment_id: string | null;
  expires_at: string;
  created_at: string;
  from_user?: User;
  to_user?: User;
}

export interface Circle {
  id: string;
  name: string;
  emoji: string;
  creator_id: string;
  created_at: string;
  members?: User[];
  member_count?: number;
}

export interface Split {
  id: string;
  contract_split_id: string | null;
  creator_id: string;
  circle_id: string | null;
  total_amount_usdc: number;
  collected_usdc: number;
  description: string;
  status: "open" | "complete" | "cancelled";
  deadline: string | null;
  created_at: string;
  members?: SplitMember[];
}

export interface SplitMember {
  split_id: string;
  user_id: string;
  amount_owed_usdc: number;
  paid: boolean;
  payment_id: string | null;
  paid_at: string | null;
  user?: User;
}

export interface BankAccount {
  id: string;
  user_id: string;
  bank_name: string;
  bank_code: string;
  account_name: string;
  country: string;
  currency: string;
  is_default: boolean;
  created_at: string;
  /** Last 4 digits only — full number never leaves the server */
  account_last4?: string;
}

export interface OfframpPayout {
  id: string;
  user_id: string;
  amount_usdc: number;
  fee_usdc: number;
  net_usdc: number;
  target_currency: string;
  expected_amount: number | null;
  bank_account_id: string | null;
  yellow_card_payout_id: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  tracking_ref: string | null;
  created_at: string;
  completed_at: string | null;
}

export type ActivityType =
  | "payment_sent"
  | "payment_received"
  | "request_received"
  | "request_paid"
  | "split_created"
  | "split_paid"
  | "split_complete"
  | "offramp_completed"
  | "offramp_failed"
  | "circle_joined";

export interface ActivityItem {
  id: string;
  user_id: string;
  type: ActivityType;
  reference_id: string | null;
  actor_id: string | null;
  amount_usdc: number | null;
  note: string | null;
  read: boolean;
  created_at: string;
  actor?: User;
}
