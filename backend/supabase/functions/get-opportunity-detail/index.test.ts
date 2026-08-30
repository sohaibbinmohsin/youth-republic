import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { handler } from "./index.ts";

Deno.test("get-opportunity-detail index answers an OPTIONS preflight before touching auth or the rate limiter", async () => {
  const req = new Request("https://example.com/get-opportunity-detail", { method: "OPTIONS" });
  const res = await handler(req);
  assertEquals(res.status, 204);
  for (const [key, value] of Object.entries(corsHeaders)) {
    assertEquals(res.headers.get(key), value);
  }
});
