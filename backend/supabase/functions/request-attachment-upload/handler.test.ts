// backend/supabase/functions/request-attachment-upload/handler.test.ts
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { requestAttachmentUpload } from "./handler.ts";

function fakeSupabase(overrides: Record<string, unknown> = {}) {
  return {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        async count() { return { count: 0, error: null }; },
        insert(row: unknown) { return { select() { return { async single() { return { data: { id: "att-new" }, error: null }; } }; } }; },
      };
    },
    storage: {
      from() {
        return { async createSignedUploadUrl() { return { data: { signedUrl: "https://upload" }, error: null }; } };
      },
    },
    ...overrides,
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

Deno.test("rejects mime outside the domain allowlist", async () => {
  await assertRejects(
    () => requestAttachmentUpload(fakeSupabase(), { authUserId: "u", volunteerId: "v" },
      { domain: "session_photo", ownerType: "activity_hours", ownerId: "o", mimeType: "application/zip", sizeBytes: 100 }),
    Error, "mime_not_allowed");
});

Deno.test("rejects file over the size cap", async () => {
  await assertRejects(
    () => requestAttachmentUpload(fakeSupabase(), { authUserId: "u", volunteerId: "v" },
      { domain: "session_photo", ownerType: "activity_hours", ownerId: "o", mimeType: "image/png", sizeBytes: 20 * 1024 * 1024 }),
    Error, "file_too_large");
});

Deno.test("volunteer requester cannot target owner_type application for another org", async () => {
  // owner is an existing application row belonging to org-X; requester is a staffer of org-Y
  const sb = fakeSupabase({
    from() {
      return {
        select() { return this; }, eq() { return this; }, in() { return this; },
        async single() { return { data: { organization_id: "org-X" }, error: null }; },
        async count() { return { count: 0, error: null }; },
        insert() { return { select() { return { async single() { return { data: { id: "att-new" }, error: null }; } }; } }; },
      };
    },
  });
  await assertRejects(
    () => requestAttachmentUpload(sb, { authUserId: "u", staffOrgIds: ["org-Y"] },
      { domain: "application_file", ownerType: "application", ownerId: "app-1", mimeType: "application/pdf", sizeBytes: 100 }),
    Error, "forbidden");
});

Deno.test("pre-registration requester can request an identity_doc/volunteer upload", async () => {
  const r = await requestAttachmentUpload(
    fakeSupabase(),
    { authUserId: "auth-user-1", preRegistration: true },
    {
      domain: "identity_doc",
      ownerType: "volunteer",
      ownerId: "client-chosen-uuid",
      mimeType: "image/png",
      sizeBytes: 12345,
      originalFilename: "cnic.png",
    },
  );
  assertEquals(r.attachmentId, "att-new");
  assertEquals(r.uploadUrl, "https://upload");
  assertEquals(r.storagePath.startsWith("volunteer/client-chosen-uuid/"), true);
});

Deno.test("pre-registration requester cannot request a session_photo upload", async () => {
  await assertRejects(
    () => requestAttachmentUpload(fakeSupabase(), { authUserId: "auth-user-1", preRegistration: true },
      { domain: "session_photo", ownerType: "activity_hours", ownerId: "o", mimeType: "image/png", sizeBytes: 100 }),
    Error, "forbidden");
});

Deno.test("pre-registration requester cannot request an application_file upload", async () => {
  await assertRejects(
    () => requestAttachmentUpload(fakeSupabase(), { authUserId: "auth-user-1", preRegistration: true },
      { domain: "application_file", ownerType: "application", ownerId: "app-1", mimeType: "application/pdf", sizeBytes: 100 }),
    Error, "forbidden");
});

Deno.test("happy path returns attachmentId, uploadUrl, storagePath", async () => {
  const r = await requestAttachmentUpload(fakeSupabase(), { authUserId: "u", volunteerId: "v" },
    { domain: "session_photo", ownerType: "activity_hours", ownerId: "own-1", mimeType: "image/png", sizeBytes: 100 });
  assertEquals(r.attachmentId, "att-new");
  assertEquals(r.uploadUrl, "https://upload");
  assertEquals(r.storagePath.startsWith("activity_hours/own-1/"), true);
});
