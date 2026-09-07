import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";
import { resolveOrgVolunteerIds } from "../_shared/orgVolunteers.ts";

export interface ListVolunteersInput {
  organizationId: string;
  search?: string;
  city?: string;
  province?: string;
  institution?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface VolunteerSummary {
  id: string;
  volunteerCode: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  institution: string;
  status: string;
}

export interface ListVolunteersResult {
  volunteers: VolunteerSummary[];
  total: number;
}

export async function listVolunteers(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListVolunteersInput,
): Promise<ListVolunteersResult> {
  if (!staffHasPermission(staffClaims, input.organizationId, "youth-republic", "volunteers:read")) {
    throw new Error("forbidden");
  }

  const volunteerIds = await resolveOrgVolunteerIds(supabase, input.organizationId);
  if (volunteerIds.length === 0) return { volunteers: [], total: 0 };

  const limit = Math.min(input.limit ?? 25, 100);
  const offset = input.offset ?? 0;

  let query = supabase
    .from("volunteers")
    .select("id, volunteer_code, full_name, email, phone, city, province, institution, status", { count: "exact" })
    .in("id", volunteerIds);

  if (input.city) query = query.eq("city", input.city);
  if (input.province) query = query.eq("province", input.province);
  if (input.institution) query = query.eq("institution", input.institution);
  if (input.status) query = query.eq("status", input.status);
  if (input.search) {
    const term = `%${input.search}%`;
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }

  const { data, error, count } = await query.order("full_name", { ascending: true }).range(offset, offset + limit - 1);
  if (error) throw error;

  return {
    volunteers: (data ?? []).map((v) => ({
      id: v.id as string,
      volunteerCode: v.volunteer_code as string,
      fullName: v.full_name as string,
      email: v.email as string,
      phone: v.phone as string,
      city: v.city as string,
      province: v.province as string,
      institution: v.institution as string,
      status: v.status as string,
    })),
    total: count ?? 0,
  };
}
