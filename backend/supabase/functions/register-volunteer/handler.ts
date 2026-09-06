import { SupabaseClient } from "@supabase/supabase-js";

export interface RegisterVolunteerInput {
  authUserId: string;
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  city: string;
  province: string;
  country: string;
  institution: string;
  degreeProgram: string;
  idDocType?: "cnic" | "b_form" | "passport";
  idDocNumber?: string;
  idDocAttachmentId?: string;
  guardianName?: string;
  guardianContact?: string;
  guardianConsent?: boolean;
}

export interface RegisterVolunteerResult {
  volunteerId: string;
  volunteerCode: string;
}

async function flagNearDuplicatesIfAny(
  supabase: SupabaseClient,
  volunteerId: string,
  fullName: string,
  city: string,
  email: string,
) {
  const { data: matches } = await supabase
    .from("volunteers")
    .select("id, email")
    .eq("full_name", fullName)
    .eq("city", city)
    .neq("id", volunteerId);

  const realMatches = (matches ?? []).filter((m) => m.email !== email);
  if (realMatches.length > 0) {
    await supabase.from("admin_action_log").insert({
      actor_type: "system",
      action: "duplicate_flagged",
      target_type: "volunteer",
      target_id: volunteerId,
      metadata: { matched_volunteer_ids: realMatches.map((m) => m.id) },
    });
  }
}

export async function registerVolunteer(
  supabase: SupabaseClient,
  input: RegisterVolunteerInput,
): Promise<RegisterVolunteerResult> {
  const { data: minorCheck, error: minorCheckError } = await supabase
    .rpc("volunteer_is_minor", { v_dob: input.dob });
  if (minorCheckError) throw minorCheckError;

  const isMinor = minorCheck === true;

  if (isMinor) {
    const hasConsent = Boolean(input.guardianName && input.guardianContact && input.guardianConsent);
    if (!hasConsent) {
      throw new Error("minor_consent_required");
    }
    if (input.idDocType && input.idDocType !== "b_form") {
      throw new Error("b_form_required_for_minor");
    }
  }

  if (input.idDocAttachmentId) {
    const { data: attachment, error: attachmentError } = await supabase
      .from("attachments")
      .select("id, domain, owner_type, status, uploaded_by")
      .eq("id", input.idDocAttachmentId)
      .single();
    if (
      attachmentError || !attachment ||
      attachment.domain !== "identity_doc" ||
      attachment.owner_type !== "volunteer" ||
      attachment.status !== "ready" ||
      attachment.uploaded_by !== input.authUserId
    ) {
      throw new Error("id_doc_attachment_required");
    }
  }

  const { data, error } = await supabase
    .from("volunteers")
    .insert({
      auth_user_id: input.authUserId,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      dob: input.dob,
      gender: input.gender,
      city: input.city,
      province: input.province,
      country: input.country,
      institution: input.institution,
      degree_program: input.degreeProgram,
      id_doc_type: input.idDocType ?? (isMinor ? "b_form" : "cnic"),
      id_doc_number: input.idDocNumber ?? null,
      guardian_name: input.guardianName ?? null,
      guardian_contact: input.guardianContact ?? null,
      guardian_consent_at: input.guardianConsent ? new Date().toISOString() : null,
    })
    .select("id, volunteer_code")
    .single();

  if (error) throw error;

  if (input.idDocAttachmentId) {
    await supabase
      .from("attachments")
      .update({ owner_id: data.id })
      .eq("id", input.idDocAttachmentId);
  }

  await flagNearDuplicatesIfAny(supabase, data.id, input.fullName, input.city, input.email);

  return { volunteerId: data.id, volunteerCode: data.volunteer_code };
}
