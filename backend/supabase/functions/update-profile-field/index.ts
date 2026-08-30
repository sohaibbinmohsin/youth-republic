import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { updateProfileField } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const supabase = getAdminClient();
    const { volunteerId } = await verifyVolunteerToken(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await updateProfileField(supabase, volunteerId, input);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "invalid_field" ? 400 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
