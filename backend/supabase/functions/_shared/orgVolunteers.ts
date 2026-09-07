import { SupabaseClient } from "@supabase/supabase-js";

// The set of volunteers an organization can see in its directory / exports.
//
// Historically this was *only* org_volunteer_index, a table touched by
// apply-to-opportunity and decide-application. But rows seeded directly (demo
// data, imports) never touch that RPC, so applicants were invisible to the
// partner even though their applications showed in the queue. The directory
// should mirror "anyone who has engaged with us": an index row, a non-draft
// application, or a participation record — deduped.
export async function resolveOrgVolunteerIds(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string[]> {
  const [indexRes, appRes, partRes] = await Promise.all([
    supabase
      .from("org_volunteer_index")
      .select("volunteer_id")
      .eq("organization_id", organizationId),
    supabase
      .from("applications")
      .select("volunteer_id")
      .eq("organization_id", organizationId)
      .neq("status", "draft")
      .not("volunteer_id", "is", null),
    supabase
      .from("participation")
      .select("volunteer_id")
      .eq("organization_id", organizationId)
      .not("volunteer_id", "is", null),
  ]);
  if (indexRes.error) throw indexRes.error;
  if (appRes.error) throw appRes.error;
  if (partRes.error) throw partRes.error;

  const ids = new Set<string>();
  for (const r of indexRes.data ?? []) if (r.volunteer_id) ids.add(r.volunteer_id as string);
  for (const r of appRes.data ?? []) if (r.volunteer_id) ids.add(r.volunteer_id as string);
  for (const r of partRes.data ?? []) if (r.volunteer_id) ids.add(r.volunteer_id as string);
  return [...ids];
}
