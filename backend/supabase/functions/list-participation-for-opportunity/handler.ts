import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface ListParticipationForOpportunityInput {
  organizationId: string;
  opportunityId: string;
}

export interface ApplicantRow {
  applicationId: string;
  volunteerId: string;
  volunteerName: string;
  status: string;
  appliedAt: string;
}

export interface ParticipantRow {
  participationId: string;
  volunteerId: string;
  volunteerName: string;
  status: string;
}

export async function listParticipationForOpportunity(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListParticipationForOpportunityInput,
): Promise<{ applicants: ApplicantRow[]; participants: ParticipantRow[] }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "participation:read")) {
    throw new Error("forbidden");
  }

  const { data: applicationRows, error: applicationsError } = await supabase
    .from("applications")
    .select("id, status, applied_at, volunteer_id, volunteers(full_name)")
    .eq("organization_id", input.organizationId)
    .eq("opportunity_id", input.opportunityId);
  if (applicationsError) throw applicationsError;

  const { data: participationRows, error: participationError } = await supabase
    .from("participation")
    .select("id, status, volunteer_id, volunteers(full_name)")
    .eq("organization_id", input.organizationId)
    .eq("opportunity_id", input.opportunityId);
  if (participationError) throw participationError;

  return {
    applicants: (applicationRows ?? []).map((r) => ({
      applicationId: r.id as string,
      volunteerId: r.volunteer_id as string,
      volunteerName: (r.volunteers as unknown as { full_name: string })?.full_name ?? "",
      status: r.status as string,
      appliedAt: r.applied_at as string,
    })),
    participants: (participationRows ?? []).map((r) => ({
      participationId: r.id as string,
      volunteerId: r.volunteer_id as string,
      volunteerName: (r.volunteers as unknown as { full_name: string })?.full_name ?? "",
      status: r.status as string,
    })),
  };
}
