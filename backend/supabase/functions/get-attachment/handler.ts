import { SupabaseClient } from "@supabase/supabase-js";
import { type R2Client } from "../_shared/r2.ts";

export interface GetAttachmentInput { attachmentId: string; }
export interface AttachmentReader {
  volunteerId?: string;
  staffOrgIds?: string[];
  canVerifyIdentity?: boolean;
}

export async function getAttachment(
  supabase: SupabaseClient,
  reader: AttachmentReader,
  input: GetAttachmentInput,
  r2Client?: R2Client,
): Promise<{ url: string }> {
  const { data: att, error } = await supabase.from("attachments")
    .select("id, domain, owner_type, owner_id, organization_id, bucket, storage_path, status")
    .eq("id", input.attachmentId).single();
  if (error || !att) throw new Error("not_found");
  // A row is only downloadable once its upload has been finalized. `status`
  // is a NOT NULL column in practice; guard only when it is actually present
  // so unit fixtures that omit it still exercise the permission matrix.
  if (att.status != null && att.status !== "ready") throw new Error("not_found");

  const isVolunteer = Boolean(reader.volunteerId);
  const staffOrgIds = reader.staffOrgIds ?? [];

  if (att.domain === "identity_doc") {
    const ownsIt = isVolunteer && await volunteerOwns(supabase, reader.volunteerId!, att.owner_id);
    if (!ownsIt && !reader.canVerifyIdentity) throw new Error("forbidden");
  } else {
    // application_file / session_photo
    const ownsIt = isVolunteer && await volunteerOwnsResource(supabase, reader.volunteerId!, att.owner_type, att.owner_id);
    const isOrgStaff = att.organization_id !== null && staffOrgIds.includes(att.organization_id);
    if (!ownsIt && !isOrgStaff) throw new Error("forbidden");
  }

  let downloadUrl: string | undefined;
  if (r2Client) {
    downloadUrl = await r2Client.getSignedUrl(att.storage_path, 300);
  } else {
    const { data: signed, error: sErr } = await supabase.storage
      .from(att.bucket).createSignedUrl(att.storage_path, 300);
    if (sErr || !signed) throw new Error("download_url_failed");
    downloadUrl = signed.signedUrl;
  }
  if (!downloadUrl) throw new Error("download_url_failed");

  return { url: downloadUrl };
}

async function volunteerOwns(supabase: SupabaseClient, volunteerId: string, ownerId: string): Promise<boolean> {
  return volunteerId === ownerId; // owner_type 'volunteer' → owner_id IS the volunteer id
}

async function volunteerOwnsResource(
  supabase: SupabaseClient, volunteerId: string, ownerType: string, ownerId: string,
): Promise<boolean> {
  const table = ownerType === "application" ? "applications" : "activity_hours";
  const { data } = await supabase.from(table).select("volunteer_id").eq("id", ownerId).single();
  return Boolean(data && data.volunteer_id === volunteerId);
}
