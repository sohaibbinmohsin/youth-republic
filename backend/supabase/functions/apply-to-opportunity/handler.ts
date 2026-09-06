// backend/supabase/functions/apply-to-opportunity/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { validateAnswers, resolveConsent, type FormDefinition } from "../_shared/forms.ts";
import { computeOpportunityStatus } from "../_shared/opportunityStatus.ts";

export interface ApplyToOpportunityInput {
  volunteerId: string;
  authUserId: string;
  opportunityId: string;
  answers: Record<string, unknown>;
  attachmentIds?: string[];
}
export interface ApplyToOpportunityResult { applicationId: string; }

export async function applyToOpportunity(
  supabase: SupabaseClient,
  input: ApplyToOpportunityInput,
): Promise<ApplyToOpportunityResult> {
  const { data: volunteer, error: vErr } = await supabase.from("volunteers")
    .select("id, full_name, email, phone, id_doc_number").eq("id", input.volunteerId).single();
  if (vErr || !volunteer) throw new Error("not_found");
  if (!volunteer.id_doc_number) throw new Error("id_doc_required");

  const { data: opp, error: oErr } = await supabase.from("opportunities")
    .select("id, organization_id, deactivated_at, application_form, status_override, application_open_at, application_deadline, activity_start_at, activity_end_at")
    .eq("id", input.opportunityId)
    .single();
  if (oErr || !opp) throw new Error("not_found");

  const status = computeOpportunityStatus({
    statusOverride: opp.status_override ?? null,
    applicationOpenAt: opp.application_open_at ?? null,
    applicationDeadline: opp.application_deadline ?? null,
    activityStartAt: opp.activity_start_at ?? null,
    activityEndAt: opp.activity_end_at ?? null,
    deactivatedAt: opp.deactivated_at ?? null,
  });

  const isDeadlinePassed = opp.application_deadline
    ? new Date(opp.application_deadline).getTime() < Date.now()
    : false;
  const isAcceptingApplications =
    status === "open" || (status === "in_progress" && !isDeadlinePassed);
  if (!isAcceptingApplications) throw new Error("opportunity_unavailable");

  const form = opp.application_form as FormDefinition;
  const result = validateAnswers(form, input.answers);
  if (!result.ok) {
    const e = new Error("validation") as Error & { fieldErrors: Record<string, string> };
    e.fieldErrors = result.fieldErrors;
    throw e;
  }

  // Verify referenced attachments: ready application_file rows this user uploaded,
  // not yet linked to another application.
  const attachmentIds = input.attachmentIds ?? [];
  if (attachmentIds.length > 0) {
    const { data: atts, error: aErr } = await supabase.from("attachments")
      .select("id, domain, owner_type, status, uploaded_by")
      .in("id", attachmentIds);
    if (aErr) throw aErr;
    const ok = (atts ?? []).length === attachmentIds.length &&
      (atts ?? []).every((a) =>
        a.domain === "application_file" && a.owner_type === "application" &&
        a.status === "ready" && a.uploaded_by === input.authUserId);
    if (!ok) throw new Error("bad_attachment");
  }

  // Check if an existing application or draft exists for this opportunity and volunteer/user
  const query = supabase
    .from("applications")
    .select("id, status")
    .eq("opportunity_id", opp.id)
    .or(`volunteer_id.eq.${volunteer.id},auth_user_id.eq.${input.authUserId}`);
  
  const { data: existingApp } = typeof (query as any).maybeSingle === "function"
    ? await (query as any).maybeSingle()
    : { data: null };

  let applicationId: string;
  if (existingApp) {
    if (existingApp.status !== "draft") {
      throw new Error("already_applied");
    }
    const { data: updatedApp, error: uErr } = await supabase.from("applications").update({
      volunteer_id: volunteer.id,
      auth_user_id: input.authUserId,
      status: "submitted",
      applied_at: new Date().toISOString(),
      answers: input.answers,
      form_snapshot: form,
      applicant_name: volunteer.full_name,
      applicant_email: volunteer.email,
      applicant_phone: volunteer.phone,
      consent_accepted: resolveConsent(form, input.answers),
      draft_profile: {},
    }).eq("id", existingApp.id).select("id").single();
    if (uErr) throw uErr;
    applicationId = updatedApp.id;
  } else {
    const { data: app, error: iErr } = await supabase.from("applications").insert({
      volunteer_id: volunteer.id,
      auth_user_id: input.authUserId,
      opportunity_id: opp.id,
      organization_id: opp.organization_id,
      status: "submitted",
      answers: input.answers,
      form_snapshot: form,
      applicant_name: volunteer.full_name,
      applicant_email: volunteer.email,
      applicant_phone: volunteer.phone,
      consent_accepted: resolveConsent(form, input.answers),
      draft_profile: {},
    }).select("id").single();
    if (iErr) throw iErr;
    applicationId = app.id;
  }

  if (attachmentIds.length > 0) {
    await supabase.from("attachments")
      .update({ owner_id: applicationId, organization_id: opp.organization_id })
      .in("id", attachmentIds);
  }

  await supabase.rpc("touch_org_volunteer_index", {
    p_org_id: opp.organization_id,
    p_volunteer_id: volunteer.id,
  });

  return { applicationId };
}
