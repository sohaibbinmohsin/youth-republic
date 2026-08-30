import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { decideApplication } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";
import type { EmailClient } from "../_shared/sendEmail.ts";

class FakeEmailClient implements EmailClient {
  sent: Array<{ to: string; subject: string; html: string }> = [];
  async send(to: string, subject: string, html: string): Promise<void> {
    this.sent.push({ to, subject, html });
  }
}

class ThrowingEmailClient implements EmailClient {
  attempts = 0;
  // deno-lint-ignore require-await
  async send(_to: string, _subject: string, _html: string): Promise<void> {
    this.attempts++;
    throw new Error("resend_send_failed: 500");
  }
}

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeApplication(
  supabase: ReturnType<typeof testClient>,
  organizationId: string,
  volunteerOverrides: Record<string, unknown> = {},
) {
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;

  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user!.id,
    full_name: "Decide Test",
    email: `decide-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "male",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    institution: "Test Uni",
    degree_program: "BSCS",
    emergency_contact: { name: "Parent", phone: "0300-0000000", relation: "parent" },
    ...volunteerOverrides,
  }).select("id").single();

  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: organizationId,
    name: "Decide Test Opp",
    type: "event",
  }).select("id").single();

  const { data: application } = await supabase.from("applications").insert({
    volunteer_id: volunteer!.id,
    opportunity_id: opportunity!.id,
    organization_id: organizationId,
  }).select("id").single();

  return { applicationId: application!.id as string, volunteerId: volunteer!.id as string, opportunityId: opportunity!.id as string };
}

const staffClaims = (orgId: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  canVerifyIdentity: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: ["applications:update"] }],
});

Deno.test("decideApplication selecting an applicant auto-creates participation", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);

  const result = await decideApplication(supabase, staffClaims(orgId), {
    applicationId,
    decision: "selected",
  }, new FakeEmailClient());

  assertEquals(result.participationId !== null, true);

  const { data: application } = await supabase.from("applications").select("status").eq("id", applicationId).single();
  assertEquals(application!.status, "selected");
});

Deno.test("decideApplication re-selecting an already-selected application does not create a duplicate participation row", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);

  const first = await decideApplication(supabase, staffClaims(orgId), {
    applicationId,
    decision: "selected",
  }, new FakeEmailClient());

  const second = await decideApplication(supabase, staffClaims(orgId), {
    applicationId,
    decision: "selected",
  }, new FakeEmailClient());

  assertEquals(second.participationId, first.participationId);

  const { data: rows } = await supabase.from("participation").select("id").eq("application_id", applicationId);
  assertEquals(rows?.length, 1);
});

Deno.test("decideApplication rejects selecting an applicant with no emergency_contact on file", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId, { emergency_contact: null });

  await assertRejects(
    () =>
      decideApplication(supabase, staffClaims(orgId), {
        applicationId,
        decision: "selected",
      }, new FakeEmailClient()),
    Error,
    "emergency_contact_required",
  );
});

Deno.test("decideApplication accepts waitlisted as a decision without creating participation", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);

  const result = await decideApplication(supabase, staffClaims(orgId), {
    applicationId,
    decision: "waitlisted",
  }, new FakeEmailClient());

  assertEquals(result.participationId, null);
  const { data: application } = await supabase.from("applications").select("status").eq("id", applicationId).single();
  assertEquals(application!.status, "waitlisted");
});

Deno.test("decideApplication rejects when staff lacks applications:update for the application's org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);

  await assertRejects(
    () =>
      decideApplication(supabase, staffClaims(otherOrgId), {
        applicationId,
        decision: "selected",
      }, new FakeEmailClient()),
    Error,
    "forbidden",
  );
});

Deno.test("decideApplication writes an admin_action_log entry and applications.decided_by using the caller's own staffId from the token, never a client-supplied value", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);
  const realStaffId = crypto.randomUUID();

  // Regression test: the input object below deliberately has no `staffId` field
  // at all — DecideApplicationInput no longer has one. If a future change
  // reintroduces trusting a client-supplied staffId, TypeScript would need a
  // field here that doesn't exist on the type, and this test would need updating
  // to actually pass one through to prove the spoof — it should not compile as-is.
  await decideApplication(supabase, staffClaims(orgId, realStaffId), {
    applicationId,
    decision: "rejected",
  }, new FakeEmailClient());

  const { data: application } = await supabase.from("applications").select("decided_by").eq("id", applicationId).single();
  assertEquals(application!.decided_by, realStaffId);

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", applicationId)
    .eq("action", "application_decided");

  assertEquals(logRows?.length, 1);
  assertEquals(logRows![0].staff_id, realStaffId);
});

Deno.test("decideApplication sends a status-change email to the volunteer", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId, volunteerId } = await makeApplication(supabase, orgId);
  const { data: volunteer } = await supabase.from("volunteers").select("email").eq("id", volunteerId).single();
  const emailClient = new FakeEmailClient();

  await decideApplication(supabase, staffClaims(orgId), {
    applicationId, decision: "selected",
  }, emailClient);

  assertEquals(emailClient.sent.length, 1);
  assertEquals(emailClient.sent[0].to, volunteer!.email);
});

Deno.test("decideApplication escapes a volunteer's full_name before interpolating it into the email HTML", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId, {
    full_name: '<img src=x onerror=alert(1)>Evil<script>alert(2)</script>',
  });
  const emailClient = new FakeEmailClient();

  await decideApplication(supabase, staffClaims(orgId), {
    applicationId, decision: "selected",
  }, emailClient);

  assertEquals(emailClient.sent.length, 1);
  const html = emailClient.sent[0].html;
  assertEquals(html.includes("<script>"), false);
  assertEquals(html.includes("<img"), false);
  assertEquals(html.includes("&lt;script&gt;"), true);
});

Deno.test("decideApplication completes successfully when the email send throws — the committed state change is still reported as success", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);
  const emailClient = new ThrowingEmailClient();

  // Must not throw: by the time the send is attempted, the application status,
  // participation row and admin_action_log entry have already committed.
  const result = await decideApplication(supabase, staffClaims(orgId), {
    applicationId, decision: "selected",
  }, emailClient);

  assertEquals(emailClient.attempts, 1);
  assertEquals(result.participationId !== null, true);

  const { data: application } = await supabase.from("applications").select("status").eq("id", applicationId).single();
  assertEquals(application!.status, "selected");

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("id")
    .eq("target_id", applicationId)
    .eq("action", "application_decided");
  assertEquals(logRows?.length, 1);
});
