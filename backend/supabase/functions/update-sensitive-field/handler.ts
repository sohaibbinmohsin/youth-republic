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

export async function updateSensitiveField(
  supabase: SupabaseClient,
  input: UpdateSensitiveFieldInput,
): Promise<UpdateSensitiveFieldResult> {
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
