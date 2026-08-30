// finalize-attachment/handler.test.ts
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { finalizeAttachment } from "./handler.ts";

const row = { id: "att-1", uploaded_by: "u", bucket: "session-photos", storage_path: "p", size_bytes: 100, status: "pending" };

function sb(objInfo: { size: number } | null, updateOk = true) {
  return {
    from() {
      return {
        select() { return this; }, eq() { return this; },
        async single() { return { data: row, error: null }; },
        update() { return { eq() { return { async then(res: (v: unknown) => void) { res({ error: updateOk ? null : new Error("x") }); } }; } }; },
      };
    },
    storage: { from() { return { async info() { return objInfo ? { data: { size: objInfo.size }, error: null } : { data: null, error: new Error("missing") }; } }; } },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

Deno.test("rejects when the storage object is missing", async () => {
  await assertRejects(() => finalizeAttachment(sb(null), { authUserId: "u" }, { attachmentId: "att-1" }), Error, "object_missing");
});

Deno.test("rejects when requester is not the uploader", async () => {
  await assertRejects(() => finalizeAttachment(sb({ size: 100 }), { authUserId: "other" }, { attachmentId: "att-1" }), Error, "forbidden");
});

Deno.test("happy path flips status to ready", async () => {
  const r = await finalizeAttachment(sb({ size: 100 }), { authUserId: "u" }, { attachmentId: "att-1" });
  assertEquals(r.ok, true);
});
