import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function exportApplicationsCsv(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  organizationId: string,
): Promise<string> {
  if (!staffHasPermission(staffClaims, organizationId, "vms", "applications:read")) {
    throw new Error("forbidden");
  }

  const { data: rows, error } = await supabase
    .from("applications")
    .select("status, applied_at, volunteers(volunteer_code, full_name, email), opportunities(name)")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const header = "volunteer_code,full_name,email,opportunity_name,status,applied_at";
  const lines = (rows ?? []).map((r: Record<string, unknown>) => {
    const volunteer = r.volunteers as { volunteer_code: string; full_name: string; email: string };
    const opportunity = r.opportunities as { name: string };
    return [
      csvEscape(volunteer.volunteer_code),
      csvEscape(volunteer.full_name),
      csvEscape(volunteer.email),
      csvEscape(opportunity.name),
      csvEscape(String(r.status)),
      csvEscape(String(r.applied_at)),
    ].join(",");
  });

  return [header, ...lines].join("\n") + "\n";
}

export async function exportVolunteersCsv(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  organizationId: string,
): Promise<string> {
  if (!staffHasPermission(staffClaims, organizationId, "vms", "volunteers:read")) {
    throw new Error("forbidden");
  }

  const { data: rows, error } = await supabase
    .from("org_volunteer_index")
    .select("volunteers(volunteer_code, full_name, email, phone, city, province, institution, status)")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const header = "volunteer_code,full_name,email,phone,city,province,institution,status";
  const lines = (rows ?? []).map((r: Record<string, unknown>) => {
    const v = r.volunteers as {
      volunteer_code: string; full_name: string; email: string; phone: string;
      city: string; province: string; institution: string; status: string;
    };
    return [
      csvEscape(v.volunteer_code),
      csvEscape(v.full_name),
      csvEscape(v.email),
      csvEscape(v.phone),
      csvEscape(v.city),
      csvEscape(v.province),
      csvEscape(v.institution),
      csvEscape(v.status),
    ].join(",");
  });

  return [header, ...lines].join("\n") + "\n";
}
