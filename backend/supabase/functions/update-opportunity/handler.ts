import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface UpdateOpportunityInput {
  opportunityId: string;
  organizationId: string;
  name?: string;
  description?: string;
  location?: string;
  isOnline?: boolean;
  applicationOpenAt?: string;
  applicationDeadline?: string;
  activityStartAt?: string;
  activityEndAt?: string;
  eligibilityCriteria?: string;
  capacity?: number;
  statusOverride?: string;
}

export async function updateOpportunity(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: UpdateOpportunityInput,
): Promise<{ opportunityId: string }> {
  // Authorize against the opportunity's STORED organization_id, never the
  // client-supplied input.organizationId. This handler runs on the service-role
  // client, which bypasses RLS entirely, so RLS cannot backstop this check.
  const { data: opportunity, error: fetchError } = await supabase
    .from("opportunities")
    .select("id, organization_id")
    .eq("id", input.opportunityId)
    .single();
  if (fetchError) throw fetchError;

  if (!staffHasPermission(staffClaims, opportunity.organization_id, "vms", "opportunities:update")) {
    throw new Error("forbidden");
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.location !== undefined) patch.location = input.location;
  if (input.isOnline !== undefined) patch.is_online = input.isOnline;
  if (input.applicationOpenAt !== undefined) patch.application_open_at = input.applicationOpenAt;
  if (input.applicationDeadline !== undefined) patch.application_deadline = input.applicationDeadline;
  if (input.activityStartAt !== undefined) patch.activity_start_at = input.activityStartAt;
  if (input.activityEndAt !== undefined) patch.activity_end_at = input.activityEndAt;
  if (input.eligibilityCriteria !== undefined) patch.eligibility_criteria = input.eligibilityCriteria;
  if (input.capacity !== undefined) patch.capacity = input.capacity;
  if (input.statusOverride !== undefined) patch.status_override = input.statusOverride;

  const { error } = await supabase
    .from("opportunities")
    .update(patch)
    .eq("id", input.opportunityId)
    .eq("organization_id", opportunity.organization_id);
  if (error) throw error;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "opportunity_updated",
    target_type: "opportunity",
    target_id: input.opportunityId,
    organization_id: opportunity.organization_id,
    metadata: patch,
  });

  return { opportunityId: input.opportunityId };
}
