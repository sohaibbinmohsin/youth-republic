export interface EmailClient {
  send(to: string, subject: string, html: string): Promise<void>;
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
