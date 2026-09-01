import { SupabaseClient } from "@supabase/supabase-js";
import { type R2Client } from "../_shared/r2.ts";

export interface FinalizeAttachmentInput { attachmentId: string; }

export async function finalizeAttachment(
  supabase: SupabaseClient,
  requester: { authUserId: string },
  input: FinalizeAttachmentInput,
  r2Client?: R2Client,
): Promise<{ ok: true }> {
  const { data: att, error } = await supabase.from("attachments")
    .select("id, uploaded_by, bucket, storage_path, size_bytes, status")
    .eq("id", input.attachmentId).single();
  if (error || !att) throw new Error("not_found");
  if (att.uploaded_by !== requester.authUserId) throw new Error("forbidden");
  if (att.status === "ready") return { ok: true };

  let actualSize: number;
  if (r2Client) {
    const head = await r2Client.headObject(att.storage_path);
    if (!head) throw new Error("object_missing");
    actualSize = head.size;
  } else {
    const { data: obj, error: oErr } = await supabase.storage.from(att.bucket).info(att.storage_path);
    if (oErr || !obj) throw new Error("object_missing");
    actualSize = obj.size as number;
  }

  // size tolerance: allow the row's declared size to be within 10% of the actual object (if size reported).
  if (actualSize > 0 && Math.abs(actualSize - att.size_bytes) > att.size_bytes * 0.1 + 1024) {
    throw new Error("size_mismatch");
  }

  const { error: uErr } = await supabase.from("attachments")
    .update({ status: "ready", size_bytes: actualSize || att.size_bytes }).eq("id", att.id);
  if (uErr) throw uErr;
  return { ok: true };
}
