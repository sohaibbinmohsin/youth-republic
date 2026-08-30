import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { exportApplicationsCsv, exportVolunteersCsv, exportOpportunitiesCsv, exportActivityHoursCsv } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const { organizationId, entity } = await req.json();

    let csv: string;
    if (entity === "volunteers") {
      csv = await exportVolunteersCsv(supabase, claims, organizationId);
    } else if (entity === "opportunities") {
      csv = await exportOpportunitiesCsv(supabase, claims, organizationId);
    } else if (entity === "activity_hours") {
      csv = await exportActivityHoursCsv(supabase, claims, organizationId);
    } else {
      csv = await exportApplicationsCsv(supabase, claims, organizationId);
    }

    return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv", ...corsHeaders } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
