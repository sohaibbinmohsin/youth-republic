import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface GetVolunteerDetailInput {
  organizationId: string;
  volunteerId: string;
}

export interface VolunteerDetail {
  id: string;
  volunteerCode: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  institution: string;
  status: string;
  applications: Array<{ id: string; status: string; opportunityName: string; appliedAt: string }>;
  participations: Array<{ id: string; status: string; opportunityName: string }>;
  activity: Array<{
    id: string;
    role: string | null;
    activityDate: string;
    hoursSubmitted: number;
    hoursVerified: number | null;
    verificationStatus: string;
    adminNotes: string | null;
    opportunityName: string;
  }>;
}

export async function getVolunteerDetail(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: GetVolunteerDetailInput,
): Promise<VolunteerDetail> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "volunteers:read")) {
    throw new Error("forbidden");
  }

  const { data: volunteer, error: volunteerError } = await supabase
    .from("volunteers")
    .select("id, volunteer_code, full_name, email, phone, city, province, institution, status")
    .eq("id", input.volunteerId)
    .single();
  if (volunteerError) throw volunteerError;

  const { data: applicationRows, error: applicationsError } = await supabase
    .from("applications")
    .select("id, status, applied_at, opportunities(name)")
    .eq("volunteer_id", input.volunteerId)
    .eq("organization_id", input.organizationId);
  if (applicationsError) throw applicationsError;

  const { data: participationRows, error: participationError } = await supabase
    .from("participation")
    .select("id, status, opportunities(name)")
    .eq("volunteer_id", input.volunteerId)
    .eq("organization_id", input.organizationId);
  if (participationError) throw participationError;

  const { data: activityRows, error: activityError } = await supabase
    .from("activity_hours")
    .select("id, role, activity_date, hours_submitted, hours_verified, verification_status, admin_notes, opportunities(name)")
    .eq("volunteer_id", input.volunteerId)
    .eq("organization_id", input.organizationId)
    .order("activity_date", { ascending: true });
  if (activityError) throw activityError;

  return {
    id: volunteer!.id as string,
    volunteerCode: volunteer!.volunteer_code as string,
    fullName: volunteer!.full_name as string,
    email: volunteer!.email as string,
    phone: volunteer!.phone as string,
    city: volunteer!.city as string,
    province: volunteer!.province as string,
    institution: volunteer!.institution as string,
    status: volunteer!.status as string,
    applications: (applicationRows ?? []).map((r) => ({
      id: r.id as string,
      status: r.status as string,
      opportunityName: (r.opportunities as unknown as { name: string })?.name ?? "",
      appliedAt: r.applied_at as string,
    })),
    participations: (participationRows ?? []).map((r) => ({
      id: r.id as string,
      status: r.status as string,
      opportunityName: (r.opportunities as unknown as { name: string })?.name ?? "",
    })),
    activity: (activityRows ?? []).map((r) => ({
      id: r.id as string,
      role: r.role as string | null,
      activityDate: r.activity_date as string,
      hoursSubmitted: r.hours_submitted as number,
      hoursVerified: r.hours_verified as number | null,
      verificationStatus: r.verification_status as string,
      adminNotes: r.admin_notes as string | null,
      opportunityName: (r.opportunities as unknown as { name: string })?.name ?? "",
    })),
  };
}
