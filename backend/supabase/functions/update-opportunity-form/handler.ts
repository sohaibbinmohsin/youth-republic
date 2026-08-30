import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";
import { validateFormDefinition } from "../_shared/forms.ts";

export interface UpdateOpportunityFormInput {
  opportunityId: string;
  form: unknown;
}

export async function updateOpportunityForm(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: UpdateOpportunityFormInput,
): Promise<{ ok: true }> {
  // Authorize against the opportunity's STORED organization_id. This handler
  // runs on the service-role client (RLS bypassed), so this check is the only
  // tenant guard.
  const { data: opportunity, error: fetchError } = await supabase
    .from("opportunities")
    .select("id, organization_id")
    .eq("id", input.opportunityId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!opportunity) throw new Error("not_found");

  if (!staffHasPermission(staffClaims, opportunity.organization_id, "youth-republic", "opportunities:manage")) {
    throw new Error("forbidden");
  }

  const v = validateFormDefinition(input.form);
  if (!v.ok) throw new Error("invalid_form");

  const { error: updateError } = await supabase
    .from("opportunities")
    .update({ application_form: v.def })
    .eq("id", input.opportunityId)
    .eq("organization_id", opportunity.organization_id);
  if (updateError) throw updateError;

  const { error: logError } = await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "application_form_updated",
    target_type: "opportunity",
    target_id: input.opportunityId,
    organization_id: opportunity.organization_id,
    metadata: { field_count: v.def.fields.length },
  });
  if (logError) throw logError;

  return { ok: true };
}
