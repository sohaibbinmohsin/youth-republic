import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { listOpportunities, listOpportunitiesPublic } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    const input = await req.json();
    const supabase = getAdminClient();

    // A valid staff token routes to the org-scoped staff variant (sees
    // deactivated); anything else is treated as an anonymous public caller.
    let result;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const claims = await verifyStaffToken(authHeader);
      result = await listOpportunities(supabase, claims, input);
    } else {
      result = await listOpportunitiesPublic(supabase, input);
    }

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
      : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) Deno.serve(handler);
