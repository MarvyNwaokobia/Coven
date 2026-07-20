import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/** Client-side Supabase client (anon key, auth session in localStorage). */
export function getSupabaseBrowser(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}

/** Server-side admin client (service role — bypasses RLS). Never import in client code. */
export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * Resolve the authenticated user from a request's Authorization header.
 * Returns the users-table row, or null if unauthenticated.
 */
export async function getAuthedUser(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const { data: authData, error } = await admin.auth.getUser(token);
  if (error || !authData.user) return null;

  const { data: user } = await admin
    .from("users")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  return user;
}
