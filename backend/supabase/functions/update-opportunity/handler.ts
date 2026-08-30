import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";
import { validateFormDefinition } from "../_shared/forms.ts";

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
  about?: string;
  duties?: string[];
  eligibility?: string[];
  whatToBring?: string[];
  applicationForm?: unknown;
  capacity?: number;
  statusOverride?: string;
  deactivatedAt?: string | null;
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

  // Every field except deactivatedAt stays gated on opportunities:update.
  // deactivatedAt (soft-delete/reactivate) gets its own, stricter permission
  // — opportunities:delete — since deactivating an opportunity conceptually
  // belongs with "delete," not a plain field edit, and the permission
  // catalog already provisions opportunities:delete for exactly this class
  // of action (it's what the now-removed opportunities_staff_delete RLS
  // policy was gated on).
  const touchesOtherFields = input.name !== undefined
    || input.description !== undefined
    || input.location !== undefined
    || input.isOnline !== undefined
    || input.applicationOpenAt !== undefined
    || input.applicationDeadline !== undefined
    || input.activityStartAt !== undefined
    || input.activityEndAt !== undefined
    || input.about !== undefined
    || input.duties !== undefined
    || input.eligibility !== undefined
    || input.whatToBring !== undefined
    || input.applicationForm !== undefined
    || input.capacity !== undefined
    || input.statusOverride !== undefined;

  if (touchesOtherFields && !staffHasPermission(staffClaims, opportunity.organization_id, "youth-republic", "opportunities:update")) {
    throw new Error("forbidden");
  }

  if (input.deactivatedAt !== undefined && !staffHasPermission(staffClaims, opportunity.organization_id, "youth-republic", "opportunities:delete")) {
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
  if (input.about !== undefined) patch.about = input.about;
  if (input.duties !== undefined) patch.duties = input.duties;
  if (input.eligibility !== undefined) patch.eligibility = input.eligibility;
  if (input.whatToBring !== undefined) patch.what_to_bring = input.whatToBring;
  if (input.applicationForm !== undefined) {
    const v = validateFormDefinition(input.applicationForm);
    if (!v.ok) throw new Error("invalid_form");
    patch.application_form = v.def;
  }
  if (input.capacity !== undefined) patch.capacity = input.capacity;
  if (input.statusOverride !== undefined) patch.status_override = input.statusOverride;
  if (input.deactivatedAt !== undefined) patch.deactivated_at = input.deactivatedAt;

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
