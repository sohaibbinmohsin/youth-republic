import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { type AttachmentReader, getAttachment } from "./handler.ts";

async function resolveReader(
  supabase: ReturnType<typeof getAdminClient>,
  authHeader: string | null,
): Promise<AttachmentReader> {
  try {
    const { volunteerId } = await verifyVolunteerToken(supabase, authHeader);
    return { volunteerId };
  } catch (err) {
    if (!(err instanceof Error) || err.message !== "unauthorized") throw err;
  }
  const claims = await verifyStaffToken(authHeader);
  const staffOrgIds = Array.from(
    new Set([
      ...claims.orgRoles.map((r) => r.organizationId),
      ...claims.moduleAccess.map((m) => m.organizationId),
    ]),
  );
  return { staffOrgIds, canVerifyIdentity: claims.canVerifyIdentity };
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const supabase = getAdminClient();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const allowed = await checkRateLimit(supabase, `attach-get:${ip}`, 300, 3600);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: corsHeaders });
  }

  try {
    const reader = await resolveReader(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await getAttachment(supabase, reader, input);
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

if (import.meta.main) {
  Deno.serve(handler);
}
