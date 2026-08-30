import { SupabaseClient } from "@supabase/supabase-js";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface VerifyVolunteerInput {
  volunteerId: string;
  decision: "verify" | "reject";
  reason?: string;
}

export interface VerifyVolunteerResult {
  status: string;
}

// Identity verification is a central, org-agnostic function: it is gated only
// by the caller's canVerifyIdentity claim, never by a per-org permission, and
// its audit rows carry a null organization_id.
export async function verifyVolunteer(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: VerifyVolunteerInput,
): Promise<VerifyVolunteerResult> {
  if (staffClaims.canVerifyIdentity !== true) throw new Error("forbidden");

  if (input.decision === "reject" && !input.reason) {
    throw new Error("reason_required");
  }

  const { data: volunteer, error: fetchError } = await supabase
    .from("volunteers")
    .select("id, status")
    .eq("id", input.volunteerId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!volunteer) throw new Error("not_found");

  if (input.decision === "verify") {
    const { error: updateError } = await supabase
      .from("volunteers")
      .update({ status: "active" })
      .eq("id", input.volunteerId);
    if (updateError) throw updateError;

    await supabase.from("admin_action_log").insert({
      staff_id: staffClaims.staffId,
      actor_type: staffClaims.actorType,
      action: "volunteer_identity_verified",
      target_type: "volunteer",
      target_id: input.volunteerId,
      organization_id: null,
      metadata: {},
    });

    return { status: "active" };
  }

  // Reject: the volunteer stays pending_verification. Hard-delete their
  // identity_doc attachment row so a corrected document can be re-uploaded;
  // storage-object cleanup is out of scope here.
  await supabase
    .from("attachments")
    .delete()
    .eq("owner_type", "volunteer")
    .eq("owner_id", input.volunteerId)
    .eq("domain", "identity_doc");

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "volunteer_identity_rejected",
    target_type: "volunteer",
    target_id: input.volunteerId,
    organization_id: null,
    metadata: { reason: input.reason },
  });

  return { status: "pending_verification" };
}
