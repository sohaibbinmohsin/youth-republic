import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

function csvEscape(value: string): string {
  // Quoting (below) is a CSV-syntax concern -- it does not stop Excel/
  // Sheets from executing a cell whose actual content starts with =, +, -,
  // or @ as a formula when the file is opened. Prefix those with a single
  // quote first: spreadsheet apps treat a leading `'` as "force this cell
  // to be text," neutralizing the formula while leaving the value's real
  // content (and the CSV data itself) unchanged.
  const neutralized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${neutralized.replace(/"/g, '""')}"`;
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

export async function exportOpportunitiesCsv(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  organizationId: string,
): Promise<string> {
  if (!staffHasPermission(staffClaims, organizationId, "vms", "opportunities:read")) {
    throw new Error("forbidden");
  }

  const { data: rows, error } = await supabase
    .from("opportunities")
    .select("name, type, capacity")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const header = "name,type,capacity";
  const lines = (rows ?? []).map((r: Record<string, unknown>) =>
    [csvEscape(String(r.name)), csvEscape(String(r.type)), csvEscape(String(r.capacity ?? ""))].join(",")
  );

  return [header, ...lines].join("\n") + "\n";
}

export async function exportActivityHoursCsv(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  organizationId: string,
): Promise<string> {
  if (!staffHasPermission(staffClaims, organizationId, "vms", "hours:read")) {
    throw new Error("forbidden");
  }

  const { data: rows, error } = await supabase
    .from("activity_hours")
    .select("activity_date, hours_submitted, hours_verified, verification_status, volunteers(full_name), opportunities(name)")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const header = "volunteer_name,opportunity_name,activity_date,hours_submitted,hours_verified,verification_status";
  const lines = (rows ?? []).map((r: Record<string, unknown>) => {
    const volunteer = r.volunteers as { full_name: string };
    const opportunity = r.opportunities as { name: string };
    return [
      csvEscape(volunteer.full_name),
      csvEscape(opportunity.name),
      csvEscape(String(r.activity_date)),
      csvEscape(String(r.hours_submitted)),
      csvEscape(String(r.hours_verified ?? "")),
      csvEscape(String(r.verification_status)),
    ].join(",");
  });

  return [header, ...lines].join("\n") + "\n";
}
