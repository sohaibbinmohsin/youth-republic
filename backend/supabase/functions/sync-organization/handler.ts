import { SupabaseClient } from "@supabase/supabase-js";

export interface SyncOrganizationInput {
  organizationId: string;
  name: string;
  slug: string;
  deactivatedAt?: string | null;
}

export async function syncOrganization(supabase: SupabaseClient, input: SyncOrganizationInput) {
  const { error } = await supabase.from("organizations").upsert({
    id: input.organizationId,
    name: input.name,
    slug: input.slug,
    deactivated_at: input.deactivatedAt ?? null,
    synced_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { organizationId: input.organizationId };
}
