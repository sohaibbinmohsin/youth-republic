export interface EmailClient {
  send(to: string, subject: string, html: string): Promise<void>;
}

// No-op client for environments without Resend configured. Callers treat
// notification email as best-effort, so a missing key must not fail the
// request whose DB state change already committed.
const NOOP_EMAIL_CLIENT: EmailClient = {
  async send(to: string, subject: string): Promise<void> {
    console.warn(`[email] skipped (RESEND not configured): to=${to} subject=${subject}`);
  },
};

/**
 * Tolerant factory used by index.ts entrypoints: returns a live Resend client
 * when RESEND_API_KEY + EMAIL_FROM_ADDRESS are set, otherwise a no-op client.
 */
export function getEmailClient(): EmailClient {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM_ADDRESS");
  if (!apiKey || !from) return NOOP_EMAIL_CLIENT;
  return getResendEmailClient();
}

export function getResendEmailClient(): EmailClient {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM_ADDRESS");
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM_ADDRESS must be set");
  }

  return {
    async send(to: string, subject: string, html: string): Promise<void> {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (!response.ok) {
        throw new Error(`resend_send_failed: ${response.status}`);
      }
    },
  };
}
