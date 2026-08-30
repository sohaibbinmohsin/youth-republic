import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface GetKpiSummaryInput {
  organizationId: string;
}

export interface KpiSummary {
  totalRegistered: number;
  active: number;
  completedParticipations: number;
  applicationsReceived: number;
  selected: number;
  totalVerifiedHours: number;
  byCity: Record<string, number>;
  byProvince: Record<string, number>;
  byInstitution: Record<string, number>;
  participationByOpportunity: Record<string, number>;
  participationByActivityType: Record<string, number>;
}

function countBy<T>(items: T[], keyOf: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function getKpiSummary(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: GetKpiSummaryInput,
): Promise<KpiSummary> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "volunteers:read")) {
    throw new Error("forbidden");
  }

  const { data: indexRows, error: indexError } = await supabase
    .from("org_volunteer_index")
    .select("volunteer_id")
    .eq("organization_id", input.organizationId);
  if (indexError) throw indexError;
  const volunteerIds = (indexRows ?? []).map((r) => r.volunteer_id as string);

  const { data: volunteerRows, error: volunteerError } = volunteerIds.length === 0
    ? { data: [] as { city: string; province: string; institution: string; status: string }[], error: null }
    : await supabase.from("volunteers").select("city, province, institution, status").in("id", volunteerIds);
  if (volunteerError) throw volunteerError;

  const { data: applicationRows, error: applicationError } = await supabase
    .from("applications")
    .select("status")
    .eq("organization_id", input.organizationId);
  if (applicationError) throw applicationError;

  const { data: participationRows, error: participationError } = await supabase
    .from("participation")
    .select("status, opportunities(name, type)")
    .eq("organization_id", input.organizationId);
  if (participationError) throw participationError;

  const { data: hoursRows, error: hoursError } = await supabase
    .from("activity_hours")
    .select("hours_verified")
    .eq("organization_id", input.organizationId)
    .eq("verification_status", "verified");
  if (hoursError) throw hoursError;

  const volunteers = volunteerRows ?? [];
  const applications = applicationRows ?? [];
  const participations = participationRows ?? [];

  return {
    totalRegistered: volunteers.length,
    active: volunteers.filter((v) => v.status === "active").length,
    completedParticipations: participations.filter((p) => p.status === "completed").length,
    applicationsReceived: applications.length,
    selected: applications.filter((a) => a.status === "selected").length,
    totalVerifiedHours: (hoursRows ?? []).reduce((sum, r) => sum + (r.hours_verified as number ?? 0), 0),
    byCity: countBy(volunteers, (v) => v.city),
    byProvince: countBy(volunteers, (v) => v.province),
    byInstitution: countBy(volunteers, (v) => v.institution),
    participationByOpportunity: countBy(
      participations,
      (p) => (p.opportunities as unknown as { name: string })?.name ?? "unknown",
    ),
    participationByActivityType: countBy(
      participations,
      (p) => (p.opportunities as unknown as { type: string })?.type ?? "unknown",
    ),
  };
}
