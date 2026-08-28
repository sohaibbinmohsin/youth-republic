import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { updateSensitiveField } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const { volunteerId } = await verifyVolunteerToken(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await updateSensitiveField(supabase, { ...input, volunteerId });
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
