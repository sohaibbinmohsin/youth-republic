import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { escapeHtml } from "./escapeHtml.ts";

Deno.test("escapeHtml escapes angle brackets so tags can't be injected", () => {
  assertEquals(escapeHtml("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
});

Deno.test("escapeHtml escapes ampersands, quotes, and apostrophes", () => {
  assertEquals(escapeHtml(`Tom & "Jerry" 'Cat'`), "Tom &amp; &quot;Jerry&quot; &#39;Cat&#39;");
});

Deno.test("escapeHtml leaves plain text unchanged", () => {
  assertEquals(escapeHtml("Muhammad Ali"), "Muhammad Ali");
});
