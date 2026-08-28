import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { applyToOpportunity } from "./handler.ts";

Deno.serve(async (req) => {
  const supabase = getAdminClient();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const allowed = await checkRateLimit(supabase, `apply:${ip}`, 20, 3600);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
  }

  try {
    const { volunteerId } = await verifyVolunteerToken(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await applyToOpportunity(supabase, { ...input, volunteerId });
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
