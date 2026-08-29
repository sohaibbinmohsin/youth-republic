import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getResendEmailClient } from "./sendEmail.ts";

Deno.test("getResendEmailClient sends via the Resend API", async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    return Promise.resolve(new Response(JSON.stringify({ id: "test" }), { status: 200 }));
  }) as typeof fetch;

  try {
    Deno.env.set("RESEND_API_KEY", "test-key");
    Deno.env.set("EMAIL_FROM_ADDRESS", "no-reply@example.org");
    const client = getResendEmailClient();
    await client.send("volunteer@example.com", "Application update", "<p>Selected!</p>");

    assertEquals(calls.length, 1);
    assertEquals(calls[0].url, "https://api.resend.com/emails");
    assertEquals((calls[0].body as Record<string, unknown>).to, "volunteer@example.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
