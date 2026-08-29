import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listApplications } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function claims(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["applications:read"] }],
  };
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>) {
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `list-apps-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "List Apps Volunteer",
    email: `list-apps-${crypto.randomUUID()}@example.com`, phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();
  return data!.id as string;
}

Deno.test("listApplications filters by opportunity and status together", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(), name: "List Applications Test Org", slug: `list-apps-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  const { data: opp1 } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Opp 1", type: "environment",
  }).select("id").single();
  const { data: opp2 } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Opp 2", type: "environment",
  }).select("id").single();
  const volunteerId = await makeVolunteer(supabase);

  await supabase.from("applications").insert([
    { volunteer_id: volunteerId, opportunity_id: opp1!.id, organization_id: orgId, status: "submitted" },
    { volunteer_id: volunteerId, opportunity_id: opp2!.id, organization_id: orgId, status: "selected" },
  ]);

  const result = await listApplications(supabase, claims(orgId), {
    organizationId: orgId, opportunityId: opp1!.id as string,
  });

  assertEquals(result.applications.length, 1);
  assertEquals(result.applications[0].opportunityName, "Opp 1");
});

Deno.test("listApplications rejects a caller without applications:read for this org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const noPerm: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(() => listApplications(supabase, noPerm, { organizationId: orgId }), Error, "forbidden");
});
