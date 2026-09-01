import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { verifyVolunteerAuthUser, verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { buildR2Client } from "../_shared/r2.ts";
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

  try {
    const claims = await verifyStaffToken(authHeader);
    return claims.staffId;
  } catch (err) {
    if (!(err instanceof Error) || err.message !== "unauthorized") throw err;
  }

  // Pre-registration user fallback (authenticated Supabase Auth user without a volunteers row yet)
  const { authUserId } = await verifyVolunteerAuthUser(supabase, authHeader);
  return authUserId;
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
    const r2Client = Deno.env.get("R2_BUCKET_URL") ? buildR2Client() : undefined;
    const result = await finalizeAttachment(supabase, { authUserId }, input, r2Client);
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
