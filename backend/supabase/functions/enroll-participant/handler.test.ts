import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { enrollParticipant } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const staffClaims = (orgId: string, permission: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  canVerifyIdentity: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: [permission] }],
});

Deno.test("enrollParticipant creates a participation row with no application_id and logs the action under the caller's own staffId", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const realStaffId = crypto.randomUUID();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user!.id, full_name: "Enroll Test", email: `enroll-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`, dob: "1999-01-01", gender: "male",
    city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Test Uni", degree_program: "BSCS",
  }).select("id").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Direct Enroll Opp", type: "event",
  }).select("id").single();

  const result = await enrollParticipant(supabase, staffClaims(orgId, "participation:write", realStaffId), {
    organizationId: orgId, opportunityId: opportunity!.id, volunteerId: volunteer!.id,
  });

  const { data: row } = await supabase.from("participation").select("application_id, status").eq("id", result.participationId).single();
  assertEquals(row!.application_id, null);
  assertEquals(row!.status, "selected");

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", result.participationId)
    .eq("action", "participant_enrolled");
  assertEquals(logRows?.length, 1);
  assertEquals(logRows![0].staff_id, realStaffId);
});

Deno.test("enrollParticipant rejects an opportunityId that belongs to a different org than the caller's", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user!.id, full_name: "Enroll Cross Tenant Test",
    email: `enroll-cross-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`, dob: "1999-01-01", gender: "male",
    city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Test Uni", degree_program: "BSCS",
  }).select("id").single();
  // The opportunity belongs to otherOrgId, but the caller claims (and genuinely
  // holds participation:write for) orgId.
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: otherOrgId, name: "Foreign Org Opp", type: "event",
  }).select("id").single();

  await assertRejects(
    () => enrollParticipant(supabase, staffClaims(orgId, "participation:write"), {
      organizationId: orgId, opportunityId: opportunity!.id, volunteerId: volunteer!.id,
    }),
    Error,
    "forbidden",
  );

  const { data: participationRows } = await supabase
    .from("participation")
    .select("id")
    .eq("volunteer_id", volunteer!.id);
  assertEquals(participationRows?.length, 0);

  // No org_volunteer_index link may have been minted for the claimed org.
  const { data: indexRows } = await supabase
    .from("org_volunteer_index")
    .select("organization_id")
    .eq("volunteer_id", volunteer!.id);
  assertEquals(indexRows?.length, 0);
});

Deno.test("enrollParticipant rejects staff without participation:write for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user!.id, full_name: "Enroll Reject Test", email: `enroll-reject-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`, dob: "1999-01-01", gender: "male",
    city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Test Uni", degree_program: "BSCS",
  }).select("id").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Direct Enroll Opp", type: "event",
  }).select("id").single();

  await assertRejects(
    () => enrollParticipant(supabase, staffClaims(orgId, "participation:update"), {
      organizationId: orgId, opportunityId: opportunity!.id, volunteerId: volunteer!.id,
    }),
    Error,
    "forbidden",
  );
});
