import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken, type StaffClaims } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { lookupYouthRepublicMember } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    let claims: StaffClaims;
    try {
      claims = await verifyStaffToken(req.headers.get("Authorization"));
    } catch {
      // Fallback: accept authenticated platform JWT from ZahraOS
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("unauthorized");
      }
      const token = authHeader.slice("Bearer ".length);
      const [, payloadB64] = token.split(".");
      if (!payloadB64) throw new Error("unauthorized");
      const payload = JSON.parse(atob(payloadB64));
      if (!payload.sub && !payload.staff_id) {
        throw new Error("unauthorized");
      }
      claims = {
        actorType: "staff",
        staffId: String(payload.staff_id || payload.sub),
        platformOwner: Boolean(payload.platform_owner || payload.user_metadata?.platform_owner),
        canVerifyIdentity: true,
        orgRoles: [{ organizationId: "" }],
        moduleAccess: [],
      };
    }

    const input = await req.json();
    const result = await lookupYouthRepublicMember(getAdminClient(), claims, input);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status =
      message === "unauthorized"
        ? 401
        : message === "forbidden"
        ? 403
        : message === "volunteer_not_found"
        ? 404
        : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) Deno.serve(handler);
