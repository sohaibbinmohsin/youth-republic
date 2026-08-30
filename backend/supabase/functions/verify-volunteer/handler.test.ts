import { assertEquals, assertRejects } from "jsr:@std/assert";
import { verifyVolunteer } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

const claims = (over: Partial<StaffClaims> = {}): StaffClaims => ({
  actorType: "staff",
  staffId: "staff-1",
  platformOwner: false,
  canVerifyIdentity: true,
  orgRoles: [],
  moduleAccess: [],
  ...over,
});

interface Capture {
  update?: Record<string, unknown>;
  logs: Record<string, unknown>[];
  deletes: { table: string; filters: Record<string, unknown> }[];
}

interface SbOpts {
  volunteer?: Record<string, unknown> | null;
  capture?: Capture;
}

function sb(opts: SbOpts = {}) {
  const volunteer = opts.volunteer === undefined
    ? { id: "vol1", status: "pending_verification" }
    : opts.volunteer;
  const cap = opts.capture;
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      // deno-lint-ignore no-explicit-any
      const api: any = {
        select() {
          return api;
        },
        eq(col: string, val: unknown) {
          filters[col] = val;
          return api;
        },
        // deno-lint-ignore require-await
        async maybeSingle() {
          if (table === "volunteers") return { data: volunteer, error: null };
          return { data: null, error: null };
        },
        update(payload: Record<string, unknown>) {
          if (table === "volunteers" && cap) cap.update = payload;
          return { eq: () => ({ then: (r: (v: unknown) => void) => r({ error: null }) }) };
        },
        insert(payload: Record<string, unknown>) {
          if (table === "admin_action_log" && cap) cap.logs.push(payload);
          return { then: (r: (v: unknown) => void) => r({ error: null }) };
        },
        delete() {
          // deno-lint-ignore no-explicit-any
          const dapi: any = {
            eq(col: string, val: unknown) {
              filters[col] = val;
              return dapi;
            },
            then(r: (v: unknown) => void) {
              if (cap) cap.deletes.push({ table, filters: { ...filters } });
              return r({ error: null });
            },
          };
          return dapi;
        },
      };
      return api;
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

function newCapture(): Capture {
  return { logs: [], deletes: [] };
}

Deno.test("verifyVolunteer rejects a caller without canVerifyIdentity", async () => {
  await assertRejects(
    () => verifyVolunteer(sb(), claims({ canVerifyIdentity: false }), { volunteerId: "vol1", decision: "verify" }),
    Error,
    "forbidden",
  );
});

Deno.test("verifyVolunteer verify sets status active and logs volunteer_identity_verified with a null organization_id", async () => {
  const capture = newCapture();
  const result = await verifyVolunteer(sb({ capture }), claims({ staffId: "real-staff" }), {
    volunteerId: "vol1",
    decision: "verify",
  });

  assertEquals(result, { status: "active" });
  assertEquals(capture.update, { status: "active" });
  assertEquals(capture.logs.length, 1);
  const log = capture.logs[0];
  assertEquals(log.staff_id, "real-staff");
  assertEquals(log.action, "volunteer_identity_verified");
  assertEquals(log.target_type, "volunteer");
  assertEquals(log.target_id, "vol1");
  assertEquals(log.organization_id, null);
  assertEquals(capture.deletes.length, 0);
});

Deno.test("verifyVolunteer reject keeps pending_verification, logs the reason, and deletes the identity_doc attachment row", async () => {
  const capture = newCapture();
  const result = await verifyVolunteer(sb({ capture }), claims(), {
    volunteerId: "vol1",
    decision: "reject",
    reason: "Blurry document",
  });

  assertEquals(result, { status: "pending_verification" });
  assertEquals(capture.update, undefined);
  assertEquals(capture.logs.length, 1);
  assertEquals(capture.logs[0].action, "volunteer_identity_rejected");
  assertEquals(capture.logs[0].organization_id, null);
  assertEquals(capture.logs[0].metadata, { reason: "Blurry document" });
  assertEquals(capture.deletes.length, 1);
  assertEquals(capture.deletes[0].table, "attachments");
  assertEquals(capture.deletes[0].filters, {
    owner_type: "volunteer",
    owner_id: "vol1",
    domain: "identity_doc",
  });
});

Deno.test("verifyVolunteer reject without a reason throws reason_required", async () => {
  await assertRejects(
    () => verifyVolunteer(sb(), claims(), { volunteerId: "vol1", decision: "reject" }),
    Error,
    "reason_required",
  );
});

Deno.test("verifyVolunteer throws bad_decision for an unrecognized decision without touching the DB", async () => {
  const capture = newCapture();
  await assertRejects(
    () =>
      verifyVolunteer(sb({ capture }), claims(), {
        volunteerId: "vol1",
        decision: "bogus",
      } as unknown as Parameters<typeof verifyVolunteer>[2]),
    Error,
    "bad_decision",
  );
  assertEquals(capture.deletes.length, 0);
  assertEquals(capture.logs.length, 0);
  assertEquals(capture.update, undefined);

  // Empty string must not fall through to the reject path either.
  const capture2 = newCapture();
  await assertRejects(
    () =>
      verifyVolunteer(sb({ capture: capture2 }), claims(), {
        volunteerId: "vol1",
        decision: "",
      } as unknown as Parameters<typeof verifyVolunteer>[2]),
    Error,
    "bad_decision",
  );
  assertEquals(capture2.deletes.length, 0);
  assertEquals(capture2.logs.length, 0);
});

Deno.test("verifyVolunteer throws not_found for an unknown volunteerId", async () => {
  await assertRejects(
    () => verifyVolunteer(sb({ volunteer: null }), claims(), { volunteerId: "missing", decision: "verify" }),
    Error,
    "not_found",
  );
});
