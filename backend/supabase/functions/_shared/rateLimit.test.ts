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

Deno.test("checkRateLimit never allows more than the limit through under concurrent requests for the same key", async () => {
  const supabase = testClient();
  const key = `test-concurrent-${crypto.randomUUID()}`;
  const limit = 5;
  const concurrentAttempts = 25;

  // A separate SELECT-then-INSERT (the pre-fix implementation) can let a
  // burst of concurrent requests all read a count under the limit before
  // any of them has inserted its own row -- true concurrency against a real
  // network round trip to the hosted DB isn't perfectly deterministic to
  // force, but firing well more attempts than the limit, all at once, at
  // the same key reliably reproduces the race in practice: each request's
  // SELECT and INSERT are separate round trips, leaving a wide window for
  // the other 24 requests to interleave. An atomic implementation must
  // allow exactly `limit` through regardless.
  const results = await Promise.all(
    Array.from({ length: concurrentAttempts }, () => checkRateLimit(supabase, key, limit, 60)),
  );

  const allowedCount = results.filter((allowed) => allowed).length;
  assertEquals(allowedCount, limit);
});
