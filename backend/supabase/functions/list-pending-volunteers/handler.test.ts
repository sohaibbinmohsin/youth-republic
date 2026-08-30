import { assertEquals, assertRejects } from "jsr:@std/assert";
import { listPendingVolunteers } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

type Row = Record<string, unknown>;

const claims = (over: Partial<StaffClaims> = {}): StaffClaims => ({
  actorType: "staff",
  staffId: "staff-1",
  platformOwner: false,
  canVerifyIdentity: true,
  orgRoles: [],
  moduleAccess: [],
  ...over,
});

// In-memory fake of the PostgREST builder: select (with count) / eq / in / or /
// order / range, resolved on await.
function makeDb(tables: Record<string, Row[]>) {
  function builder(name: string) {
    let rows: Row[] = [...(tables[name] ?? [])];
    let wantCount = false;
    // deno-lint-ignore no-explicit-any
    const api: any = {
      select(_cols?: string, opts?: { count?: string }) {
        wantCount = opts?.count === "exact";
        return api;
      },
      eq(col: string, val: unknown) {
        rows = rows.filter((r) => (r[col] ?? null) === val);
        return api;
      },
      in(col: string, vals: unknown[]) {
        rows = rows.filter((r) => vals.includes(r[col]));
        return api;
      },
      or() {
        // Search filter is a no-op in the fake; search is not exercised here.
        return api;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        const asc = opts?.ascending !== false;
        rows = [...rows].sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          if (av === bv) return 0;
          return (av! > bv! ? 1 : -1) * (asc ? 1 : -1);
        });
        return api;
      },
      range(from: number, to: number) {
        const count = wantCount ? rows.length : null;
        const sliced = rows.slice(from, to + 1);
        return Promise.resolve({ data: sliced, error: null, count });
      },
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        const count = wantCount ? rows.length : null;
        return Promise.resolve({ data: rows, error: null, count }).then(onF, onR);
      },
    };
    return api;
  }
  return { from: builder } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

function seed() {
  return makeDb({
    volunteers: [
      {
        id: "v-old",
        volunteer_code: "VOL-2026-000001",
        full_name: "Old Pending",
        dob: "2000-01-01",
        id_doc_type: "cnic",
        id_doc_number: "35202-1111111-1",
        city: "Lahore",
        institution: "LUMS",
        status: "pending_verification",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "v-new",
        volunteer_code: "VOL-2026-000002",
        full_name: "New Pending",
        dob: "2001-05-05",
        id_doc_type: "b_form",
        id_doc_number: "35202-2222222-2",
        city: "Karachi",
        institution: "IBA",
        status: "pending_verification",
        created_at: "2026-03-01T00:00:00Z",
      },
      {
        id: "v-active",
        volunteer_code: "VOL-2026-000003",
        full_name: "Already Active",
        dob: "1999-09-09",
        id_doc_type: "cnic",
        id_doc_number: "35202-3333333-3",
        city: "Lahore",
        institution: "LUMS",
        status: "active",
        created_at: "2026-02-01T00:00:00Z",
      },
    ],
    attachments: [
      { id: "att-new", owner_id: "v-new", owner_type: "volunteer", domain: "identity_doc" },
    ],
  });
}

Deno.test("listPendingVolunteers rejects a caller without canVerifyIdentity", async () => {
  await assertRejects(
    () => listPendingVolunteers(seed(), claims({ canVerifyIdentity: false }), {}),
    Error,
    "forbidden",
  );
});

Deno.test("listPendingVolunteers returns only pending_verification rows, newest first, with the joined identity_doc attachment id", async () => {
  const result = await listPendingVolunteers(seed(), claims(), {});

  assertEquals(result.total, 2);
  assertEquals(result.volunteers.map((v) => v.id), ["v-new", "v-old"]);

  const newRow = result.volunteers[0];
  assertEquals(newRow.volunteerCode, "VOL-2026-000002");
  assertEquals(newRow.fullName, "New Pending");
  assertEquals(newRow.dob, "2001-05-05");
  assertEquals(newRow.idDocType, "b_form");
  assertEquals(newRow.idDocNumber, "35202-2222222-2");
  assertEquals(newRow.city, "Karachi");
  assertEquals(newRow.institution, "IBA");
  assertEquals(newRow.submittedAt, "2026-03-01T00:00:00Z");
  assertEquals(newRow.idDocAttachmentId, "att-new");

  assertEquals(result.volunteers[1].idDocAttachmentId, null);
});
