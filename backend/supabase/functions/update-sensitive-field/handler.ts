import { SupabaseClient } from "@supabase/supabase-js";

export type SensitiveFieldName = "dob" | "id_doc_number" | "phone" | "emergency_contact" | "guardian_name" | "guardian_contact";

export interface UpdateSensitiveFieldInput {
  volunteerId: string;
  fieldName: SensitiveFieldName;
  newValue: unknown;
}

export interface UpdateSensitiveFieldResult {
  volunteerId: string;
}

// SensitiveFieldName is compile-time only; the field name arrives from the
// request body and is interpolated straight into .select()/.update(), so it
// must be validated at RUNTIME before any DB call. Without this, a caller
// could write an arbitrary column (status, email, auth_user_id, ...) — and
// because the volunteers UPDATE commits before the profile_field_changes
// insert's CHECK constraint rejects the bad field name, the change would land
// with no audit row.
const ALLOWED_FIELDS: readonly SensitiveFieldName[] = [
  "dob",
  "id_doc_number",
  "phone",
  "emergency_contact",
  "guardian_name",
  "guardian_contact",
];

// profile_field_changes.old_value/new_value are text columns — anything
// that isn't already a string (emergency_contact's object shape) is
// serialized to JSON text for the audit row; the actual volunteers.update
// call below still gets the real value, string or object, unchanged.
function toAuditText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function updateSensitiveField(
  supabase: SupabaseClient,
  input: UpdateSensitiveFieldInput,
): Promise<UpdateSensitiveFieldResult> {
  if (!ALLOWED_FIELDS.includes(input.fieldName)) {
    throw new Error("invalid_field");
  }

  const { data: volunteer, error: fetchError } = await supabase
    .from("volunteers")
    .select(input.fieldName)
    .eq("id", input.volunteerId)
    .single();
  if (fetchError) throw fetchError;

  const oldValue = (volunteer as Record<string, unknown>)[input.fieldName];

  if (input.fieldName === "id_doc_number") {
    if (typeof input.newValue === "string" && input.newValue.trim() !== "") {
      const trimmed = input.newValue.trim();
      const { data: existingDoc } = await supabase
        .from("volunteers")
        .select("id")
        .eq("id_doc_number", trimmed)
        .neq("id", input.volunteerId)
        .maybeSingle();

      if (existingDoc) {
        throw new Error("id_doc_already_registered");
      }
    }
  }

  if (input.fieldName === "phone") {
    if (typeof input.newValue === "string" && input.newValue.trim() !== "") {
      const trimmed = input.newValue.trim();
      const { data: existingPhone } = await supabase
        .from("volunteers")
        .select("id")
        .eq("phone", trimmed)
        .neq("id", input.volunteerId)
        .maybeSingle();

      if (existingPhone) {
        throw new Error("phone_already_registered");
      }
    }
  }

  const { error: updateError } = await supabase
    .from("volunteers")
    .update({ [input.fieldName]: input.newValue })
    .eq("id", input.volunteerId);

  if (updateError) {
    const msg = updateError.message || "";
    if (
      updateError.code === "23505" ||
      msg.includes("volunteers_cnic_number_key") ||
      msg.includes("id_doc_number")
    ) {
      throw new Error("id_doc_already_registered");
    }
    if (
      updateError.code === "23505" &&
      (msg.includes("volunteers_phone_key") || msg.includes("phone"))
    ) {
      throw new Error("phone_already_registered");
    }
    throw updateError;
  }

  const { error: logError } = await supabase.from("profile_field_changes").insert({
    volunteer_id: input.volunteerId,
    field_name: input.fieldName,
    old_value: toAuditText(oldValue),
    new_value: toAuditText(input.newValue),
  });
  if (logError) throw logError;

  return { volunteerId: input.volunteerId };
}
