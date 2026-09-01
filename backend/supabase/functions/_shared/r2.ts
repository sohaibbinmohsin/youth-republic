// backend/supabase/functions/_shared/r2.ts
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18";

export interface R2Client {
  putSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  headObject(key: string): Promise<{ size: number } | null>;
}

export function buildR2Client(): R2Client {
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") || "";
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
  const bucketUrl = (Deno.env.get("R2_BUCKET_URL") || "").replace(/\/$/, "");

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
  });

  return {
    async putSignedUrl(key: string, expiresInSeconds = 900) {
      const cleanKey = key.replace(/^\//, "");
      const url = new URL(`${bucketUrl}/${cleanKey}`);
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      const signed = await client.sign(new Request(url, { method: "PUT" }), { aws: { signQuery: true } });
      return signed.url;
    },
    async getSignedUrl(key: string, expiresInSeconds = 300) {
      const cleanKey = key.replace(/^\//, "");
      const url = new URL(`${bucketUrl}/${cleanKey}`);
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      const signed = await client.sign(new Request(url, { method: "GET" }), { aws: { signQuery: true } });
      return signed.url;
    },
    async headObject(key: string) {
      const cleanKey = key.replace(/^\//, "");
      const url = new URL(`${bucketUrl}/${cleanKey}`);
      const signed = await client.sign(new Request(url, { method: "HEAD" }));
      const res = await fetch(signed);
      if (!res.ok) return null;
      const length = res.headers.get("content-length");
      return { size: length ? parseInt(length, 10) : 0 };
    },
  };
}
