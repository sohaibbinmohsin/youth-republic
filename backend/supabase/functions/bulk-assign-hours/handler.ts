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
  if (!staffHasPermission(staffClaims, input.organizationId, "youth-republic", "hours:write")) {
    throw new Error("forbidden");
  }

  // The opportunity the hours are stamped with must actually belong to the
  // authorized org — otherwise staff at org A could write hours against an
  // opportunity in a third org. The service-role client bypasses RLS, so this
  // cross-reference check has to happen here.
  const { data: opportunity, error: opportunityError } = await supabase
    .from("opportunities")
    .select("id, organization_id")
    .eq("id", input.opportunityId)
    .single();
  if (opportunityError) throw opportunityError;
  if (opportunity.organization_id !== input.organizationId) {
    throw new Error("forbidden");
  }

  // Scope the participation fetch to the authorized org: ids belonging to
  // another org simply do not come back, so they are never written.
  const { data: participations, error: fetchError } = await supabase
    .from("participation")
    .select("id, volunteer_id")
    .in("id", input.participationIds)
    .eq("organization_id", input.organizationId);
  if (fetchError) throw fetchError;

  const rows = (participations ?? []).map((p) => ({
    participation_id: p.id,
    volunteer_id: p.volunteer_id,
    opportunity_id: input.opportunityId,
    organization_id: input.organizationId,
    activity_date: input.activityDate,
    hours_submitted: input.hoursSubmitted,
  }));

  const { data: created, error: insertError } = await supabase
    .from("activity_hours")
    .insert(rows)
    .select("id");
  if (insertError) throw insertError;

  // One audit row per created activity_hours row, keyed to that row — the
  // T23 brief only specifies verify-hours' branch actions, so bulk assignment
  // keeps its own action name but now logs per affected row for parity.
  const logRows = (created ?? []).map((r) => ({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "bulk_hours_assigned",
    target_type: "activity_hours",
    target_id: r.id,
    organization_id: input.organizationId,
    metadata: { activity_date: input.activityDate, hours_submitted: input.hoursSubmitted },
  }));
  if (logRows.length > 0) {
    await supabase.from("admin_action_log").insert(logRows);
  }

  return { createdCount: rows.length };
}
