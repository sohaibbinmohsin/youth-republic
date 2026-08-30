import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { type AttachmentRequester, requestAttachmentUpload } from "./handler.ts";

async function resolveRequester(
  supabase: ReturnType<typeof getAdminClient>,
  authHeader: string | null,
): Promise<AttachmentRequester> {
  try {
    const { volunteerId, authUserId } = await verifyVolunteerToken(supabase, authHeader);
    return { authUserId, volunteerId };
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
  return { authUserId: claims.staffId, staffOrgIds };
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const supabase = getAdminClient();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const allowed = await checkRateLimit(supabase, `attach-req:${ip}`, 60, 3600);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: corsHeaders });
  }

  try {
    const requester = await resolveRequester(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await requestAttachmentUpload(supabase, requester, input);
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
      : message === "not_found"
      ? 404
      : ["mime_not_allowed", "file_too_large", "too_many_files", "bad_domain"].includes(message)
      ? 422
      : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
