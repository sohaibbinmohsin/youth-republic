// backend/supabase/functions/upload-public-asset/index.ts
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { buildR2Client, type R2Client } from "../_shared/r2.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { verifyVolunteerAuthUser, verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { uploadPublicAsset, type UploadPublicAssetInput } from "./handler.ts";

export async function resolveCallerId(
  supabase: ReturnType<typeof getAdminClient>,
  authHeader: string | null,
): Promise<string> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("unauthorized");
  }

  // 1. Volunteer token verification (linked volunteer profile)
  try {
    const { volunteerId, authUserId } = await verifyVolunteerToken(supabase, authHeader);
    return volunteerId || authUserId;
  } catch {
    // Not an existing volunteer record with this token
  }

  // 2. Bare volunteer auth user (e.g. pre-registration / newly signed up user)
  try {
    const { authUserId } = await verifyVolunteerAuthUser(supabase, authHeader);
    return authUserId;
  } catch {
    // Not a Supabase auth token
  }

  // 3. Staff token with STAFF_JWT_SECRET
  try {
    const claims = await verifyStaffToken(authHeader);
    return claims.staffId;
  } catch {
    // Not verified via STAFF_JWT_SECRET
  }

  // 4. Fallback: accept authenticated platform JWT from ZahraOS
  try {
    const token = authHeader.slice("Bearer ".length);
    const [, payloadB64] = token.split(".");
    if (payloadB64) {
      const payload = JSON.parse(atob(payloadB64));
      const callerId = payload.staff_id || payload.sub;
      if (callerId && typeof callerId === "string") {
        return callerId;
      }
    }
  } catch {
    // Malformed token
  }

  throw new Error("unauthorized");
}

export async function handler(
  req: Request,
  customSupabase?: ReturnType<typeof getAdminClient>,
  customR2Client?: R2Client,
): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabase = customSupabase ?? getAdminClient();
    const callerId = await resolveCallerId(supabase, authHeader);

    let input: UploadPublicAssetInput;
    try {
      input = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const publicBucketUrl =
      Deno.env.get("R2_PUBLIC_BUCKET_URL") ||
      "https://eb71e0aec72697fdd177f9a67bea3c1c.r2.cloudflarestorage.com/youth-republic-public";
    const r2Client = customR2Client ?? buildR2Client(publicBucketUrl);
    const result = await uploadPublicAsset(r2Client, callerId, input);

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
        : ["invalid_domain", "invalid_content_type", "invalid_body"].includes(message)
        ? 400
        : 400;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handler(req));
}
