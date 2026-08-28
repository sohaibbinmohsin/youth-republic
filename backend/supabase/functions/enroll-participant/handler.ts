import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface EnrollParticipantInput {
  organizationId: string;
  opportunityId: string;
  volunteerId: string;
}

export async function enrollParticipant(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: EnrollParticipantInput,
): Promise<{ participationId: string }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "participation:write")) {
    throw new Error("forbidden");
  }

  // The opportunity must actually belong to the authorized org. Without this,
  // a staff member with participation:write in their own org could enroll any
  // volunteer against any org's opportunity — and enrollment mints an
  // org_volunteer_index row, which grants their org full PII read access.
  const { data: opportunity, error: opportunityError } = await supabase
    .from("opportunities")
    .select("id, organization_id")
    .eq("id", input.opportunityId)
    .single();
  if (opportunityError) throw opportunityError;
  if (opportunity.organization_id !== input.organizationId) {
    throw new Error("forbidden");
  }

  const { data: participation, error } = await supabase
    .from("participation")
    .insert({
      volunteer_id: input.volunteerId,
      opportunity_id: input.opportunityId,
      organization_id: input.organizationId,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.rpc("touch_org_volunteer_index", {
    p_org_id: input.organizationId,
    p_volunteer_id: input.volunteerId,
  });

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "participant_enrolled",
    target_type: "participation",
    target_id: participation.id,
    organization_id: input.organizationId,
  });

  return { participationId: participation.id };
}
