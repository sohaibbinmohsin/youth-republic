import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface UpdateChapterInput {
  chapterId: string;
  organizationId: string;
  name?: string;
  institution?: string;
  city?: string;
  province?: string;
  status?: "active" | "inactive";
}

export async function updateChapter(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: UpdateChapterInput,
): Promise<{ chapterId: string }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "chapters:update")) {
    throw new Error("forbidden");
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.institution !== undefined) patch.institution = input.institution;
  if (input.city !== undefined) patch.city = input.city;
  if (input.province !== undefined) patch.province = input.province;
  if (input.status !== undefined) patch.status = input.status;

  const { error } = await supabase.from("chapters").update(patch).eq("id", input.chapterId);
  if (error) throw error;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "chapter_updated",
    target_type: "chapter",
    target_id: input.chapterId,
    organization_id: input.organizationId,
    metadata: patch,
  });

  return { chapterId: input.chapterId };
}
