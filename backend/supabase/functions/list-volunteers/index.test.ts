import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";

function optionsRequest(): Request {
  return new Request("https://example.com/fn", { method: "OPTIONS" });
}

function jsonRequest(body: unknown, accessToken?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  return new Request("https://example.com/fn", { method: "POST", headers, body: JSON.stringify(body) });
}

Deno.test("list-volunteers index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handler(optionsRequest());
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("list-volunteers index carries CORS headers on an error response", async () => {
  const res = await handler(jsonRequest({ organizationId: "x" }));
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
