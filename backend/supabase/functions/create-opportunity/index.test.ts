import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { handler } from "./index.ts";

Deno.test("create-opportunity index answers an OPTIONS preflight without touching auth, carrying corsHeaders", async () => {
  const req = new Request("https://example.com/create-opportunity", { method: "OPTIONS" });
  const res = await handler(req);
  assertEquals(res.status, 204);
  for (const [key, value] of Object.entries(corsHeaders)) {
    assertEquals(res.headers.get(key), value);
  }
});

Deno.test("create-opportunity index merges corsHeaders into an error response", async () => {
  const req = new Request("https://example.com/create-opportunity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
  for (const [key, value] of Object.entries(corsHeaders)) {
    assertEquals(res.headers.get(key), value);
  }
});
