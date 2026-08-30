import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { finalizeAttachment } from "./handler.ts";

async function resolveAuthUserId(
  supabase: ReturnType<typeof getAdminClient>,
  authHeader: string | null,
): Promise<string> {
  try {
    const { authUserId } = await verifyVolunteerToken(supabase, authHeader);
    return authUserId;
  } catch (err) {
    if (!(err instanceof Error) || err.message !== "unauthorized") throw err;
  }
  const claims = await verifyStaffToken(authHeader);
  return claims.staffId;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const supabase = getAdminClient();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const allowed = await checkRateLimit(supabase, `attach-fin:${ip}`, 120, 3600);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: corsHeaders });
  }

  try {
    const authUserId = await resolveAuthUserId(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await finalizeAttachment(supabase, { authUserId }, input);
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
      : ["object_missing", "size_mismatch"].includes(message)
      ? 422
      : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
