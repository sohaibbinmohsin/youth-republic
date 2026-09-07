import { cache } from "react";
import { getPublicSupabaseClient } from "@/lib/supabase/publicClient";
import { PROTOTYPE_SEED_OPPORTUNITIES, type OpportunityDetailRow } from "./opportunityData";

/**
 * Wrapped in cache() because generateMetadata and the page body both ask for
 * the same opportunity — without it that's two identical Supabase round-trips
 * per request. cache() dedupes them within a single render.
 */
export const fetchOpportunityServer = cache(async (id: string): Promise<OpportunityDetailRow | null> => {
  if (PROTOTYPE_SEED_OPPORTUNITIES[id]) {
    return PROTOTYPE_SEED_OPPORTUNITIES[id];
  }

  try {
    // Anon, cookieless — keeps callers statically renderable.
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase
      .from("opportunities")
      .select(
        "id, name, type, description, about, duties, eligibility, what_to_bring, location, is_online, application_open_at, application_deadline, activity_start_at, activity_end_at, capacity, status_override, deactivated_at, organization_id, application_form, organizations(id, name, about, logo_url, brand_color)"
      )
      .eq("id", id)
      .single();

    if (data && !error) {
      return data as unknown as OpportunityDetailRow;
    }
  } catch {
    // Continue to prototype fallback match
  }

  const matched = Object.values(PROTOTYPE_SEED_OPPORTUNITIES).find((o) => o.id === id);
  if (matched) return matched;

  return null;
});
