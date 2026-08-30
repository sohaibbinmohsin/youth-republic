import { SupabaseClient } from "@supabase/supabase-js";

export interface SyncOrganizationInput {
  organizationId: string;
  name: string;
  slug: string;
  deactivatedAt?: string | null;
  brandColor?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  about?: string | null;
}

export async function syncOrganization(supabase: SupabaseClient, input: SyncOrganizationInput) {
  // Branding columns are owned by the org-admin frontend, not this sync path.
  // Read the current row and coalesce-merge so a sync payload that omits a
  // branding field leaves the stored value untouched instead of nulling it.
  const { data: existing } = await supabase
    .from("organizations")
    .select("brand_color, logo_url, favicon_url, about")
    .eq("id", input.organizationId)
    .maybeSingle();

  const { error } = await supabase.from("organizations").upsert({
    id: input.organizationId,
    name: input.name,
    slug: input.slug,
    deactivated_at: input.deactivatedAt ?? null,
    brand_color: input.brandColor ?? existing?.brand_color ?? null,
    logo_url: input.logoUrl ?? existing?.logo_url ?? null,
    favicon_url: input.faviconUrl ?? existing?.favicon_url ?? null,
    about: input.about ?? existing?.about ?? null,
    synced_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { organizationId: input.organizationId };
}
