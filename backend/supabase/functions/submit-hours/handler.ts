import { SupabaseClient } from "@supabase/supabase-js";

export interface SubmitHoursInput {
  authUserId: string;
  participationId: string;
  volunteerId: string;
  opportunityId: string;
  organizationId: string;
  activityDate: string;
  hoursSubmitted: number;
  role?: string;
  location?: string;
  note?: string;
  attachmentIds?: string[];
}

export interface SubmitHoursResult {
  activityHoursId: string;
}

export async function submitHours(
  supabase: SupabaseClient,
  input: SubmitHoursInput,
): Promise<SubmitHoursResult> {
  // Derive ownership and the opportunity/org pair from the referenced
  // participation row, never from client-supplied input. index.ts derives
  // volunteerId/authUserId from the session token; everything else in the
  // body is untrusted, and the service-role client bypasses RLS entirely.
  const { data: participation, error: participationError } = await supabase
    .from("participation")
    .select("id, volunteer_id, opportunity_id, organization_id")
    .eq("id", input.participationId)
    .single();
  if (participationError) throw participationError;

  if (participation.volunteer_id !== input.volunteerId) {
    throw new Error("forbidden");
  }

  // Session photos: each referenced attachment must be a ready session_photo
  // this volunteer uploaded, and not already linked to another activity_hours
  // row. Ownership is checked against the session-derived authUserId.
  const attachmentIds = input.attachmentIds ?? [];
  for (const attachmentId of attachmentIds) {
    const { data: attachment, error: attachmentError } = await supabase
      .from("attachments")
      .select("id, domain, status, uploaded_by, owner_id")
      .eq("id", attachmentId)
      .single();
    if (
      attachmentError || !attachment ||
      attachment.domain !== "session_photo" ||
      attachment.status !== "ready" ||
      attachment.uploaded_by !== input.authUserId
    ) {
      throw new Error("bad_attachment");
    }
    const { data: linkedRow } = await supabase
      .from("activity_hours")
      .select("id")
      .eq("id", attachment.owner_id)
      .maybeSingle();
    if (linkedRow) {
      throw new Error("bad_attachment");
    }
  }

  const { data, error } = await supabase
    .from("activity_hours")
    .insert({
      participation_id: participation.id,
      volunteer_id: input.volunteerId,
      opportunity_id: participation.opportunity_id,
      organization_id: participation.organization_id,
      activity_date: input.activityDate,
      hours_submitted: input.hoursSubmitted,
      role: input.role ?? null,
      location: input.location ?? null,
      note: input.note ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  if (attachmentIds.length > 0) {
    await supabase
      .from("attachments")
      .update({ owner_id: data.id, organization_id: participation.organization_id })
      .in("id", attachmentIds);
  }

  return { activityHoursId: data.id };
}
