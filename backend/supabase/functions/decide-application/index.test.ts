import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { handler } from "./index.ts";
import { scheduleOrAwaitEmail } from "./handler.ts";

Deno.test("decide-application index answers an OPTIONS preflight with corsHeaders", async () => {
  const req = new Request("https://example.com/decide-application", { method: "OPTIONS" });
  const res = await handler(req);
  assertEquals(res.status, 204);
  for (const [key, value] of Object.entries(corsHeaders)) {
    assertEquals(res.headers.get(key), value);
  }
});

Deno.test("scheduleOrAwaitEmail with waitUntil does not block on a slow send", async () => {
  let resolveSend!: () => void;
  let resolveStarted!: () => void;
  const sendStarted = new Promise<void>((resolve) => {
    resolveStarted = resolve;
  });
  const emailClient = {
    send: (_to: string, _subject: string, _html: string) => {
      resolveStarted();
      return new Promise<void>((resolve) => {
        resolveSend = resolve;
      });
    },
  };
  const scheduled: Promise<unknown>[] = [];

  const returned = scheduleOrAwaitEmail(
    emailClient,
    "a@example.com",
    "subj",
    "<p>hi</p>",
    (p) => scheduled.push(p),
  );

  // With waitUntil, the helper returns immediately (undefined), not the send promise.
  assertEquals(returned, undefined);
  assertEquals(scheduled.length, 1);
  await sendStarted;
  resolveSend();
  await scheduled[0];
});

Deno.test("scheduleOrAwaitEmail without waitUntil awaits send and swallows errors", async () => {
  const sent: string[] = [];
  const okClient = {
    async send(to: string, _subject: string, _html: string) {
      sent.push(to);
    },
  };
  await scheduleOrAwaitEmail(okClient, "ok@example.com", "s", "<p>x</p>");
  assertEquals(sent, ["ok@example.com"]);

  let attempts = 0;
  const throwingClient = {
    async send() {
      attempts++;
      throw new Error("resend_send_failed: 500");
    },
  };
  await scheduleOrAwaitEmail(throwingClient, "fail@example.com", "s", "<p>x</p>");
  assertEquals(attempts, 1);
});
