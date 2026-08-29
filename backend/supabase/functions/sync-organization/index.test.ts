import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { handler } from "./index.ts";

Deno.test("sync-organization index answers an OPTIONS preflight with corsHeaders", async () => {
  const req = new Request("https://example.com/sync-organization", { method: "OPTIONS" });
  const res = await handler(req);
  assertEquals(res.status, 204);
  for (const [key, value] of Object.entries(corsHeaders)) {
    assertEquals(res.headers.get(key), value);
  }
});

Deno.test("sync-organization index merges corsHeaders into a non-platform-owner rejection", async () => {
  const req = new Request("https://example.com/sync-organization", {
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
