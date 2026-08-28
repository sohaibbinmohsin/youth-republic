import { SupabaseClient } from "@supabase/supabase-js";

export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count } = await supabase
    .from("rate_limit_hits")
    .select("*", { count: "exact", head: true })
    .eq("rate_key", key)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= limit) {
    return false;
  }

  await supabase.from("rate_limit_hits").insert({ rate_key: key });
  return true;
}
