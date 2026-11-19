import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";
import { opportunityChapterId } from "../_shared/opportunityChapter.ts";
import type { EmailClient } from "../_shared/sendEmail.ts";
import { escapeHtml } from "../_shared/escapeHtml.ts";

export interface DecideApplicationInput {
  applicationId: string;
  // "pending_review" is the "reconsider" path — moves a decided application
  // back into the triage queue without creating participation.
  decision: "selected" | "waitlisted" | "rejected" | "pending_review";
}

export interface DecideApplicationResult {
  applicationId: string;
  participationId: string | null;
}

/** Optional scheduling hook so the HTTP entrypoint can return before email I/O. */
export interface DecideApplicationOptions {
  /**
   * When provided (EdgeRuntime.waitUntil in production), the status email is
   * scheduled via this callback and is not awaited. When omitted (unit tests),
   * the email is awaited so FakeEmailClient still observes the send.
   */
  waitUntil?: (promise: Promise<unknown>) => void;
}

const STATUS_PHRASE: Record<DecideApplicationInput["decision"], string> = {
  selected: "selected",
  waitlisted: "waitlisted",
  rejected: "not selected",
  pending_review: "back under review",
};

/**
 * Send a status email immediately, or schedule it via `waitUntil` so the HTTP
 * response can return after DB writes. Exported for unit tests of the
 * waitUntil path without a live Supabase stack.
 */
export function scheduleOrAwaitEmail(
  emailClient: EmailClient,
  to: string,
  subject: string,
  html: string,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<void> | void {
  const send = emailClient.send(to, subject, html).catch(() => {
    // Email delivery failure must not fail a request whose DB state change
    // already committed — the application status, decided_by, participation
    // row and admin_action_log entry are all written by this point, and
    // surfacing a 400 here invites duplicate-producing retries. Swallow it.
    // (A future task could log this to admin_action_log or a retry queue;
    // out of scope here.)
  });
  if (waitUntil) {
    waitUntil(send);
    return;
  }
  return send;
}

export async function decideApplication(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: DecideApplicationInput,
  emailClient: EmailClient,
  options?: DecideApplicationOptions,
): Promise<DecideApplicationResult> {
  const { data: application, error: fetchError } = await supabase
    .from("applications")
    .select("id, volunteer_id, opportunity_id, organization_id, status")
    .eq("id", input.applicationId)
    .single();
  if (fetchError) throw fetchError;

  const targetChapter = await opportunityChapterId(supabase, application.opportunity_id);
  if (!staffHasPermission(staffClaims, application.organization_id, "youth-republic", "applications:update", targetChapter)) {
    throw new Error("forbidden");
  }

  const alreadyAtDecision = application.status === input.decision;

  // Same-decision retry / double-click: do not re-log or re-email. For Select,
  // still return the existing participation id so the client gets a stable result.
  if (alreadyAtDecision) {
    let participationId: string | null = null;
    if (input.decision === "selected") {
      const { data: existingParticipation, error: existingError } = await supabase
        .from("participation")
        .select("id")
        .eq("application_id", application.id)
        .maybeSingle();
      if (existingError) throw existingError;
      participationId = existingParticipation?.id ?? null;
    }
    return { applicationId: input.applicationId, participationId };
  }

  const isReconsider = input.decision === "pending_review";
  const { error: updateError } = await supabase
    .from("applications")
    .update(
      isReconsider
        ? { status: input.decision, decided_at: null, decided_by: null }
        : { status: input.decision, decided_at: new Date().toISOString(), decided_by: staffClaims.staffId },
    )
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
    const html = `<p>Hi ${escapeHtml(volunteer.full_name)},</p><p>Your application is now: <strong>${STATUS_PHRASE[input.decision]}</strong>.</p>`;
    await scheduleOrAwaitEmail(
      emailClient,
      volunteer.email,
      subject,
      html,
      options?.waitUntil,
    );
  }

  return { applicationId: input.applicationId, participationId };
}
