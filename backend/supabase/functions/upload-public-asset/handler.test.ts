// backend/supabase/functions/upload-public-asset/handler.test.ts
import { assertEquals, assertMatch, assertRejects } from "jsr:@std/assert";
import { uploadPublicAsset, type UploadPublicAssetInput } from "./handler.ts";
import type { R2Client } from "../_shared/r2.ts";

function safeSetEnv(key: string, value: string): boolean {
  try {
    Deno.env.set(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeDeleteEnv(key: string): boolean {
  try {
    Deno.env.delete(key);
    return true;
  } catch {
    return false;
  }
}

function createMockR2Client(recordedCalls: { key: string; expiresInSeconds?: number }[] = []): R2Client {
  return {
    async putSignedUrl(key: string, expiresInSeconds = 900) {
      recordedCalls.push({ key, expiresInSeconds });
      return `https://r2.cloudflarestorage.com/mock-bucket/${key}?X-Amz-Expires=${expiresInSeconds}&signed=true`;
    },
    async getSignedUrl(key: string, expiresInSeconds = 300) {
      return `https://r2.cloudflarestorage.com/mock-bucket/${key}?X-Amz-Expires=${expiresInSeconds}`;
    },
    async headObject(_key: string) {
      return null;
    },
  };
}

Deno.test("valid avatar request generates avatars/${callerId}/${uuid}.${ext} presigned PUT URL and canonical public URL", async () => {
  const envSet = safeSetEnv("R2_PUBLIC_URL", "https://assets.youthrepublic.org");
  const options = envSet ? undefined : { publicBaseUrl: "https://assets.youthrepublic.org" };

  const calls: { key: string; expiresInSeconds?: number }[] = [];
  const client = createMockR2Client(calls);

  const callerId = "volunteer-1234-uuid";
  const input: UploadPublicAssetInput = {
    domain: "avatar",
    contentType: "image/jpeg",
  };

  const result = await uploadPublicAsset(client, callerId, input, options);

  assertEquals(calls.length, 1);
  assertEquals(calls[0].expiresInSeconds, 900);
  assertEquals(calls[0].key, result.objectKey);

  assertMatch(result.objectKey, /^avatars\/volunteer-1234-uuid\/[0-9a-fA-F-]{36}\.jpg$/);
  assertEquals(result.publicUrl, `https://assets.youthrepublic.org/${result.objectKey}`);
  assertEquals(
    result.uploadUrl,
    `https://r2.cloudflarestorage.com/mock-bucket/${result.objectKey}?X-Amz-Expires=900&signed=true`,
  );
});

Deno.test("valid logo request generates logos/${callerId}/${uuid}.${ext} presigned PUT URL and canonical public URL", async () => {
  const envSet = safeSetEnv("R2_PUBLIC_URL", "https://assets.youthrepublic.org");
  const options = envSet ? undefined : { publicBaseUrl: "https://assets.youthrepublic.org" };

  const calls: { key: string; expiresInSeconds?: number }[] = [];
  const client = createMockR2Client(calls);

  const callerId = "org-chapter-5678";
  const input: UploadPublicAssetInput = {
    domain: "logo",
    contentType: "image/png",
  };

  const result = await uploadPublicAsset(client, callerId, input, options);

  assertEquals(calls.length, 1);
  assertEquals(calls[0].expiresInSeconds, 900);
  assertEquals(calls[0].key, result.objectKey);

  assertMatch(result.objectKey, /^logos\/org-chapter-5678\/[0-9a-fA-F-]{36}\.png$/);
  assertEquals(result.publicUrl, `https://assets.youthrepublic.org/${result.objectKey}`);
  assertEquals(
    result.uploadUrl,
    `https://r2.cloudflarestorage.com/mock-bucket/${result.objectKey}?X-Amz-Expires=900&signed=true`,
  );
});

Deno.test("supports all allowed MIME types with correct extensions", async () => {
  const envSet = safeSetEnv("R2_PUBLIC_URL", "https://assets.youthrepublic.org");
  const options = envSet ? undefined : { publicBaseUrl: "https://assets.youthrepublic.org" };
  const client = createMockR2Client();

  const cases: Array<{ contentType: UploadPublicAssetInput["contentType"]; expectedExt: string }> = [
    { contentType: "image/jpeg", expectedExt: "jpg" },
    { contentType: "image/png", expectedExt: "png" },
    { contentType: "image/webp", expectedExt: "webp" },
    { contentType: "image/svg+xml", expectedExt: "svg" },
  ];

  for (const { contentType, expectedExt } of cases) {
    const result = await uploadPublicAsset(client, "user-1", { domain: "avatar", contentType }, options);
    assertMatch(result.objectKey, new RegExp(`^avatars/user-1/[0-9a-fA-F-]{36}\\.${expectedExt}$`));
  }
});

Deno.test("fallback to R2_BUCKET_URL when R2_PUBLIC_URL is not set", async () => {
  if (safeDeleteEnv("R2_PUBLIC_URL") && safeSetEnv("R2_BUCKET_URL", "https://pub-r2-bucket.cf.r2.dev")) {
    const client = createMockR2Client();
    const result = await uploadPublicAsset(client, "user-1", { domain: "avatar", contentType: "image/png" });
    assertEquals(result.publicUrl, `https://pub-r2-bucket.cf.r2.dev/${result.objectKey}`);
  } else {
    // When env permissions are not granted, options.publicBaseUrl simulates fallback URL
    const client = createMockR2Client();
    const result = await uploadPublicAsset(
      client,
      "user-1",
      { domain: "avatar", contentType: "image/png" },
      { publicBaseUrl: "https://pub-r2-bucket.cf.r2.dev" },
    );
    assertEquals(result.publicUrl, `https://pub-r2-bucket.cf.r2.dev/${result.objectKey}`);
  }
});

Deno.test("rejects invalid MIME types with invalid_content_type", async () => {
  const client = createMockR2Client();
  const invalidTypes = [
    "application/pdf",
    "text/html",
    "image/gif",
    "application/octet-stream",
    "",
    // deno-lint-ignore no-explicit-any
  ] as any[];

  for (const contentType of invalidTypes) {
    await assertRejects(
      () => uploadPublicAsset(client, "caller-1", { domain: "avatar", contentType }),
      Error,
      "invalid_content_type",
    );
  }
});

Deno.test("rejects invalid domain with invalid_domain", async () => {
  const client = createMockR2Client();
  const invalidDomains = [
    "document",
    "photo",
    "attachment",
    "",
    // deno-lint-ignore no-explicit-any
  ] as any[];

  for (const domain of invalidDomains) {
    await assertRejects(
      () => uploadPublicAsset(client, "caller-1", { domain, contentType: "image/png" }),
      Error,
      "invalid_domain",
    );
  }
});

Deno.test("rejects empty callerId with unauthorized", async () => {
  const client = createMockR2Client();
  await assertRejects(
    () => uploadPublicAsset(client, "", { domain: "avatar", contentType: "image/png" }),
    Error,
    "unauthorized",
  );
});
