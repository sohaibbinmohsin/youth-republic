import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { handler } from "./index.ts";

Deno.test("export-csv index answers an OPTIONS preflight with corsHeaders", async () => {
  const req = new Request("https://example.com/export-csv", { method: "OPTIONS" });
  const res = await handler(req);
  assertEquals(res.status, 204);
  for (const [key, value] of Object.entries(corsHeaders)) {
    assertEquals(res.headers.get(key), value);
  }
});

Deno.test("export-csv index merges corsHeaders into an unauthorized error response", async () => {
  const req = new Request("https://example.com/export-csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: "org-1", entity: "applications" }),
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
  for (const [key, value] of Object.entries(corsHeaders)) {
    assertEquals(res.headers.get(key), value);
  }
});
