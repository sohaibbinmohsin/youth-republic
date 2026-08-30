import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface CreateOpportunityInput {
  organizationId: string;
  name: string;
  type: string;
  description?: string;
  location?: string;
  isOnline?: boolean;
  applicationOpenAt?: string;
  applicationDeadline?: string;
  activityStartAt?: string;
  activityEndAt?: string;
  eligibilityCriteria?: string;
  capacity?: number;
}

export async function createOpportunity(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: CreateOpportunityInput,
): Promise<{ opportunityId: string }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "youth-republic", "opportunities:write")) {
    throw new Error("forbidden");
  }

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      organization_id: input.organizationId,
      name: input.name,
      type: input.type,
      description: input.description ?? null,
      location: input.location ?? null,
      is_online: input.isOnline ?? false,
      application_open_at: input.applicationOpenAt ?? null,
      application_deadline: input.applicationDeadline ?? null,
      activity_start_at: input.activityStartAt ?? null,
      activity_end_at: input.activityEndAt ?? null,
      eligibility_criteria: input.eligibilityCriteria ?? null,
      capacity: input.capacity ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "opportunity_created",
    target_type: "opportunity",
    target_id: data.id,
    organization_id: input.organizationId,
  });

  return { opportunityId: data.id };
}
