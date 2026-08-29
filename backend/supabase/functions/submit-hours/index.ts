import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { submitHours } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const supabase = getAdminClient();
    const { volunteerId } = await verifyVolunteerToken(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await submitHours(supabase, { ...input, volunteerId });
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
