import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";
import { readScopeChapterIds } from "../_shared/opportunityChapter.ts";

export interface ListApplicationsInput {
  organizationId: string;
  opportunityId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ApplicationListRow {
  id: string;
  volunteerId: string;
  volunteerName: string;
  opportunityId: string;
  opportunityName: string;
  status: string;
  appliedAt: string;
  applicantName: string | null;
  applicantEmail: string | null;
  applicantPhone: string | null;
  answers: Record<string, unknown>;
  formSnapshot: unknown;
  attachmentIdsByField: Record<string, string[]>;
}

// The dynamic application form stores file uploads as attachment ids inside
// `answers`, keyed by field id. Walk the form snapshot for `file`-typed fields
// and normalize each field's answer (a single id or an array) to string[].
function attachmentIdsByField(formSnapshot: unknown, answers: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const fields = (formSnapshot as { fields?: unknown } | null)?.fields;
  const ans = (answers && typeof answers === "object" ? answers : {}) as Record<string, unknown>;
  if (!Array.isArray(fields)) return out;
  for (const f of fields) {
    const field = f as { id?: unknown; type?: unknown };
    if (field?.type !== "file" || typeof field.id !== "string") continue;
    const raw = ans[field.id];
    out[field.id] = Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string")
      : typeof raw === "string" && raw !== ""
      ? [raw]
      : [];
  }
  return out;
}

export interface ListApplicationsResult {
  applications: ApplicationListRow[];
  total: number;
}

export async function listApplications(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListApplicationsInput,
): Promise<ListApplicationsResult> {
  if (!staffHasPermission(staffClaims, input.organizationId, "youth-republic", "applications:read")) {
    throw new Error("forbidden");
  }

  const limit = Math.min(input.limit ?? 25, 100);
  const offset = input.offset ?? 0;

  let query = supabase
    .from("applications")
    .select(
      "id, status, applied_at, volunteer_id, opportunity_id, applicant_name, applicant_email, applicant_phone, answers, form_snapshot, volunteers(full_name), opportunities(name)",
      { count: "exact" },
    )
    .eq("organization_id", input.organizationId)
    // Drafts are the volunteer's own unsubmitted work-in-progress — never
    // shown to the partner. RLS enforces this for user-scoped clients; this
    // handler runs on the service-role client, so it must filter explicitly.
    .neq("status", "draft");

  const chapterIds = readScopeChapterIds(staffClaims, input.organizationId, "applications:read");
  if (chapterIds) {
    const { data: opps } = await supabase.from("opportunities").select("id")
      .eq("organization_id", input.organizationId).in("chapter_id", chapterIds);
    query = query.in("opportunity_id", (opps ?? []).map((o) => o.id as string));
  }

  if (input.opportunityId) query = query.eq("opportunity_id", input.opportunityId);
  if (input.status) query = query.eq("status", input.status);

  const { data, error, count } = await query.order("applied_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;

  return {
    applications: (data ?? []).map((r) => {
      const answers = (r.answers && typeof r.answers === "object" ? r.answers : {}) as Record<string, unknown>;
      return {
        id: r.id as string,
        volunteerId: r.volunteer_id as string,
        volunteerName: (r.volunteers as unknown as { full_name: string })?.full_name ?? "",
        opportunityId: r.opportunity_id as string,
        opportunityName: (r.opportunities as unknown as { name: string })?.name ?? "",
        status: r.status as string,
        appliedAt: r.applied_at as string,
        applicantName: (r.applicant_name as string | null) ?? null,
        applicantEmail: (r.applicant_email as string | null) ?? null,
        applicantPhone: (r.applicant_phone as string | null) ?? null,
        answers,
        formSnapshot: r.form_snapshot ?? null,
        attachmentIdsByField: attachmentIdsByField(r.form_snapshot, answers),
      };
    }),
    total: count ?? 0,
  };
}
