import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

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
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "applications:read")) {
    throw new Error("forbidden");
  }

  const limit = Math.min(input.limit ?? 25, 100);
  const offset = input.offset ?? 0;

  let query = supabase
    .from("applications")
    .select("id, status, applied_at, volunteer_id, opportunity_id, volunteers(full_name), opportunities(name)", { count: "exact" })
    .eq("organization_id", input.organizationId);
  if (input.opportunityId) query = query.eq("opportunity_id", input.opportunityId);
  if (input.status) query = query.eq("status", input.status);

  const { data, error, count } = await query.order("applied_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;

  return {
    applications: (data ?? []).map((r) => ({
      id: r.id as string,
      volunteerId: r.volunteer_id as string,
      volunteerName: (r.volunteers as unknown as { full_name: string })?.full_name ?? "",
      opportunityId: r.opportunity_id as string,
      opportunityName: (r.opportunities as unknown as { name: string })?.name ?? "",
      status: r.status as string,
      appliedAt: r.applied_at as string,
    })),
    total: count ?? 0,
  };
}
