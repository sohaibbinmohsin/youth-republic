import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";
import type { EmailClient } from "../_shared/sendEmail.ts";
import { escapeHtml } from "../_shared/escapeHtml.ts";

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
  emailClient: EmailClient,
): Promise<VerifyHoursResult> {
  const { data: row, error: fetchError } = await supabase
    .from("activity_hours")
    .select("id, organization_id, volunteer_id")
    .eq("id", input.activityHoursId)
    .single();
  if (fetchError) throw fetchError;

  if (!staffHasPermission(staffClaims, row.organization_id, "youth-republic", "hours:update")) {
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

  const { data: volunteer } = await supabase
    .from("volunteers")
    .select("email, full_name")
    .eq("id", row.volunteer_id)
    .single();

  if (volunteer) {
    const subject = "Your volunteer hours have been reviewed";
    const html = `<p>Hi ${escapeHtml(volunteer.full_name)},</p><p>Your submitted hours were <strong>${input.decision}</strong>.</p>`;
    try {
      await emailClient.send(volunteer.email, subject, html);
    } catch {
      // Email delivery failure must not fail a request whose DB state change
      // already committed — the verification status, verified_by and the
      // admin_action_log entry are all written by this point, and surfacing a
      // 400 here invites duplicate-producing retries. Swallow it.
      // (A future task could log this to admin_action_log or a retry queue;
      // out of scope here.)
    }
  }

  return { activityHoursId: input.activityHoursId };
}
