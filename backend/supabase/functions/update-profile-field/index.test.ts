import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";

Deno.test("update-profile-field index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handler(new Request("https://example.com/fn", { method: "OPTIONS" }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("update-profile-field index carries CORS headers on an error response", async () => {
  const res = await handler(
    new Request("https://example.com/fn", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldName: "city", newValue: "Karachi" }),
    }),
  );
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
