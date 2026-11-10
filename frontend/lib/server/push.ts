import { setVapidDetails, sendNotification } from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toNotification, notificationHref } from "@/lib/server/notifications";
import type { ActivityType } from "@/lib/types";

/** Only events where someone was paid or needs to act. Self-actions stay in the in-app feed. */
export const PUSH_TYPES: ReadonlySet<ActivityType> = new Set<ActivityType>([
  "payment_received",
  "request_received",
  "split_created",
  "goal_withdrawal_requested",
  "offramp_completed",
  "offramp_failed",
]);

type PushableActivity = {
  user_id: string;
  type: ActivityType;
  reference_id?: string | null;
  actor_id?: string | null;
  amount_usdc?: number | null;
  note?: string | null;
};

let configured: boolean | null = null;
function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? process.env.NEXT_PUBLIC_APP_URL ?? "mailto:support@coven.app";
  if (!pub || !priv) return (configured = false);
  setVapidDetails(subject.startsWith("http") || subject.startsWith("mailto:") ? subject : `mailto:${subject}`, pub, priv);
  return (configured = true);
}

/**
 * Sends a web push for each activity item of a pushable type. Never throws: the activity is already
 * saved, and a failed push must not fail the payment. Dead subscriptions (404/410) are removed.
 */
export async function pushActivity(items: PushableActivity[]): Promise<void> {
  try {
    const targets = items.filter((i) => PUSH_TYPES.has(i.type));
    if (targets.length === 0 || !configure()) return;
    const admin = getSupabaseAdmin();

    const actorIds = [...new Set(targets.map((t) => t.actor_id).filter(Boolean))] as string[];
    const usernames = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data } = await admin.from("users").select("id, username").in("id", actorIds);
      for (const u of data ?? []) usernames.set(u.id, u.username);
    }

    const userIds = [...new Set(targets.map((t) => t.user_id))];
    const { data: subs } = await admin.from("push_subscriptions").select("*").in("user_id", userIds);
    if (!subs || subs.length === 0) return;

    await Promise.allSettled(
      targets.flatMap((item) => {
        const actor = item.actor_id ? usernames.get(item.actor_id) : undefined;
        const row = {
          id: "",
          user_id: item.user_id,
          type: item.type,
          reference_id: item.reference_id ?? null,
          actor_id: item.actor_id ?? null,
          amount_usdc: item.amount_usdc ?? null,
          note: item.note ?? null,
          read: false,
          created_at: new Date().toISOString(),
          actor: actor ? { username: actor } : null,
        };
        const { title, body } = toNotification(row);
        const payload = JSON.stringify({ title, body, href: notificationHref(row) ?? "/notifications", tag: item.type });
        return subs
          .filter((s) => s.user_id === item.user_id)
          .map(async (s) => {
            try {
              await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
            } catch (err) {
              const status = (err as { statusCode?: number }).statusCode;
              if (status === 404 || status === 410) {
                await admin.from("push_subscriptions").delete().eq("id", s.id);
              } else {
                console.warn("[push-failed]", status, (err as Error).message);
              }
            }
          });
      })
    );
  } catch (err) {
    console.warn("[push-failed]", (err as Error).message);
  }
}
