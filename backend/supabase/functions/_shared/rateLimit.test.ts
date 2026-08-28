import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "./rateLimit.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.test("checkRateLimit allows requests under the limit", async () => {
  const supabase = testClient();
  const key = `test-${crypto.randomUUID()}`;
  const allowed = await checkRateLimit(supabase, key, 3, 60);
  assertEquals(allowed, true);
});

Deno.test("checkRateLimit rejects once the limit is exceeded", async () => {
  const supabase = testClient();
  const key = `test-${crypto.randomUUID()}`;
  await checkRateLimit(supabase, key, 2, 60);
  await checkRateLimit(supabase, key, 2, 60);
  const thirdAttempt = await checkRateLimit(supabase, key, 2, 60);
  assertEquals(thirdAttempt, false);
});
