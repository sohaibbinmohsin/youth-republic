import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { getEmailClient } from "../_shared/sendEmail.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { decideApplication } from "./handler.ts";

// Supabase Edge Functions expose EdgeRuntime.waitUntil so background work can
// continue after the HTTP response is sent. Declared here for typecheck;
// unavailable in plain Deno unit tests (those omit the waitUntil option).
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await decideApplication(
      supabase,
      claims,
      input,
      getEmailClient(),
      {
        // Return after DB writes; status email must not hold the HTTP response
        // open (ZahraOS aborts the client fetch after a short timeout).
        waitUntil: (promise) => EdgeRuntime.waitUntil(promise),
      },
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
