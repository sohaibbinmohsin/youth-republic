import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";
import { readScopeChapterIds } from "../_shared/opportunityChapter.ts";

export interface ListActivityHoursInput {
  organizationId: string;
  activityType?: string;
  participationStatus?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityListRow {
  id: string;
  volunteerName: string;
  opportunityName: string;
  activityType: string;
  role: string | null;
  activityDate: string;
  hoursSubmitted: number;
  hoursVerified: number | null;
  verificationStatus: string;
  adminNotes: string | null;
}

export interface ListActivityHoursResult {
  activity: ActivityListRow[];
  total: number;
}

export async function listActivityHours(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListActivityHoursInput,
): Promise<ListActivityHoursResult> {
  if (!staffHasPermission(staffClaims, input.organizationId, "youth-republic", "hours:read")) {
    throw new Error("forbidden");
  }

  const limit = Math.min(input.limit ?? 25, 100);
  const offset = input.offset ?? 0;

  let opportunityIdFilter: string[] | null = null;
  if (input.activityType) {
    const { data: opportunityRows, error: opportunityError } = await supabase
      .from("opportunities")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("type", input.activityType);
    if (opportunityError) throw opportunityError;
    opportunityIdFilter = (opportunityRows ?? []).map((o) => o.id as string);
    if (opportunityIdFilter.length === 0) return { activity: [], total: 0 };
  }

  const chapterIds = readScopeChapterIds(staffClaims, input.organizationId, "hours:read");
  if (chapterIds) {
    const { data: chapterOpps, error: chapterErr } = await supabase
      .from("opportunities")
      .select("id")
      .eq("organization_id", input.organizationId)
      .in("chapter_id", chapterIds);
    if (chapterErr) throw chapterErr;
    const chapterOppIds = (chapterOpps ?? []).map((o) => o.id as string);
    opportunityIdFilter = opportunityIdFilter
      ? opportunityIdFilter.filter((id) => chapterOppIds.includes(id))
      : chapterOppIds;
    if (opportunityIdFilter.length === 0) return { activity: [], total: 0 };
  }

  let participationIdFilter: string[] | null = null;
  if (input.participationStatus) {
    const { data: participationRows, error: participationError } = await supabase
      .from("participation")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("status", input.participationStatus);
    if (participationError) throw participationError;
    participationIdFilter = (participationRows ?? []).map((p) => p.id as string);
    if (participationIdFilter.length === 0) return { activity: [], total: 0 };
  }

  let query = supabase
    .from("activity_hours")
    .select(
      "id, role, activity_date, hours_submitted, hours_verified, verification_status, admin_notes, volunteers(full_name), opportunities(name, type)",
      { count: "exact" },
    )
    .eq("organization_id", input.organizationId);
  if (opportunityIdFilter) query = query.in("opportunity_id", opportunityIdFilter);
  if (participationIdFilter) query = query.in("participation_id", participationIdFilter);

  const { data, error, count } = await query.order("activity_date", { ascending: true }).range(offset, offset + limit - 1);
  if (error) throw error;

  return {
    activity: (data ?? []).map((r) => ({
      id: r.id as string,
      volunteerName: (r.volunteers as unknown as { full_name: string })?.full_name ?? "",
      opportunityName: (r.opportunities as unknown as { name: string })?.name ?? "",
      activityType: (r.opportunities as unknown as { type: string })?.type ?? "",
      role: r.role as string | null,
      activityDate: r.activity_date as string,
      hoursSubmitted: r.hours_submitted as number,
      hoursVerified: r.hours_verified as number | null,
      verificationStatus: r.verification_status as string,
      adminNotes: r.admin_notes as string | null,
    })),
    total: count ?? 0,
  };
}
