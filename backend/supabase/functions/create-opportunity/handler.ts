import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";
import { validateFormDefinition } from "../_shared/forms.ts";

export interface CreateOpportunityInput {
  organizationId: string;
  name: string;
  type: string;
  description?: string;
  location?: string;
  city?: string | null;
  venue?: string | null;
  isOnline?: boolean;
  applicationOpenAt?: string;
  applicationDeadline?: string;
  activityStartAt?: string;
  activityEndAt?: string | null;
  about?: string;
  duties?: string[];
  eligibility?: string[];
  whatToBring?: string[];
  applicationForm?: unknown;
  capacity?: number | null;
  chapterId?: string | null;
  /** e.g. "draft" to create the opportunity hidden from the noticeboard. */
  statusOverride?: string;
}

export async function createOpportunity(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: CreateOpportunityInput,
): Promise<{ opportunityId: string }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "youth-republic", "opportunities:write", input.chapterId ?? null)) {
    throw new Error("forbidden");
  }

  const isOnline = Boolean(input.isOnline);
  const city = isOnline ? null : (input.city?.trim() || (input.location?.trim() ?? null));
  const venue = isOnline ? null : (input.venue?.trim() ?? null);
  const location = isOnline
    ? null
    : (city ? (venue ? `${city} · ${venue}` : city) : (input.location?.trim() ?? null));

  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    name: input.name,
    chapter_id: input.chapterId ?? null,
    type: input.type,
    description: input.description ?? null,
    location,
    city,
    venue,
    is_online: isOnline,
    application_open_at: input.applicationOpenAt ?? null,
    application_deadline: input.applicationDeadline ?? null,
    activity_start_at: input.activityStartAt ?? null,
    activity_end_at: input.activityEndAt ?? null,
    about: input.about ?? null,
    duties: input.duties ?? [],
    eligibility: input.eligibility ?? [],
    what_to_bring: input.whatToBring ?? [],
    capacity: input.capacity ?? null,
    ...(input.statusOverride ? { status_override: input.statusOverride } : {}),
  };

  // Omit application_form entirely when the caller doesn't send one so the
  // column default ({"version":1,"fields":[]}) applies.
  if (input.applicationForm !== undefined) {
    const v = validateFormDefinition(input.applicationForm);
    if (!v.ok) throw new Error("invalid_form");
    row.application_form = v.def;
  }

  const { data, error } = await supabase
    .from("opportunities")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "opportunity_created",
    target_type: "opportunity",
    target_id: data.id,
    organization_id: input.organizationId,
  });

  return { opportunityId: data.id };
}
