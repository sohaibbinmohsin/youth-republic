import { SupabaseClient } from "@supabase/supabase-js";

export type ProfileFieldName = "city" | "institution" | "graduation_year" | "availability" | "skills" | "interests";

export interface UpdateProfileFieldInput {
  fieldName: ProfileFieldName;
  newValue: string | number | string[];
}

export interface UpdateProfileFieldResult {
  volunteerId: string;
}

// Deliberately not the same allowlist as update-sensitive-field: none of
// these are safeguarding-relevant, so none of them write to
// profile_field_changes (whose field_name check constraint doesn't include
// them, and shouldn't — that log stays scoped to what it was built for).
const ALLOWED_FIELDS: readonly ProfileFieldName[] = [
  "city",
  "institution",
  "graduation_year",
  "availability",
  "skills",
  "interests",
];

export async function updateProfileField(
  supabase: SupabaseClient,
  volunteerId: string,
  input: UpdateProfileFieldInput,
): Promise<UpdateProfileFieldResult> {
  if (!ALLOWED_FIELDS.includes(input.fieldName)) {
    throw new Error("invalid_field");
  }

  const { error } = await supabase
    .from("volunteers")
    .update({ [input.fieldName]: input.newValue })
    .eq("id", volunteerId);
  if (error) throw error;

  return { volunteerId };
}
