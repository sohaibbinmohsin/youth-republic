import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createCnicUploadUrl, getCnicReadUrl, R2Client } from "./handler.ts";

class FakeR2Client implements R2Client {
  async putSignedUrl(key: string): Promise<string> {
    return `https://fake-r2/put/${key}`;
  }
  async getSignedUrl(key: string): Promise<string> {
    return `https://fake-r2/get/${key}`;
  }
}

Deno.test("createCnicUploadUrl returns a per-volunteer object key and signed URL", async () => {
  const r2 = new FakeR2Client();
  const result = await createCnicUploadUrl(r2, "volunteer-123");
  assertEquals(result.objectKey.startsWith("cnic/volunteer-123/"), true);
  assertEquals(result.uploadUrl.startsWith("https://fake-r2/put/"), true);
});

Deno.test("getCnicReadUrl returns a signed read URL for a given key", async () => {
  const r2 = new FakeR2Client();
  const result = await getCnicReadUrl(r2, "cnic/volunteer-123/abc.jpg");
  assertEquals(result.readUrl, "https://fake-r2/get/cnic/volunteer-123/abc.jpg");
});
