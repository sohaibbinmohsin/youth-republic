import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import { OpportunityCard } from "@/components/OpportunityCard";

export const revalidate = 60;

export default async function OpportunitiesPage() {
  const supabase = await getServerSupabaseClient();
  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id, name, type, location, organization_id")
    .is("deactivated_at", null)
    .order("created_at", { ascending: false });

  const organizationIds = [...new Set((opportunities ?? []).map((o) => o.organization_id))];
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", organizationIds);
  const organizationNameById = new Map((organizations ?? []).map((o) => [o.id, o.name]));

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Opportunities</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {(opportunities ?? []).map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={{
              ...opportunity,
              organizationName: organizationNameById.get(opportunity.organization_id) ?? "Unknown organization",
            }}
          />
        ))}
      </div>
    </div>
  );
}
