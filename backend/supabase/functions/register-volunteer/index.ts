import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { registerVolunteer } from "./handler.ts";

Deno.serve(async (req) => {
  const supabase = getAdminClient();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const allowed = await checkRateLimit(supabase, `register:${ip}`, 5, 3600);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
  }

  try {
    const input = await req.json();
    const result = await registerVolunteer(supabase, input);
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "minor_consent_required" ? 422 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
