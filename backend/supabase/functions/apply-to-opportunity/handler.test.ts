import { assertEquals, assertRejects } from "jsr:@std/assert";
import { applyToOpportunity } from "./handler.ts";

const form = {
  version: 1,
  fields: [
    { id: "why", type: "long_text", label: "Why", required: true },
    { id: "consent", type: "checkbox", label: "I confirm", required: true },
    { id: "cv", type: "file", label: "CV", maxFiles: 1 },
  ],
};

interface SbOpts {
  oppForm?: unknown;
  volunteer?: Record<string, unknown>;
  existingApp?: Record<string, unknown> | null;
  deactivatedAt?: string | null;
  statusOverride?: string | null;
  applicationDeadline?: string | null;
  capture?: { application?: Record<string, unknown>; updatedApp?: Record<string, unknown> };
}

function sb(opts: SbOpts = {}) {
  const volunteer = opts.volunteer ??
    { id: "v1", full_name: "Ayesha", email: "a@b.com", phone: "123", id_doc_number: "35202-1" };
  return {
    from(table: string) {
      const api = {
        select() { return api; },
        eq() { return api; },
        or() { return api; },
        in() { return api; },
        is() { return api; },
        async maybeSingle() {
          if (table === "applications") return { data: opts.existingApp ?? null, error: null };
          return { data: null, error: null };
        },
        async single() {
          if (table === "opportunities") {
            return {
              data: {
                id: "opp1",
                organization_id: "org1",
                deactivated_at: opts.deactivatedAt ?? null,
                status_override: opts.statusOverride ?? null,
                application_deadline: opts.applicationDeadline ?? null,
                application_open_at: null,
                activity_start_at: null,
                activity_end_at: null,
                application_form: opts.oppForm ?? form,
              },
              error: null,
            };
          }
          if (table === "volunteers") return { data: volunteer, error: null };
          if (table === "applications") return { data: { id: "app-new" }, error: null };
          return { data: null, error: null };
        },
        insert(payload: Record<string, unknown>) {
          if (table === "applications" && opts.capture) opts.capture.application = payload;
          return { select() { return { async single() { return { data: { id: "app-new" }, error: null }; } }; } };
        },
        update(payload: Record<string, unknown>) {
          if (table === "applications" && opts.capture) opts.capture.updatedApp = payload;
          return {
            eq() {
              return { select() { return { async single() { return { data: { id: "app-updated" }, error: null }; } }; } };
            },
          };
        },
        async then(res: (v: unknown) => void) { res({ error: null }); },
      };
      return api;
    },
    async rpc() { return { error: null }; },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

Deno.test("422 with fieldErrors when a required answer is missing", async () => {
  const err = await assertRejects(
    () => applyToOpportunity(sb(), { volunteerId: "v1", authUserId: "u1", opportunityId: "opp1", answers: {} }),
    Error,
    "validation",
  );
  assertEquals(typeof (err as Error & { fieldErrors: Record<string, string> }).fieldErrors.why, "string");
});

Deno.test("requires the volunteer to have an id doc on file", async () => {
  await assertRejects(
    () =>
      applyToOpportunity(
        sb({ volunteer: { id: "v1", full_name: "A", email: "a@b.com", phone: "1", id_doc_number: null } }),
        { volunteerId: "v1", authUserId: "u1", opportunityId: "opp1", answers: { why: "x", consent: true } },
      ),
    Error,
    "id_doc_required",
  );
});

Deno.test("rejects an application to a deactivated opportunity", async () => {
  await assertRejects(
    () =>
      applyToOpportunity(sb({ deactivatedAt: "2026-01-01T00:00:00Z" }), {
        volunteerId: "v1",
        authUserId: "u1",
        opportunityId: "opp1",
        answers: { why: "I care", consent: true },
      }),
    Error,
    "opportunity_unavailable",
  );
});

Deno.test("rejects an application when opportunity status is closed", async () => {
  await assertRejects(
    () =>
      applyToOpportunity(sb({ statusOverride: "closed" }), {
        volunteerId: "v1",
        authUserId: "u1",
        opportunityId: "opp1",
        answers: { why: "I care", consent: true },
      }),
    Error,
    "opportunity_unavailable",
  );
});

Deno.test("rejects an application when application deadline has passed", async () => {
  await assertRejects(
    () =>
      applyToOpportunity(sb({ applicationDeadline: "2020-01-01T00:00:00Z" }), {
        volunteerId: "v1",
        authUserId: "u1",
        opportunityId: "opp1",
        answers: { why: "I care", consent: true },
      }),
    Error,
    "opportunity_unavailable",
  );
});

Deno.test("rejects referenced attachments that are not this user's ready application files", async () => {
  await assertRejects(
    () =>
      applyToOpportunity(sb(), {
        volunteerId: "v1",
        authUserId: "u1",
        opportunityId: "opp1",
        answers: { why: "I care", consent: true },
        attachmentIds: ["att-1"],
      }),
    Error,
    "bad_attachment",
  );
});

Deno.test("rejects if a non-draft application already exists", async () => {
  await assertRejects(
    () =>
      applyToOpportunity(sb({ existingApp: { id: "app-1", status: "pending_review" } }), {
        volunteerId: "v1",
        authUserId: "u1",
        opportunityId: "opp1",
        answers: { why: "I care", consent: true },
      }),
    Error,
    "already_applied",
  );
});

Deno.test("updates existing draft application to pending_review", async () => {
  const capture: { updatedApp?: Record<string, unknown> } = {};
  const r = await applyToOpportunity(
    sb({ existingApp: { id: "app-draft-1", status: "draft" }, capture }),
    {
      volunteerId: "v1",
      authUserId: "u1",
      opportunityId: "opp1",
      answers: { why: "I care", consent: true },
    },
  );
  assertEquals(r.applicationId, "app-updated");
  assertEquals(capture.updatedApp?.status, "pending_review");
  assertEquals(capture.updatedApp?.applicant_name, "Ayesha");
});

Deno.test("happy path snapshots the form and promotes the applicant columns", async () => {
  const capture: { application?: Record<string, unknown> } = {};
  const r = await applyToOpportunity(sb({ capture }), {
    volunteerId: "v1",
    authUserId: "u1",
    opportunityId: "opp1",
    answers: { why: "I care", consent: true },
  });
  assertEquals(r.applicationId, "app-new");

  const app = capture.application!;
  assertEquals(app.organization_id, "org1");
  assertEquals(app.answers, { why: "I care", consent: true });
  assertEquals(app.form_snapshot, form);
  assertEquals(app.applicant_name, "Ayesha");
  assertEquals(app.applicant_email, "a@b.com");
  assertEquals(app.applicant_phone, "123");
  assertEquals(app.consent_accepted, true);
});
