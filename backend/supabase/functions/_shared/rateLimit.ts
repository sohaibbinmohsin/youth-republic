import { SupabaseClient } from "@supabase/supabase-js";

export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  // Delegates the count-then-insert to a single Postgres function
  // (0015_atomic_rate_limit.sql) so it runs atomically, serialized per-key
  // with an advisory lock -- doing the check and the record as two separate
  // round trips from here would reopen the exact race this closes.
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return data as boolean;
}
