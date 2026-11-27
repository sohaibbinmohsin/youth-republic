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

Deno.test("uses R2 client when provided", async () => {
  const fakeR2 = {
    async putSignedUrl() { return ""; },
    async getSignedUrl() { return ""; },
    async headObject() { return { size: 100 }; },
  };
  const r = await finalizeAttachment(sb(null), { authUserId: "u" }, { attachmentId: "att-1" }, fakeR2);
  assertEquals(r.ok, true);
});

function identityFinalizeClient(opts: {
  attachment: Record<string, unknown>;
  others: Array<Record<string, unknown>>;
  volunteer: { id: string; status: string } | null;
}) {
  const deleted: Record<string, string>[] = [];
  const statusUpdates: string[] = [];
  const client = {
    from(table: string) {
      if (table === "volunteers") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle() {
                    return Promise.resolve({ data: opts.volunteer, error: null });
                  },
                };
              },
            };
          },
          update(patch: { status: string }) {
            return {
              eq(_col: string, id: string) {
                return {
                  then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
                    statusUpdates.push(`${id}:${patch.status}`);
                    return Promise.resolve({ error: null }).then(onF, onR);
                  },
                };
              },
            };
          },
        };
      }
      return {
        select() {
          const filters: Record<string, unknown> = {};
          let excludedId: string | null = null;
          const api = {
            eq(col: string, val: unknown) {
              filters[col] = val;
              return api;
            },
            neq(col: string, val: unknown) {
              if (col === "id") excludedId = String(val);
              return api;
            },
            single() {
              return Promise.resolve({ data: opts.attachment, error: null });
            },
            then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
              const rows = opts.others.filter((row) => {
                if (excludedId && row.id === excludedId) return false;
                return Object.entries(filters).every(([key, value]) => row[key] === value);
              });
              return Promise.resolve({ data: rows, error: null }).then(onF, onR);
            },
          };
          return api;
        },
        update() {
          return {
            eq() {
              return {
                then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
                  return Promise.resolve({ error: null }).then(onF, onR);
                },
              };
            },
          };
        },
        delete() {
          const filters: Record<string, string> = {};
          const api = {
            eq(col: string, val: string) {
              filters[col] = val;
              return api;
            },
            neq(col: string, val: string) {
              filters[`neq:${col}`] = val;
              return api;
            },
            then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
              deleted.push({ ...filters });
              return Promise.resolve({ error: null }).then(onF, onR);
            },
          };
          return api;
        },
      };
    },
    storage: {
      from() {
        return { async info() { return { data: { size: 100 }, error: null }; } };
      },
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
  return { client, deleted, statusUpdates };
}

const replacementAttachment = {
  id: "att-new",
  uploaded_by: "u",
  bucket: "identity-docs",
  storage_path: "volunteer/v-real/att-new.pdf",
  size_bytes: 100,
  status: "pending",
  domain: "identity_doc",
  owner_type: "volunteer",
  owner_id: "v-real",
};

Deno.test("finalizing a replacement identity document retires the previous ready file and reopens verification", async () => {
  const { client, deleted, statusUpdates } = identityFinalizeClient({
    attachment: replacementAttachment,
    others: [
      { id: "att-old", owner_type: "volunteer", owner_id: "v-real", domain: "identity_doc", status: "ready" },
      { id: "att-abandoned", owner_type: "volunteer", owner_id: "v-real", domain: "identity_doc", status: "pending" },
    ],
    volunteer: { id: "v-real", status: "active" },
  });
  const r = await finalizeAttachment(client, { authUserId: "u" }, { attachmentId: "att-new" });
  assertEquals(r.ok, true);
  assertEquals(deleted, [{
    owner_type: "volunteer",
    owner_id: "v-real",
    domain: "identity_doc",
    "neq:id": "att-new",
  }]);
  assertEquals(statusUpdates, ["v-real:pending_verification"]);
});

Deno.test("finalizing a replacement leaves a pending volunteer pending", async () => {
  const { client, deleted, statusUpdates } = identityFinalizeClient({
    attachment: replacementAttachment,
    others: [
      { id: "att-old", owner_type: "volunteer", owner_id: "v-real", domain: "identity_doc", status: "ready" },
    ],
    volunteer: { id: "v-real", status: "pending_verification" },
  });
  const r = await finalizeAttachment(client, { authUserId: "u" }, { attachmentId: "att-new" });
  assertEquals(r.ok, true);
  assertEquals(deleted.length, 1);
  assertEquals(statusUpdates, []);
});

Deno.test("finalizing the first identity document does not change volunteer status", async () => {
  const { client, deleted, statusUpdates } = identityFinalizeClient({
    attachment: replacementAttachment,
    others: [],
    volunteer: { id: "v-real", status: "active" },
  });
  const r = await finalizeAttachment(client, { authUserId: "u" }, { attachmentId: "att-new" });
  assertEquals(r.ok, true);
  assertEquals(deleted, []);
  assertEquals(statusUpdates, []);
});

