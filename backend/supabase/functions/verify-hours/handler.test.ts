import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { verifyHours } from "./handler.ts";
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
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function makeActivityHours(supabase: ReturnType<typeof testClient>, volunteerOverrides: Record<string, unknown> = {}) {
  const orgId = crypto.randomUUID();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user!.id,
    full_name: "Verify Hours Test",
    email: `verify-hours-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "male",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    institution: "Test Uni",
    degree_program: "BSCS",
    ...volunteerOverrides,
  }).select("id").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Verify Test Opp", type: "event",
  }).select("id").single();
  const { data: participation } = await supabase.from("participation").insert({
    volunteer_id: volunteer!.id, opportunity_id: opportunity!.id, organization_id: orgId,
  }).select("id").single();
  const { data: hours } = await supabase.from("activity_hours").insert({
    participation_id: participation!.id, volunteer_id: volunteer!.id, opportunity_id: opportunity!.id,
    organization_id: orgId, activity_date: "2026-08-01", hours_submitted: 5,
  }).select("id").single();

  return { activityHoursId: hours!.id as string, orgId };
}

const staffClaims = (orgId: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: ["hours:update"] }],
});

Deno.test("verifyHours verifying sets hours_verified and status", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase);

  await verifyHours(supabase, staffClaims(orgId), {
    activityHoursId, decision: "verified", hoursVerified: 5,
  }, new FakeEmailClient());

  const { data: row } = await supabase.from("activity_hours").select("verification_status, hours_verified").eq("id", activityHoursId).single();
  assertEquals(row!.verification_status, "verified");
  assertEquals(row!.hours_verified, 5);
});

Deno.test("verifyHours rejecting retains the row with a reason", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase);

  await verifyHours(supabase, staffClaims(orgId), {
    activityHoursId, decision: "rejected", rejectionReason: "No proof of attendance",
  }, new FakeEmailClient());

  const { data: row } = await supabase.from("activity_hours").select("verification_status, rejection_reason").eq("id", activityHoursId).single();
  assertEquals(row!.verification_status, "rejected");
  assertEquals(row!.rejection_reason, "No proof of attendance");
});

Deno.test("verifyHours sets verified_by and admin_action_log.staff_id from the caller's own staffId, never a client-supplied value", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase);
  const realStaffId = crypto.randomUUID();

  await verifyHours(supabase, staffClaims(orgId, realStaffId), {
    activityHoursId, decision: "verified", hoursVerified: 5,
  }, new FakeEmailClient());

  const { data: row } = await supabase.from("activity_hours").select("verified_by").eq("id", activityHoursId).single();
  assertEquals(row!.verified_by, realStaffId);

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("staff_id")
    .eq("target_id", activityHoursId)
    .eq("action", "hours_decided");
  assertEquals(logRows![0].staff_id, realStaffId);
});

Deno.test("verifyHours sends a status-change email to the volunteer", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase);
  const emailClient = new FakeEmailClient();

  await verifyHours(supabase, staffClaims(orgId), {
    activityHoursId, decision: "verified", hoursVerified: 5,
  }, emailClient);

  assertEquals(emailClient.sent.length, 1);
});

Deno.test("verifyHours escapes a volunteer's full_name before interpolating it into the email HTML", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase, {
    full_name: '<img src=x onerror=alert(1)>Evil<script>alert(2)</script>',
  });
  const emailClient = new FakeEmailClient();

  await verifyHours(supabase, staffClaims(orgId), {
    activityHoursId, decision: "verified", hoursVerified: 5,
  }, emailClient);

  assertEquals(emailClient.sent.length, 1);
  const html = emailClient.sent[0].html;
  assertEquals(html.includes("<script>"), false);
  assertEquals(html.includes("<img"), false);
  assertEquals(html.includes("&lt;script&gt;"), true);
});

Deno.test("verifyHours completes successfully when the email send throws — the committed state change is still reported as success", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase);
  const realStaffId = crypto.randomUUID();
  const emailClient = new ThrowingEmailClient();

  // Must not throw: by the time the send is attempted, the verification status
  // and admin_action_log entry have already committed.
  await verifyHours(supabase, staffClaims(orgId, realStaffId), {
    activityHoursId, decision: "verified", hoursVerified: 5,
  }, emailClient);

  assertEquals(emailClient.attempts, 1);

  const { data: row } = await supabase
    .from("activity_hours")
    .select("verification_status, verified_by")
    .eq("id", activityHoursId)
    .single();
  assertEquals(row!.verification_status, "verified");
  assertEquals(row!.verified_by, realStaffId);

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("id")
    .eq("target_id", activityHoursId)
    .eq("action", "hours_decided");
  assertEquals(logRows?.length, 1);
});
