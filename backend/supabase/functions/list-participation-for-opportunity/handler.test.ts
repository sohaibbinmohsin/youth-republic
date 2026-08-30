import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listParticipationForOpportunity } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function claims(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, canVerifyIdentity: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: ["participation:read"] }],
  };
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>, name: string) {
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `participation-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: name,
    email: `participation-${crypto.randomUUID()}@example.com`, phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();
  return data!.id as string;
}

Deno.test("listParticipationForOpportunity returns applicants (from applications) and participants (from participation) separately", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(), name: "Participation Test Org", slug: `participation-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Participation Test Opp", type: "environment",
  }).select("id").single();
  const opportunityId = opportunity!.id as string;

  const applicantOnlyId = await makeVolunteer(supabase, "Applicant Only");
  const selectedId = await makeVolunteer(supabase, "Selected Volunteer");

  await supabase.from("applications").insert([
    { volunteer_id: applicantOnlyId, opportunity_id: opportunityId, organization_id: orgId, status: "submitted" },
    { volunteer_id: selectedId, opportunity_id: opportunityId, organization_id: orgId, status: "selected" },
  ]);
  await supabase.from("participation").insert({
    volunteer_id: selectedId, opportunity_id: opportunityId, organization_id: orgId, status: "participating",
  });

  const result = await listParticipationForOpportunity(supabase, claims(orgId), { organizationId: orgId, opportunityId });

  assertEquals(result.applicants.length, 2);
  assertEquals(result.participants.length, 1);
  assertEquals(result.participants[0].volunteerName, "Selected Volunteer");
});

Deno.test("listParticipationForOpportunity rejects a caller without participation:read for this org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const noPerm: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, canVerifyIdentity: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(
    () => listParticipationForOpportunity(supabase, noPerm, { organizationId: orgId, opportunityId: crypto.randomUUID() }),
    Error,
    "forbidden",
  );
});
