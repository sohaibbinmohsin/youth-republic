import { assertEquals, assertRejects } from "jsr:@std/assert";
import { updateOpportunityForm } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

const staffClaims = (orgId: string, permission: string, staffId = "staff-1"): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  canVerifyIdentity: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: [permission] }],
});

interface SbOpts {
  opportunity?: Record<string, unknown> | null;
  capture?: { update?: Record<string, unknown>; log?: Record<string, unknown> };
}

function sb(opts: SbOpts = {}) {
  const opportunity = opts.opportunity === undefined
    ? { id: "opp1", organization_id: "org1" }
    : opts.opportunity;
  return {
    from(table: string) {
      const api = {
        select() {
          return api;
        },
        eq() {
          return api;
        },
        // deno-lint-ignore require-await
        async maybeSingle() {
          if (table === "opportunities") return { data: opportunity, error: null };
          return { data: null, error: null };
        },
        update(payload: Record<string, unknown>) {
          if (table === "opportunities" && opts.capture) opts.capture.update = payload;
          return {
            eq() {
              return {
                eq() {
                  return { then: (res: (v: unknown) => void) => res({ error: null }) };
                },
              };
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          if (table === "admin_action_log" && opts.capture) opts.capture.log = payload;
          return { then: (res: (v: unknown) => void) => res({ error: null }) };
        },
      };
      return api;
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

Deno.test("updateOpportunityForm rejects an unknown opportunity with not_found", async () => {
  await assertRejects(
    () =>
      updateOpportunityForm(sb({ opportunity: null }), staffClaims("org1", "opportunities:manage"), {
        opportunityId: "missing",
        form: { version: 1, fields: [] },
      }),
    Error,
    "not_found",
  );
});

Deno.test("updateOpportunityForm rejects staff without opportunities:manage for the opp's org", async () => {
  await assertRejects(
    () =>
      updateOpportunityForm(sb(), staffClaims("org1", "opportunities:read"), {
        opportunityId: "opp1",
        form: { version: 1, fields: [] },
      }),
    Error,
    "forbidden",
  );
});

Deno.test("updateOpportunityForm rejects an invalid form definition with invalid_form", async () => {
  await assertRejects(
    () =>
      updateOpportunityForm(sb(), staffClaims("org1", "opportunities:manage"), {
        opportunityId: "opp1",
        form: { version: 1, fields: [{ type: "bogus" }] },
      }),
    Error,
    "invalid_form",
  );
});

Deno.test("updateOpportunityForm writes the validated form and logs the action with a field_count", async () => {
  const capture: { update?: Record<string, unknown>; log?: Record<string, unknown> } = {};
  const form = {
    version: 1,
    fields: [
      { id: "name", type: "short_text", label: "Full name" },
      { id: "email", type: "email", label: "Email" },
    ],
  };

  const result = await updateOpportunityForm(
    sb({ capture }),
    staffClaims("org1", "opportunities:manage", "real-staff"),
    { opportunityId: "opp1", form },
  );

  assertEquals(result, { ok: true });
  assertEquals(capture.update!.application_form, form);

  const log = capture.log!;
  assertEquals(log.staff_id, "real-staff");
  assertEquals(log.action, "application_form_updated");
  assertEquals(log.target_type, "opportunity");
  assertEquals(log.target_id, "opp1");
  assertEquals(log.organization_id, "org1");
  assertEquals(log.metadata, { field_count: 2 });
});
