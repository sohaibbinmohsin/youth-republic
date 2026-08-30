import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { bulkAssignHours } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function makeParticipants(supabase: ReturnType<typeof testClient>, orgId: string, opportunityId: string, count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: `auth-${crypto.randomUUID()}@example.com`,
      email_confirm: true,
    });
    if (authError) throw authError;
    const { data: volunteer } = await supabase.from("volunteers").insert({
      auth_user_id: authUser.user!.id,
      full_name: `Bulk Test ${i}`,
      email: `bulk-${crypto.randomUUID()}@example.com`,
      phone: `0300-${Math.floor(Math.random() * 10000000)}`,
      dob: "1999-01-01", gender: "male", city: "Lahore", province: "Punjab", country: "Pakistan",
      institution: "Test Uni", degree_program: "BSCS",
    }).select("id").single();
    const { data: participation } = await supabase.from("participation").insert({
      volunteer_id: volunteer!.id, opportunity_id: opportunityId, organization_id: orgId,
    }).select("id").single();
    ids.push(participation!.id as string);
  }
  return ids;
}

const staffClaims = (orgId: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  canVerifyIdentity: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: ["hours:write"] }],
});

Deno.test("bulkAssignHours creates one activity_hours row per participant", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Bulk Opp", type: "event",
  }).select("id").single();
  const participationIds = await makeParticipants(supabase, orgId, opportunity!.id, 3);

  const result = await bulkAssignHours(supabase, staffClaims(orgId), {
    organizationId: orgId, opportunityId: opportunity!.id, activityDate: "2026-08-01",
    hoursSubmitted: 4, participationIds,
  });

  assertEquals(result.createdCount, 3);
});

Deno.test("bulkAssignHours silently excludes participation ids belonging to a different org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Bulk Opp Cross-Tenant", type: "event",
  }).select("id").single();
  const { data: otherOpportunity } = await supabase.from("opportunities").insert({
    organization_id: otherOrgId, name: "Other Org Opp", type: "event",
  }).select("id").single();

  const ownIds = await makeParticipants(supabase, orgId, opportunity!.id, 2);
  const foreignIds = await makeParticipants(supabase, otherOrgId, otherOpportunity!.id, 2);

  const result = await bulkAssignHours(supabase, staffClaims(orgId), {
    organizationId: orgId, opportunityId: opportunity!.id, activityDate: "2026-08-01",
    hoursSubmitted: 4, participationIds: [...ownIds, ...foreignIds],
  });

  assertEquals(result.createdCount, 2);

  const { data: foreignHours } = await supabase
    .from("activity_hours")
    .select("id")
    .in("participation_id", foreignIds);
  assertEquals(foreignHours?.length, 0);
});

Deno.test("bulkAssignHours rejects an opportunityId that belongs to a different org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();
  const { data: ownOpportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Bulk Opp Own", type: "event",
  }).select("id").single();
  const { data: foreignOpportunity } = await supabase.from("opportunities").insert({
    organization_id: otherOrgId, name: "Bulk Opp Foreign", type: "event",
  }).select("id").single();
  const participationIds = await makeParticipants(supabase, orgId, ownOpportunity!.id, 1);

  await assertRejects(
    () =>
      bulkAssignHours(supabase, staffClaims(orgId), {
        organizationId: orgId, opportunityId: foreignOpportunity!.id, activityDate: "2026-08-01",
        hoursSubmitted: 4, participationIds,
      }),
    Error,
    "forbidden",
  );
});

Deno.test("bulkAssignHours rejects staff without hours:write in the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Bulk Opp 2", type: "event",
  }).select("id").single();
  const participationIds = await makeParticipants(supabase, orgId, opportunity!.id, 1);

  await assertRejects(
    () =>
      bulkAssignHours(supabase, staffClaims(otherOrgId), {
        organizationId: orgId, opportunityId: opportunity!.id, activityDate: "2026-08-01",
        hoursSubmitted: 4, participationIds,
      }),
    Error,
    "forbidden",
  );
});

Deno.test("bulkAssignHours attributes admin_action_log to the caller's own staffId, never a client-supplied value", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const realStaffId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Bulk Opp 3", type: "event",
  }).select("id").single();
  const participationIds = await makeParticipants(supabase, orgId, opportunity!.id, 1);

  await bulkAssignHours(supabase, staffClaims(orgId, realStaffId), {
    organizationId: orgId, opportunityId: opportunity!.id, activityDate: "2026-08-01",
    hoursSubmitted: 4, participationIds,
  });

  const { data: hourRows } = await supabase
    .from("activity_hours")
    .select("id")
    .in("participation_id", participationIds);
  const hourIds = (hourRows ?? []).map((r) => r.id as string);

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("staff_id")
    .in("target_id", hourIds)
    .eq("action", "bulk_hours_assigned");
  assertEquals(logRows!.length, 1);
  assertEquals(logRows![0].staff_id, realStaffId);
});

Deno.test("bulkAssignHours logs one bulk_hours_assigned row per created activity_hours row", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Bulk Opp 4", type: "event",
  }).select("id").single();
  const participationIds = await makeParticipants(supabase, orgId, opportunity!.id, 3);

  await bulkAssignHours(supabase, staffClaims(orgId), {
    organizationId: orgId, opportunityId: opportunity!.id, activityDate: "2026-08-01",
    hoursSubmitted: 4, participationIds,
  });

  const { data: hourRows } = await supabase
    .from("activity_hours")
    .select("id")
    .in("participation_id", participationIds);
  const hourIds = (hourRows ?? []).map((r) => r.id as string);
  assertEquals(hourIds.length, 3);

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("target_type, target_id, organization_id, metadata, action")
    .in("target_id", hourIds)
    .eq("action", "bulk_hours_assigned");
  assertEquals(logRows!.length, 3);
  for (const log of logRows!) {
    assertEquals(log.target_type, "activity_hours");
    assertEquals(log.organization_id, orgId);
    assertEquals(log.metadata, { activity_date: "2026-08-01", hours_submitted: 4 });
  }
});
