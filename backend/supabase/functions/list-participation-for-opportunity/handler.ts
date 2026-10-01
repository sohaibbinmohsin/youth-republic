import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface ListParticipationForOpportunityInput {
  organizationId: string;
  opportunityId: string;
}

export interface ApplicantRow {
  applicationId: string;
  volunteerId: string;
  volunteerCode?: string | null;
  volunteerName: string;
  status: string;
  appliedAt: string;
}

export interface ParticipantRow {
  participationId: string;
  volunteerId: string;
  volunteerCode?: string | null;
  volunteerName: string;
  status: string;
}

export async function listParticipationForOpportunity(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListParticipationForOpportunityInput,
): Promise<{ applicants: ApplicantRow[]; participants: ParticipantRow[] }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "youth-republic", "participation:read")) {
    throw new Error("forbidden");
  }

  const { data: applicationRows, error: applicationsError } = await supabase
    .from("applications")
    .select("id, status, applied_at, volunteer_id, volunteers(full_name, volunteer_code)")
    .eq("organization_id", input.organizationId)
    .eq("opportunity_id", input.opportunityId);
  if (applicationsError) throw applicationsError;

  const { data: participationRows, error: participationError } = await supabase
    .from("participation")
    .select("id, status, volunteer_id, volunteers(full_name, volunteer_code)")
    .eq("organization_id", input.organizationId)
    .eq("opportunity_id", input.opportunityId);
  if (participationError) throw participationError;

  return {
    applicants: (applicationRows ?? []).map((r) => {
      const vol = r.volunteers as unknown as { full_name?: string; volunteer_code?: string } | null;
      return {
        applicationId: r.id as string,
        volunteerId: r.volunteer_id as string,
        volunteerCode: vol?.volunteer_code ?? null,
        volunteerName: vol?.full_name ?? "",
        status: r.status as string,
        appliedAt: r.applied_at as string,
      };
    }),
    participants: (participationRows ?? []).map((r) => {
      const vol = r.volunteers as unknown as { full_name?: string; volunteer_code?: string } | null;
      return {
        participationId: r.id as string,
        volunteerId: r.volunteer_id as string,
        volunteerCode: vol?.volunteer_code ?? null,
        volunteerName: vol?.full_name ?? "",
        status: r.status as string,
      };
    }),
  };
}
