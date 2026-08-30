import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { getKpiSummary } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function claims(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, canVerifyIdentity: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: ["volunteers:read"] }],
  };
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>, city: string, status = "active") {
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `kpi-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "KPI Test Volunteer",
    email: `kpi-${crypto.randomUUID()}@example.com`, phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01", gender: "female", city, province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS", status,
  }).select("id").single();
  return data!.id as string;
}

Deno.test("getKpiSummary computes every metric scoped to the given org only", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(), name: "KPI Test Org", slug: `kpi-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  const { data: otherOrg } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(), name: "KPI Other Org", slug: `kpi-other-${crypto.randomUUID()}`,
  }).select("id").single();
  const otherOrgId = otherOrg!.id as string;

  const lahoreVolunteer = await makeVolunteer(supabase, "Lahore");
  const karachiVolunteer = await makeVolunteer(supabase, "Karachi", "inactive");
  const otherOrgVolunteer = await makeVolunteer(supabase, "Lahore");

  await supabase.from("org_volunteer_index").insert([
    { organization_id: orgId, volunteer_id: lahoreVolunteer },
    { organization_id: orgId, volunteer_id: karachiVolunteer },
    { organization_id: otherOrgId, volunteer_id: otherOrgVolunteer },
  ]);

  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "KPI Test Opp", type: "environment",
  }).select("id").single();
  const opportunityId = opportunity!.id as string;

  await supabase.from("applications").insert([
    { volunteer_id: lahoreVolunteer, opportunity_id: opportunityId, organization_id: orgId, status: "selected" },
    { volunteer_id: karachiVolunteer, opportunity_id: opportunityId, organization_id: orgId, status: "submitted" },
  ]);

  const { data: participation } = await supabase.from("participation").insert({
    volunteer_id: lahoreVolunteer, opportunity_id: opportunityId, organization_id: orgId, status: "completed",
  }).select("id").single();

  await supabase.from("activity_hours").insert({
    participation_id: participation!.id, volunteer_id: lahoreVolunteer, opportunity_id: opportunityId,
    organization_id: orgId, activity_date: "2026-02-01", hours_submitted: 4, hours_verified: 4, verification_status: "verified",
  });

  const result = await getKpiSummary(supabase, claims(orgId), { organizationId: orgId });

  assertEquals(result.totalRegistered, 2);
  assertEquals(result.active, 1);
  assertEquals(result.completedParticipations, 1);
  assertEquals(result.applicationsReceived, 2);
  assertEquals(result.selected, 1);
  assertEquals(result.totalVerifiedHours, 4);
  assertEquals(result.byCity["Lahore"], 1);
  assertEquals(result.byCity["Karachi"], 1);
  assertEquals(result.participationByOpportunity["KPI Test Opp"], 1);
  assertEquals(result.participationByActivityType["environment"], 1);
});

Deno.test("getKpiSummary rejects a caller without volunteers:read for this org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const noPerm: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, canVerifyIdentity: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(() => getKpiSummary(supabase, noPerm, { organizationId: orgId }), Error, "forbidden");
});
