import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { syncOrganization } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    if (!claims.platformOwner) {
      throw new Error("unauthorized");
    }
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await syncOrganization(supabase, input);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
