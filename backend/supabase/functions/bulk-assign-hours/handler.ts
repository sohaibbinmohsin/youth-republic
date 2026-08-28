import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface BulkAssignHoursInput {
  organizationId: string;
  opportunityId: string;
  activityDate: string;
  hoursSubmitted: number;
  participationIds: string[];
}

export interface BulkAssignHoursResult {
  createdCount: number;
}

export async function bulkAssignHours(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: BulkAssignHoursInput,
): Promise<BulkAssignHoursResult> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "hours:write")) {
    throw new Error("forbidden");
  }

  const { data: participations, error: fetchError } = await supabase
    .from("participation")
    .select("id, volunteer_id")
    .in("id", input.participationIds);
  if (fetchError) throw fetchError;

  const rows = (participations ?? []).map((p) => ({
    participation_id: p.id,
    volunteer_id: p.volunteer_id,
    opportunity_id: input.opportunityId,
    organization_id: input.organizationId,
    activity_date: input.activityDate,
    hours_submitted: input.hoursSubmitted,
  }));

  const { error: insertError } = await supabase.from("activity_hours").insert(rows);
  if (insertError) throw insertError;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "bulk_hours_assigned",
    target_type: "opportunity",
    target_id: input.opportunityId,
    organization_id: input.organizationId,
    metadata: { participation_count: rows.length },
  });

  return { createdCount: rows.length };
}
