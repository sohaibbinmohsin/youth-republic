// Shared CORS handling for every Edge Function's index.ts wrapper.
//
// All functions in this repo authenticate via a Bearer token (a staff JWT or
// a volunteer Supabase auth token) rather than cookies, so a wildcard origin
// does not create the CSRF-style exposure it would for cookie-authenticated
// endpoints. There is no existing repo convention for a vms-frontend
// deployed-origin env var, so "*" is used here; tighten this to a specific
// origin once such a convention exists.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Call this first thing in every index.ts handler, before touching auth or
// the request body. Returns the response to send back immediately for a
// preflight request, or null when the caller should continue as normal.
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}
