import { SupabaseClient } from "@supabase/supabase-js";

export interface ApplyToOpportunityInput {
  volunteerId: string;
  opportunityId: string;
  organizationId: string;
  motivationStatement?: string;
}

export interface ApplyToOpportunityResult {
  applicationId: string;
}

export async function applyToOpportunity(
  supabase: SupabaseClient,
  input: ApplyToOpportunityInput,
): Promise<ApplyToOpportunityResult> {
  const { data: volunteer, error: volunteerError } = await supabase
    .from("volunteers")
    .select("cnic_number")
    .eq("id", input.volunteerId)
    .single();
  if (volunteerError) throw volunteerError;
  if (!volunteer.cnic_number) {
    throw new Error("cnic_required");
  }

  // Derive organization_id from the opportunity row itself, never from
  // client-supplied input: a mismatched org would corrupt every org-scoped
  // application query and mint an org_volunteer_index link (and therefore
  // staff PII read access) to an arbitrary org.
  const { data: opportunity, error: opportunityError } = await supabase
    .from("opportunities")
    .select("id, organization_id, deactivated_at")
    .eq("id", input.opportunityId)
    .single();
  if (opportunityError) throw opportunityError;
  if (opportunity.deactivated_at !== null) {
    throw new Error("opportunity_unavailable");
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({
      volunteer_id: input.volunteerId,
      opportunity_id: opportunity.id,
      organization_id: opportunity.organization_id,
      motivation_statement: input.motivationStatement ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("touch_org_volunteer_index", {
    p_org_id: opportunity.organization_id,
    p_volunteer_id: input.volunteerId,
  });

  return { applicationId: data.id };
}
