import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface VerifyHoursInput {
  activityHoursId: string;
  decision: "verified" | "rejected";
  hoursVerified?: number;
  rejectionReason?: string;
}

export interface VerifyHoursResult {
  activityHoursId: string;
}

export async function verifyHours(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: VerifyHoursInput,
): Promise<VerifyHoursResult> {
  const { data: row, error: fetchError } = await supabase
    .from("activity_hours")
    .select("id, organization_id")
    .eq("id", input.activityHoursId)
    .single();
  if (fetchError) throw fetchError;

  if (!staffHasPermission(staffClaims, row.organization_id, "vms", "hours:update")) {
    throw new Error("forbidden");
  }

  const { error: updateError } = await supabase
    .from("activity_hours")
    .update({
      verification_status: input.decision,
      hours_verified: input.decision === "verified" ? input.hoursVerified ?? null : null,
      rejection_reason: input.decision === "rejected" ? input.rejectionReason ?? null : null,
      verified_by: staffClaims.staffId,
      verified_at: new Date().toISOString(),
    })
    .eq("id", input.activityHoursId);
  if (updateError) throw updateError;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "hours_decided",
    target_type: "activity_hours",
    target_id: input.activityHoursId,
    organization_id: row.organization_id,
    metadata: { decision: input.decision },
  });

  return { activityHoursId: input.activityHoursId };
}
