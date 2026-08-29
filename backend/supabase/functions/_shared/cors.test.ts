import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders, handleCorsPreflight } from "./cors.ts";

Deno.test("corsHeaders allows any origin", () => {
  assertEquals(corsHeaders["Access-Control-Allow-Origin"], "*");
});

Deno.test("corsHeaders allows the authorization and content-type request headers", () => {
  const allowed = corsHeaders["Access-Control-Allow-Headers"].toLowerCase();
  assertEquals(allowed.includes("authorization"), true);
  assertEquals(allowed.includes("content-type"), true);
});

Deno.test("corsHeaders allows POST and OPTIONS methods", () => {
  const allowed = corsHeaders["Access-Control-Allow-Methods"].toUpperCase();
  assertEquals(allowed.includes("POST"), true);
  assertEquals(allowed.includes("OPTIONS"), true);
});

Deno.test("handleCorsPreflight returns a 204 response carrying corsHeaders for an OPTIONS request", async () => {
  const req = new Request("https://example.com/create-opportunity", { method: "OPTIONS" });
  const res = handleCorsPreflight(req);
  assertEquals(res !== null, true);
  assertEquals(res!.status, 204);
  for (const [key, value] of Object.entries(corsHeaders)) {
    assertEquals(res!.headers.get(key), value);
  }
  assertEquals(await res!.text(), "");
});

Deno.test("handleCorsPreflight returns null for a non-OPTIONS request, leaving it to the caller", () => {
  const req = new Request("https://example.com/create-opportunity", { method: "POST" });
  assertEquals(handleCorsPreflight(req), null);
});
