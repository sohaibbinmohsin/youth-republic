import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";
import type { EmailClient } from "../_shared/sendEmail.ts";

export interface DecideApplicationInput {
  applicationId: string;
  decision: "selected" | "waitlisted" | "rejected" | "under_review";
}

export interface DecideApplicationResult {
  applicationId: string;
  participationId: string | null;
}

export async function decideApplication(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: DecideApplicationInput,
  emailClient: EmailClient,
): Promise<DecideApplicationResult> {
  const { data: application, error: fetchError } = await supabase
    .from("applications")
    .select("id, volunteer_id, opportunity_id, organization_id")
    .eq("id", input.applicationId)
    .single();
  if (fetchError) throw fetchError;

  if (!staffHasPermission(staffClaims, application.organization_id, "vms", "applications:update")) {
    throw new Error("forbidden");
  }

  if (input.decision === "selected") {
    const { data: volunteer, error: volunteerError } = await supabase
      .from("volunteers")
      .select("emergency_contact")
      .eq("id", application.volunteer_id)
      .single();
    if (volunteerError) throw volunteerError;
    if (!volunteer.emergency_contact) {
      throw new Error("emergency_contact_required");
    }
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: input.decision, decided_at: new Date().toISOString(), decided_by: staffClaims.staffId })
    .eq("id", input.applicationId);
  if (updateError) throw updateError;

  let participationId: string | null = null;

  if (input.decision === "selected") {
    const { data: existingParticipation, error: existingError } = await supabase
      .from("participation")
      .select("id")
      .eq("application_id", application.id)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingParticipation) {
      // Idempotent: re-deciding an already-selected application (double-click,
      // client retry) must not create a second participation row for it — the
      // migration's partial unique index on participation.application_id
      // (Task 6) backstops this at the DB level too.
      participationId = existingParticipation.id;
    } else {
      const { data: participation, error: participationError } = await supabase
        .from("participation")
        .insert({
          application_id: application.id,
          volunteer_id: application.volunteer_id,
          opportunity_id: application.opportunity_id,
          organization_id: application.organization_id,
        })
        .select("id")
        .single();
      if (participationError) throw participationError;
      participationId = participation.id;
    }

    await supabase.rpc("touch_org_volunteer_index", {
      p_org_id: application.organization_id,
      p_volunteer_id: application.volunteer_id,
    });
  }

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "application_decided",
    target_type: "application",
    target_id: input.applicationId,
    organization_id: application.organization_id,
    metadata: { decision: input.decision },
  });

  const { data: volunteer } = await supabase
    .from("volunteers")
    .select("email, full_name")
    .eq("id", application.volunteer_id)
    .single();

  if (volunteer) {
    const subject = "Your application status has been updated";
    const html = `<p>Hi ${volunteer.full_name},</p><p>Your application status is now: <strong>${input.decision}</strong>.</p>`;
    await emailClient.send(volunteer.email, subject, html);
  }

  return { applicationId: input.applicationId, participationId };
}
