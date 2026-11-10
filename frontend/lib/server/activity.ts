import { getSupabaseAdmin } from "@/lib/supabase";
import type { ActivityType } from "@/lib/types";
import { pushActivity } from "@/lib/server/push";

type ActivityInsert = {
  user_id: string;
  type: ActivityType;
  reference_id?: string | null;
  actor_id?: string | null;
  amount_usdc?: number | null;
  note?: string | null;
  /** The user's own action: no need to light up the bell. */
  read?: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Postgres class 23 is an integrity violation (a check, unique or foreign key): retrying cannot help. */
const retryable = (code?: string) => !code || !code.startsWith("23");

/**
 * Insert activity feed items (denormalized - one row per affected user). The action they describe has
 * already happened, so this never throws; it tells you whether every row was saved.
 *
 * A batch is all-or-nothing, so one row the database refuses (an activity type its constraint does not
 * list yet, say) would drop the others with it. When the batch fails, each row is saved on its own,
 * with one retry for a transient error. Whatever still cannot be saved is logged under
 * "[activity-failed]" with the type, user and reference, so it can be searched for or alerted on.
 */
export async function recordActivity(items: ActivityInsert[]): Promise<boolean> {
  if (items.length === 0) return true;
  const admin = getSupabaseAdmin();

  const { error } = await admin.from("activity").insert(items);
  if (!error) {
    await pushActivity(items);
    return true;
  }

  const saved: ActivityInsert[] = [];
  const failed: { type: string; user_id: string; reference_id: string | null; code?: string; message: string }[] = [];
  for (const item of items) {
    let { error: rowError } = await admin.from("activity").insert(item);
    if (rowError && retryable(rowError.code)) {
      await sleep(200);
      ({ error: rowError } = await admin.from("activity").insert(item));
    }
    if (!rowError) saved.push(item);
    if (rowError) {
      failed.push({
        type: item.type,
        user_id: item.user_id,
        reference_id: item.reference_id ?? null,
        code: rowError.code,
        message: rowError.message,
      });
    }
  }

  await pushActivity(saved);
  if (failed.length > 0) {
    console.error("[activity-failed]", JSON.stringify(failed));
    return false;
  }
  console.warn(`recordActivity: the batch failed (${error.message}) but every row saved on its own`);
  return true;
}
