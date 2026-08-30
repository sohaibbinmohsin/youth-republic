// backend/supabase/functions/request-attachment-upload/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { ATTACHMENT_POLICY, EXT_BY_MIME, type AttachmentDomain } from "../_shared/attachmentPolicy.ts";

export interface RequestAttachmentUploadInput {
  domain: AttachmentDomain;
  ownerType: "volunteer" | "application" | "activity_hours";
  ownerId: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename?: string;
}
export interface RequestAttachmentUploadResult {
  attachmentId: string;
  uploadUrl: string;
  storagePath: string;
}
export interface AttachmentRequester {
  authUserId: string;
  volunteerId?: string;
  staffOrgIds?: string[];
  // A bare authenticated Supabase user with no `volunteers` row yet (register
  // step 2). Security boundary: a preRegistration requester can ONLY create an
  // `identity_doc` + `ownerType='volunteer'` attachment tied to its own
  // `authUserId` — no other domain, no other owner type, no other owner.
  preRegistration?: boolean;
}

export async function requestAttachmentUpload(
  supabase: SupabaseClient,
  requester: AttachmentRequester,
  input: RequestAttachmentUploadInput,
): Promise<RequestAttachmentUploadResult> {
  const policy = ATTACHMENT_POLICY[input.domain];
  if (!policy) throw new Error("bad_domain");
  if (!policy.mimeAllowlist.includes(input.mimeType)) throw new Error("mime_not_allowed");
  if (input.sizeBytes <= 0 || input.sizeBytes > policy.maxSizeBytes) throw new Error("file_too_large");

  // Ownership: which domains each requester kind may write to.
  const isVolunteer = Boolean(requester.volunteerId);
  const isStaff = Array.isArray(requester.staffOrgIds);
  let organizationId: string | null = null;

  if (input.domain === "identity_doc") {
    // An existing volunteer re-uploading, OR a pre-registration user uploading
    // their ID doc before `register-volunteer` runs. Both still require
    // ownerType='volunteer'. A preRegistration requester has neither volunteerId
    // nor staffOrgIds, so the session_photo / application_file branches below
    // reject it via their isVolunteer / isStaff guards — it can reach nothing but
    // this branch. `uploaded_by` is set to requester.authUserId on insert;
    // `register-volunteer` (Task 14) re-points owner_id and re-verifies
    // uploaded_by === input.authUserId after it creates the volunteer row.
    const mayUploadIdentityDoc = isVolunteer || requester.preRegistration === true;
    if (!mayUploadIdentityDoc || input.ownerType !== "volunteer") throw new Error("forbidden");
    // owner_id is a client-chosen uuid for the volunteer row about to be created,
    // or the volunteer's own id for a re-upload. Accept both; re-point happens later.
  } else if (input.domain === "session_photo") {
    if (!isVolunteer || input.ownerType !== "activity_hours") throw new Error("forbidden");
  } else if (input.domain === "application_file") {
    if (isVolunteer && input.ownerType === "application") {
      // draft: client-chosen uuid, no existing row to check
    } else if (isStaff && input.ownerType === "application") {
      const { data, error } = await supabase.from("applications")
        .select("organization_id").eq("id", input.ownerId).single();
      if (error || !data) throw new Error("not_found");
      if (!requester.staffOrgIds!.includes(data.organization_id)) throw new Error("forbidden");
      organizationId = data.organization_id;
    } else {
      throw new Error("forbidden");
    }
  }

  // Per-owner file count cap (only meaningful once the row is re-pointed; a soft check).
  const { count } = await supabase.from("attachments")
    .select("id", { count: "exact", head: true })
    .eq("owner_type", input.ownerType).eq("owner_id", input.ownerId).eq("status", "ready");
  if ((count ?? 0) >= policy.maxFilesPerOwner) throw new Error("too_many_files");

  const attachmentId = crypto.randomUUID();
  const ext = EXT_BY_MIME[input.mimeType] ?? "bin";
  const storagePath = `${input.ownerType}/${input.ownerId}/${attachmentId}.${ext}`;

  const { data: inserted, error: insErr } = await supabase.from("attachments").insert({
    id: attachmentId,
    organization_id: organizationId,
    domain: input.domain,
    owner_type: input.ownerType,
    owner_id: input.ownerId,
    bucket: policy.bucket,
    storage_path: storagePath,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    original_filename: input.originalFilename ?? null,
    status: "pending",
    uploaded_by: requester.authUserId,
  }).select("id").single();
  if (insErr) throw insErr;
  const persistedId = (inserted && (inserted as { id?: string }).id) || attachmentId;

  const { data: signed, error: sErr } = await supabase.storage
    .from(policy.bucket).createSignedUploadUrl(storagePath);
  if (sErr || !signed) throw new Error("upload_url_failed");

  return { attachmentId: persistedId, uploadUrl: signed.signedUrl, storagePath };
}
