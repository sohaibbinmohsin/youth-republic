import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { applyToOpportunity } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const supabase = getAdminClient();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const allowed = await checkRateLimit(supabase, `apply:${ip}`, 20, 3600);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: corsHeaders });
  }

  try {
    const { volunteerId, authUserId } = await verifyVolunteerToken(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await applyToOpportunity(supabase, { ...input, volunteerId, authUserId });
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    if (message === "validation") {
      const fieldErrors = (err as Error & { fieldErrors?: Record<string, string> }).fieldErrors ?? {};
      return new Response(JSON.stringify({ error: "validation", fieldErrors }), {
        status: 422,
        headers: corsHeaders,
      });
    }
    const status = message === "unauthorized"
      ? 401
      : message === "forbidden"
      ? 403
      : message === "not_found"
      ? 404
      : ["id_doc_required", "bad_attachment"].includes(message)
      ? 422
      : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
