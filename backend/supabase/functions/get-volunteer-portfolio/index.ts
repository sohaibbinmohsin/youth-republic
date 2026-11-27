import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getIdentityDocumentOnFile, getVolunteerPortfolio } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const supabase = getAdminClient();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const allowed = await checkRateLimit(supabase, `portfolio:${ip}`, 120, 3600);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: corsHeaders });
  }

  try {
    // volunteerId comes from the verified token, never the request body.
    const { volunteerId } = await verifyVolunteerToken(supabase, req.headers.get("Authorization"));
    let view: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body === "object" && typeof (body as { view?: unknown }).view === "string") {
        view = (body as { view: string }).view;
      }
    } catch {
      view = undefined;
    }
    // Lightweight read for the identity-document card. The full portfolio
    // response is unchanged when `view` is omitted.
    if (view === "identity-document") {
      const identityDocument = await getIdentityDocumentOnFile(supabase, volunteerId);
      return new Response(JSON.stringify(identityDocument), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const result = await getVolunteerPortfolio(supabase, volunteerId);
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
