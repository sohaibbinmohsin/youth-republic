import { SupabaseClient } from "@supabase/supabase-js";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface LookupYouthRepublicMemberInput {
  organizationId: string;
  youthRepublicId: string;
}

export interface YouthRepublicMemberResult {
  volunteerCode: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
}

export async function lookupYouthRepublicMember(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: LookupYouthRepublicMemberInput,
): Promise<YouthRepublicMemberResult> {
  if (!input.organizationId || !input.youthRepublicId?.trim()) {
    throw new Error("volunteer_not_found");
  }

  // Caller permission: must have access to the organization (or platform owner)
  if (!staffClaims.platformOwner && staffClaims.moduleAccess.length > 0) {
    const hasOrgAccess =
      staffClaims.moduleAccess.some((m) => m.organizationId === input.organizationId) ||
      staffClaims.orgRoles.some((r) => r.organizationId === input.organizationId);
    if (!hasOrgAccess) {
      throw new Error("forbidden");
    }
  }

  const queryCode = input.youthRepublicId.trim();

  // Query Youth Republic volunteers table case-insensitively
  const { data: volunteer, error } = await supabase
    .from("volunteers")
    .select("volunteer_code, full_name, email, profile_picture_url")
    .ilike("volunteer_code", queryCode)
    .maybeSingle();

  if (error || !volunteer) {
    throw new Error("volunteer_not_found");
  }

  return {
    volunteerCode: volunteer.volunteer_code,
    fullName: volunteer.full_name,
    email: volunteer.email ?? null,
    avatarUrl: volunteer.profile_picture_url ?? null,
  };
}
