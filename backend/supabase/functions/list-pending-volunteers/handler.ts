import { SupabaseClient } from "@supabase/supabase-js";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface ListPendingVolunteersInput {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface PendingVolunteer {
  id: string;
  volunteerCode: string;
  fullName: string;
  dob: string;
  idDocType: string | null;
  idDocNumber: string | null;
  city: string;
  institution: string;
  submittedAt: string;
  idDocAttachmentId: string | null;
}

export interface ListPendingVolunteersResult {
  volunteers: PendingVolunteer[];
  total: number;
}

// Central identity-review queue: gated only by canVerifyIdentity, never a
// per-org permission.
export async function listPendingVolunteers(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListPendingVolunteersInput,
): Promise<ListPendingVolunteersResult> {
  if (staffClaims.canVerifyIdentity !== true) throw new Error("forbidden");

  const limit = Math.min(input.limit ?? 25, 100);
  const offset = input.offset ?? 0;

  let query = supabase
    .from("volunteers")
    .select(
      "id, volunteer_code, full_name, dob, id_doc_type, id_doc_number, city, institution, created_at",
      { count: "exact" },
    )
    .eq("status", "pending_verification");

  if (input.search) {
    const term = input.search.replace(/[%,]/g, "");
    query = query.or(
      `full_name.ilike.%${term}%,volunteer_code.ilike.%${term}%,id_doc_number.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  const rows = data ?? [];
  const ids = rows.map((r) => r.id as string);

  const attachmentByOwner: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: attachments, error: attachError } = await supabase
      .from("attachments")
      .select("id, owner_id, status")
      .eq("owner_type", "volunteer")
      .in("owner_id", ids)
      .eq("domain", "identity_doc");
    if (attachError) throw attachError;
    // A replacement upload leaves the previous ready document in place until
    // the new file is finalized. Prefer that ready document over the pending
    // replacement so review still opens the file that is actually on file.
    const chosen: Record<string, { id: string; status: string | null }> = {};
    for (const a of attachments ?? []) {
      const owner = a.owner_id as string;
      const status = (a.status as string | undefined) ?? null;
      const current = chosen[owner];
      if (!current || (status === "ready" && current.status !== "ready")) {
        chosen[owner] = { id: a.id as string, status };
      }
    }
    for (const [owner, attachment] of Object.entries(chosen)) {
      attachmentByOwner[owner] = attachment.id;
    }
  }

  return {
    volunteers: rows.map((r) => ({
      id: r.id as string,
      volunteerCode: (r.volunteer_code as string) ?? "",
      fullName: (r.full_name as string) ?? "",
      dob: r.dob as string,
      idDocType: (r.id_doc_type as string | null) ?? null,
      idDocNumber: (r.id_doc_number as string | null) ?? null,
      city: (r.city as string) ?? "",
      institution: (r.institution as string) ?? "",
      submittedAt: r.created_at as string,
      idDocAttachmentId: attachmentByOwner[r.id as string] ?? null,
    })),
    total: count ?? 0,
  };
}
