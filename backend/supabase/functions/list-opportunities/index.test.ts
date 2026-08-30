import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";

Deno.test("list-opportunities index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handler(new Request("https://example.com/fn", { method: "OPTIONS" }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("list-opportunities index carries CORS headers on an error response (invalid staff token)", async () => {
  const res = await handler(
    new Request("https://example.com/fn", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer not-a-real-token" },
      body: JSON.stringify({ organizationId: "x" }),
    }),
  );
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
