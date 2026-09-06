import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface ListChaptersInput {
  organizationId: string;
}

export interface ChapterRow {
  id: string;
  name: string;
  institution: string | null;
  city: string | null;
  province: string | null;
  status: string;
}

export async function listChapters(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListChaptersInput,
): Promise<{ chapters: ChapterRow[] }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "youth-republic", "chapters:read")) {
    throw new Error("forbidden");
  }
  const { data, error } = await supabase
    .from("chapters")
    .select("id, name, institution, city, province, status")
    .eq("organization_id", input.organizationId)
    .order("name");
  if (error) throw error;
  return { chapters: (data ?? []) as ChapterRow[] };
}
