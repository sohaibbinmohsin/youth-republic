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
    .select(
      "id, volunteer_id, opportunity_id, organization_id, opportunities(activity_start_at, activity_end_at, deactivated_at)",
    )
    .eq("id", input.participationId)
    .single();
  if (participationError) throw participationError;

  if (participation.volunteer_id !== input.volunteerId) {
    throw new Error("forbidden");
  }

  // Basic shape checks — the client validates too, but never trust it.
  if (!input.activityDate || Number.isNaN(Date.parse(input.activityDate))) {
    throw new Error("invalid_input");
  }
  if (typeof input.hoursSubmitted !== "number" || !(input.hoursSubmitted > 0)) {
    throw new Error("invalid_input");
  }

  // Hours can only be logged once a drive is under way, and for up to 10 days
  // after it ends. Mirrors canLogHours() in the volunteer portfolio.
  type OppWindow = {
    activity_start_at: string | null;
    activity_end_at: string | null;
    deactivated_at: string | null;
  };
  const embed = (participation as unknown as { opportunities?: OppWindow | OppWindow[] | null }).opportunities;
  const opp: OppWindow | null = Array.isArray(embed) ? embed[0] ?? null : embed ?? null;
  const now = Date.now();
  const GRACE_MS = 10 * 24 * 60 * 60 * 1000;
  if (opp?.deactivated_at) {
    throw new Error("drive_logging_closed");
  }
  if (opp?.activity_start_at && new Date(opp.activity_start_at).getTime() > now) {
    throw new Error("drive_not_started");
  }
  if (opp?.activity_end_at && now > new Date(opp.activity_end_at).getTime() + GRACE_MS) {
    throw new Error("drive_logging_closed");
  }

  // The activity date itself can't be in the future or before the drive
  // started. Compare on the date part only (the client sends "YYYY-MM-DD").
  const activityDay = input.activityDate.slice(0, 10);
  const todayDay = new Date(now).toISOString().slice(0, 10);
  if (activityDay > todayDay) {
    throw new Error("invalid_input");
  }
  if (opp?.activity_start_at && activityDay < opp.activity_start_at.slice(0, 10)) {
    throw new Error("invalid_input");
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
