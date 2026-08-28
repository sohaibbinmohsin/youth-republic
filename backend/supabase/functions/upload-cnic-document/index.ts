import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18";
import { createCnicUploadUrl, getCnicReadUrl, R2Client } from "./handler.ts";

function buildR2Client(): R2Client {
  const client = new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  });
  const bucketUrl = Deno.env.get("R2_BUCKET_URL")!;

  return {
    async putSignedUrl(key, expiresInSeconds = 900) {
      const url = new URL(`${bucketUrl}/${key}`);
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      const signed = await client.sign(new Request(url, { method: "PUT" }), { aws: { signQuery: true } });
      return signed.url;
    },
    async getSignedUrl(key, expiresInSeconds = 300) {
      const url = new URL(`${bucketUrl}/${key}`);
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      const signed = await client.sign(new Request(url, { method: "GET" }), { aws: { signQuery: true } });
      return signed.url;
    },
  };
}

Deno.serve(async (req) => {
  try {
    const { action, volunteerId, objectKey } = await req.json();
    const r2Client = buildR2Client();

    if (action === "upload") {
      const result = await createCnicUploadUrl(r2Client, volunteerId);
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (action === "read") {
      const result = await getCnicReadUrl(r2Client, objectKey);
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unknown_action" }), { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
});
