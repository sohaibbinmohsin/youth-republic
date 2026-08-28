import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { decideApplication } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

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
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["applications:update"] }],
});

Deno.test("decideApplication selecting an applicant auto-creates participation", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);

  const result = await decideApplication(supabase, staffClaims(orgId), {
    applicationId,
    decision: "selected",
  });

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
  });

  const second = await decideApplication(supabase, staffClaims(orgId), {
    applicationId,
    decision: "selected",
  });

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
      }),
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
  });

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
      }),
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
  });

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
