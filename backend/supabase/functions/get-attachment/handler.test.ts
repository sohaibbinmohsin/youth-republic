// get-attachment/handler.test.ts
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { getAttachment } from "./handler.ts";

function sbWith(att: Record<string, unknown>) {
  return {
    from(table: string) {
      if (table === "attachments") return { select() { return this; }, eq() { return this; }, async single() { return { data: att, error: null }; } };
      // volunteers lookup for identity_doc owner check
      return { select() { return this; }, eq() { return this; }, async single() { return { data: { id: att.owner_id }, error: null }; } };
    },
    storage: { from() { return { async createSignedUrl() { return { data: { signedUrl: "https://dl" }, error: null }; } }; } },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

Deno.test("identity_doc: owning volunteer allowed", async () => {
  const r = await getAttachment(sbWith({ id: "a", domain: "identity_doc", owner_type: "volunteer", owner_id: "v1", organization_id: null, bucket: "identity-docs", storage_path: "p" }),
    { volunteerId: "v1" }, { attachmentId: "a" });
  assertEquals(r.url, "https://dl");
});

Deno.test("identity_doc: central verifier allowed", async () => {
  const r = await getAttachment(sbWith({ id: "a", domain: "identity_doc", owner_type: "volunteer", owner_id: "v1", organization_id: null, bucket: "identity-docs", storage_path: "p" }),
    { staffOrgIds: [], canVerifyIdentity: true }, { attachmentId: "a" });
  assertEquals(r.url, "https://dl");
});

Deno.test("identity_doc: org staff without verify capability denied", async () => {
  await assertRejects(() => getAttachment(sbWith({ id: "a", domain: "identity_doc", owner_type: "volunteer", owner_id: "v1", organization_id: null, bucket: "identity-docs", storage_path: "p" }),
    { staffOrgIds: ["org-1"], canVerifyIdentity: false }, { attachmentId: "a" }), Error, "forbidden");
});

Deno.test("session_photo: staff of the owning org allowed", async () => {
  const r = await getAttachment(sbWith({ id: "a", domain: "session_photo", owner_type: "activity_hours", owner_id: "h1", organization_id: "org-1", bucket: "session-photos", storage_path: "p" }),
    { staffOrgIds: ["org-1"] }, { attachmentId: "a" });
  assertEquals(r.url, "https://dl");
});

Deno.test("application_file: staff of a different org denied", async () => {
  await assertRejects(() => getAttachment(sbWith({ id: "a", domain: "application_file", owner_type: "application", owner_id: "app1", organization_id: "org-1", bucket: "application-files", storage_path: "p" }),
    { staffOrgIds: ["org-2"] }, { attachmentId: "a" }), Error, "forbidden");
});
