import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface CreateChapterInput {
  organizationId: string;
  name: string;
  institution?: string;
  city?: string;
  province?: string;
}

export async function createChapter(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: CreateChapterInput,
): Promise<{ chapterId: string }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "chapters:write")) {
    throw new Error("forbidden");
  }

  const { data, error } = await supabase
    .from("chapters")
    .insert({
      organization_id: input.organizationId,
      name: input.name,
      institution: input.institution ?? null,
      city: input.city ?? null,
      province: input.province ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "chapter_created",
    target_type: "chapter",
    target_id: data.id,
    organization_id: input.organizationId,
  });

  return { chapterId: data.id };
}
