// finalize-attachment/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";

export interface FinalizeAttachmentInput { attachmentId: string; }

export async function finalizeAttachment(
  supabase: SupabaseClient,
  requester: { authUserId: string },
  input: FinalizeAttachmentInput,
): Promise<{ ok: true }> {
  const { data: att, error } = await supabase.from("attachments")
    .select("id, uploaded_by, bucket, storage_path, size_bytes, status")
    .eq("id", input.attachmentId).single();
  if (error || !att) throw new Error("not_found");
  if (att.uploaded_by !== requester.authUserId) throw new Error("forbidden");
  if (att.status === "ready") return { ok: true };

  const { data: obj, error: oErr } = await supabase.storage.from(att.bucket).info(att.storage_path);
  if (oErr || !obj) throw new Error("object_missing");
  // size tolerance: allow the row's declared size to be within 10% of the actual object.
  if (Math.abs((obj.size as number) - att.size_bytes) > att.size_bytes * 0.1 + 1024) {
    throw new Error("size_mismatch");
  }

  const { error: uErr } = await supabase.from("attachments")
    .update({ status: "ready", size_bytes: obj.size }).eq("id", att.id);
  if (uErr) throw uErr;
  return { ok: true };
}
