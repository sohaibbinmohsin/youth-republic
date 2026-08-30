import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { createOpportunity } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await createOpportunity(supabase, claims, input);
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized"
      ? 401
      : message === "forbidden"
      ? 403
      : message === "invalid_form"
      ? 422
      : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

// Guarded so importing `handler` for tests doesn't also bind a real
// listener (Deno.serve defaults to port 8000, which would collide across
// the many index.ts modules the test suite imports). The deployed function
// always runs index.ts as the entry point, where this is true.
if (import.meta.main) {
  Deno.serve(handler);
}
