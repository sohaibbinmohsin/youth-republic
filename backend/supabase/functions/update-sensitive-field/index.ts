import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { updateSensitiveField } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await updateSensitiveField(supabase, input);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
});
