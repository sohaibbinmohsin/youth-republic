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

  const { data, error } = await supabase
    .from("applications")
    .insert({
      volunteer_id: input.volunteerId,
      opportunity_id: input.opportunityId,
      organization_id: input.organizationId,
      motivation_statement: input.motivationStatement ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("touch_org_volunteer_index", {
    p_org_id: input.organizationId,
    p_volunteer_id: input.volunteerId,
  });

  return { applicationId: data.id };
}
