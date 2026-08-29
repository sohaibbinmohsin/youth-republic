import { SupabaseClient } from "@supabase/supabase-js";

export type SensitiveFieldName = "dob" | "cnic_number" | "phone" | "emergency_contact" | "guardian_name" | "guardian_contact";

export interface UpdateSensitiveFieldInput {
  volunteerId: string;
  fieldName: SensitiveFieldName;
  newValue: string;
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
  "cnic_number",
  "phone",
  "emergency_contact",
  "guardian_name",
  "guardian_contact",
];

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

  const oldValue = String((volunteer as Record<string, unknown>)[input.fieldName] ?? "");

  const { error: updateError } = await supabase
    .from("volunteers")
    .update({ [input.fieldName]: input.newValue })
    .eq("id", input.volunteerId);
  if (updateError) throw updateError;

  const { error: logError } = await supabase.from("profile_field_changes").insert({
    volunteer_id: input.volunteerId,
    field_name: input.fieldName,
    old_value: oldValue,
    new_value: input.newValue,
  });
  if (logError) throw logError;

  return { volunteerId: input.volunteerId };
}
