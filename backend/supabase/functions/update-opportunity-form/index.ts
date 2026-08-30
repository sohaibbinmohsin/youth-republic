import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { updateOpportunityForm } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const supabase = getAdminClient();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  // Staff-authed form editor: ~120 saves/hour/IP is generous for a human
  // editing an application form while still capping runaway clients.
  const allowed = await checkRateLimit(supabase, `opp-form:${ip}`, 120, 3600);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: corsHeaders });
  }

  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const input = await req.json();
    const result = await updateOpportunityForm(supabase, claims, input);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized"
      ? 401
      : message === "forbidden"
      ? 403
      : message === "not_found"
      ? 404
      : message === "invalid_form"
      ? 422
      : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
