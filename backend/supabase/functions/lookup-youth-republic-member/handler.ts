import { SupabaseClient } from "@supabase/supabase-js";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface LookupYouthRepublicMemberInput {
  organizationId: string;
  youthRepublicId?: string;
  query?: string;
  limit?: number;
}

export interface YouthRepublicMemberResult {
  volunteerCode: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface YouthRepublicMemberSearchResult {
  members: YouthRepublicMemberResult[];
}

export async function lookupYouthRepublicMember(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: LookupYouthRepublicMemberInput,
): Promise<YouthRepublicMemberResult | YouthRepublicMemberSearchResult> {
  if (!input.organizationId) {
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

  if (input.query !== undefined) {
    const q = input.query.trim().replace(/[%,\\]/g, "");
    if (!q) {
      return { members: [] };
    }
    const limit = Math.min(Math.max(Number(input.limit) || 8, 1), 20);
    const { data, error } = await supabase
      .from("volunteers")
      .select("volunteer_code, full_name, email, profile_picture_url, status")
      .eq("status", "active")
      .or(`volunteer_code.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(limit);

    if (error) {
      throw error;
    }

    const members: YouthRepublicMemberResult[] = (data || []).map((row) => ({
      volunteerCode: row.volunteer_code,
      fullName: row.full_name,
      email: row.email ?? null,
      avatarUrl: row.profile_picture_url ?? null,
    }));

    return { members };
  }

  if (!input.youthRepublicId?.trim()) {
    throw new Error("volunteer_not_found");
  }

  const queryCode = input.youthRepublicId.trim();

  // Query Youth Republic volunteers table case-insensitively
  const { data: volunteer, error } = await supabase
    .from("volunteers")
    .select("volunteer_code, full_name, email, profile_picture_url, status")
    .ilike("volunteer_code", queryCode)
    .maybeSingle();

  if (error || !volunteer) {
    throw new Error("volunteer_not_found");
  }

  if (volunteer.status === "pending_verification") {
    throw new Error("volunteer_pending_verification");
  }

  if (volunteer.status !== "active") {
    throw new Error("volunteer_not_found");
  }

  return {
    volunteerCode: volunteer.volunteer_code,
    fullName: volunteer.full_name,
    email: volunteer.email ?? null,
    avatarUrl: volunteer.profile_picture_url ?? null,
  };
}
