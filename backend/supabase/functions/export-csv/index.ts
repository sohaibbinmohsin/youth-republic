import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { exportApplicationsCsv, exportVolunteersCsv } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const { organizationId, entity } = await req.json();

    const csv = entity === "volunteers"
      ? await exportVolunteersCsv(supabase, claims, organizationId)
      : await exportApplicationsCsv(supabase, claims, organizationId);

    return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
