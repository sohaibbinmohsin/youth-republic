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
    .select("id, uploaded_by, bucket, storage_path, size_bytes, status, domain, owner_type, owner_id")
    .eq("id", input.attachmentId).single();
  if (error || !att) throw new Error("not_found");
  if (att.uploaded_by !== requester.authUserId) throw new Error("forbidden");
  if (att.status === "ready") {
    // A previous attempt may have marked this row ready and then failed while
    // retiring the document it replaced. Retrying finishes that cleanup.
    await supersedePreviousIdentityDocs(supabase, att);
    return { ok: true };
  }

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
  await supersedePreviousIdentityDocs(supabase, att);
  return { ok: true };
}

// Keep a single ready identity document. When the new file replaces one that
// had already been verified, the volunteer returns to pending_verification so
// the new document is reviewed. Lookup of active members is unchanged: it
// still returns only volunteers whose status is active.
async function supersedePreviousIdentityDocs(
  supabase: SupabaseClient,
  att: { id: string; domain?: string; owner_type?: string; owner_id?: string },
): Promise<void> {
  if (att.domain !== "identity_doc" || att.owner_type !== "volunteer" || !att.owner_id) return;

  const { data: previous, error: listError } = await supabase
    .from("attachments")
    .select("id, status")
    .eq("owner_type", "volunteer")
    .eq("owner_id", att.owner_id)
    .eq("domain", "identity_doc")
    .neq("id", att.id);
  if (listError) throw listError;

  const previousRows = (previous ?? []) as Array<{ id: string; status?: string }>;
  if (previousRows.length === 0) return;
  const replacedReady = previousRows.some((row) => row.status === "ready");

  const { error: deleteError } = await supabase
    .from("attachments")
    .delete()
    .eq("owner_type", "volunteer")
    .eq("owner_id", att.owner_id)
    .eq("domain", "identity_doc")
    .neq("id", att.id);
  if (deleteError) throw deleteError;
  if (!replacedReady) return;

  const { data: volunteer, error: volunteerError } = await supabase
    .from("volunteers")
    .select("id, status")
    .eq("id", att.owner_id)
    .maybeSingle();
  if (volunteerError) throw volunteerError;
  if (volunteer?.status !== "active") return;

  const { error: statusError } = await supabase
    .from("volunteers")
    .update({ status: "pending_verification" })
    .eq("id", volunteer.id);
  if (statusError) throw statusError;
}
