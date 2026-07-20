import { getSupabaseAdmin } from "@/lib/supabase";
import type { ActivityType } from "@/lib/types";

/** Insert an activity feed item (denormalized — one row per affected user). */
export async function recordActivity(items: {
  user_id: string;
  type: ActivityType;
  reference_id?: string | null;
  actor_id?: string | null;
  amount_usdc?: number | null;
  note?: string | null;
}[]) {
  if (items.length === 0) return;
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("activity").insert(items);
  if (error) console.error("recordActivity failed:", error.message);
}
