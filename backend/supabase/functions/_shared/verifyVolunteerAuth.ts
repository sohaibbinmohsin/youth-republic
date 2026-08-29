import { SupabaseClient } from "@supabase/supabase-js";

export async function verifyVolunteerAuthUser(
  supabase: SupabaseClient,
  authHeader: string | null,
): Promise<{ authUserId: string }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("unauthorized");
  }
  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("unauthorized");
  }
  return { authUserId: data.user.id };
}

export async function verifyVolunteerToken(
  supabase: SupabaseClient,
  authHeader: string | null,
): Promise<{ volunteerId: string; authUserId: string }> {
  const { authUserId } = await verifyVolunteerAuthUser(supabase, authHeader);
  const { data: volunteer, error } = await supabase
    .from("volunteers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();
  if (error || !volunteer) {
    throw new Error("unauthorized");
  }
  return { volunteerId: volunteer.id, authUserId };
}
