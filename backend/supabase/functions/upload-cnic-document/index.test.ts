import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { handler } from "./index.ts";

Deno.test("upload-cnic-document index answers an OPTIONS preflight with corsHeaders", async () => {
  const req = new Request("https://example.com/upload-cnic-document", { method: "OPTIONS" });
  const res = await handler(req);
  assertEquals(res.status, 204);
  for (const [key, value] of Object.entries(corsHeaders)) {
    assertEquals(res.headers.get(key), value);
  }
});

Deno.test("upload-cnic-document index merges corsHeaders into the unknown_action error response", async () => {
  const req = new Request("https://example.com/upload-cnic-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "not-a-real-action", objectKey: "x" }),
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
  for (const [key, value] of Object.entries(corsHeaders)) {
    assertEquals(res.headers.get(key), value);
  }
});
