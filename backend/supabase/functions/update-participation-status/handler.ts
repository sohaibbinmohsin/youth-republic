import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";
import { opportunityChapterId } from "../_shared/opportunityChapter.ts";

export interface UpdateParticipationStatusInput {
  participationId: string;
  status: "participating" | "completed" | "no_show" | "withdrawn";
}

export async function updateParticipationStatus(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: UpdateParticipationStatusInput,
): Promise<{ participationId: string }> {
  const { data: participation, error: fetchError } = await supabase
    .from("participation")
    .select("id, organization_id, opportunity_id")
    .eq("id", input.participationId)
    .single();
  if (fetchError) throw fetchError;

  const targetChapter = await opportunityChapterId(supabase, participation.opportunity_id);
  if (!staffHasPermission(staffClaims, participation.organization_id, "youth-republic", "participation:update", targetChapter)) {
    throw new Error("forbidden");
  }

  const { error: updateError } = await supabase
    .from("participation")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.participationId);
  if (updateError) throw updateError;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "participation_status_updated",
    target_type: "participation",
    target_id: input.participationId,
    organization_id: participation.organization_id,
    metadata: { status: input.status },
  });

  return { participationId: input.participationId };
}
