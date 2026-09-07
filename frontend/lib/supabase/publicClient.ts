import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://kbotpktgojpvkotigrjh.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtib3Rwa3Rnb2pwdmtvdGlncmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0ODk2NzIsImV4cCI6MjEwMzA2NTY3Mn0.RaE7H0eWCNrvAzfiMJdnQ1Nwr1zipUjgqVNdJY-1PZ4";

/**
 * Anon Supabase client with no cookie adapter, for reading data that is the
 * same for every visitor (opportunity noticeboard / detail). Because it
 * never touches `cookies()`, a Server Component that only uses this stays
 * statically renderable and cacheable.
 */
export function getPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}
