import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listVolunteers } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeOrg(supabase: ReturnType<typeof testClient>) {
  const { data } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(),
    name: "List Volunteers Test Org",
    slug: `list-volunteers-${crypto.randomUUID()}`,
  }).select("id").single();
  return data!.id as string;
}

async function makeVolunteer(
  supabase: ReturnType<typeof testClient>,
  overrides: Partial<{ full_name: string; city: string; province: string; institution: string; status: string }> = {},
) {
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `list-volunteers-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError || !authUser.user) throw new Error(`failed to create auth user: ${authError?.message}`);
  const email = `list-volunteers-${crypto.randomUUID()}@example.com`;
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user.id,
    full_name: overrides.full_name ?? "Test Volunteer",
    email,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "female",
    city: overrides.city ?? "Lahore",
    province: overrides.province ?? "Punjab",
    country: "Pakistan",
    institution: overrides.institution ?? "LUMS",
    degree_program: "BSCS",
    status: overrides.status ?? "active",
  }).select("id").single();
  return data!.id as string;
}

async function linkToOrg(supabase: ReturnType<typeof testClient>, orgId: string, volunteerId: string) {
  await supabase.from("org_volunteer_index").insert({ organization_id: orgId, volunteer_id: volunteerId });
}

function claimsWithPermission(orgId: string, permission: string): StaffClaims {
  return {
    actorType: "staff",
    staffId: "staff-1",
    platformOwner: false,
    canVerifyIdentity: false,
    orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: [permission] }],
  };
}

Deno.test("listVolunteers returns only volunteers linked to the given org", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const otherOrgId = await makeOrg(supabase);
  const inOrgId = await makeVolunteer(supabase, { full_name: "In Org" });
  const otherOrgVolunteerId = await makeVolunteer(supabase, { full_name: "Other Org" });
  await linkToOrg(supabase, orgId, inOrgId);
  await linkToOrg(supabase, otherOrgId, otherOrgVolunteerId);

  const result = await listVolunteers(supabase, claimsWithPermission(orgId, "volunteers:read"), { organizationId: orgId });

  assertEquals(result.volunteers.length, 1);
  assertEquals(result.volunteers[0].id, inOrgId);
});

Deno.test("listVolunteers filters by city, province, institution, and status together", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const match = await makeVolunteer(supabase, { city: "Karachi", province: "Sindh", institution: "IBA", status: "active" });
  const wrongCity = await makeVolunteer(supabase, { city: "Lahore", province: "Sindh", institution: "IBA", status: "active" });
  await linkToOrg(supabase, orgId, match);
  await linkToOrg(supabase, orgId, wrongCity);

  const result = await listVolunteers(supabase, claimsWithPermission(orgId, "volunteers:read"), {
    organizationId: orgId, city: "Karachi", province: "Sindh", institution: "IBA", status: "active",
  });

  assertEquals(result.volunteers.length, 1);
  assertEquals(result.volunteers[0].id, match);
});

Deno.test("listVolunteers searches by name, email, or phone", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const target = await makeVolunteer(supabase, { full_name: "Aisha Khan Searchable" });
  const other = await makeVolunteer(supabase, { full_name: "Unrelated Person" });
  await linkToOrg(supabase, orgId, target);
  await linkToOrg(supabase, orgId, other);

  const result = await listVolunteers(supabase, claimsWithPermission(orgId, "volunteers:read"), {
    organizationId: orgId, search: "Searchable",
  });

  assertEquals(result.volunteers.length, 1);
  assertEquals(result.volunteers[0].id, target);
});

Deno.test("listVolunteers paginates with limit/offset and reports total across all pages", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  for (let i = 0; i < 3; i++) {
    const id = await makeVolunteer(supabase, { full_name: `Page Test ${i}` });
    await linkToOrg(supabase, orgId, id);
  }

  const page1 = await listVolunteers(supabase, claimsWithPermission(orgId, "volunteers:read"), {
    organizationId: orgId, limit: 2, offset: 0,
  });
  const page2 = await listVolunteers(supabase, claimsWithPermission(orgId, "volunteers:read"), {
    organizationId: orgId, limit: 2, offset: 2,
  });

  assertEquals(page1.volunteers.length, 2);
  assertEquals(page1.total, 3);
  assertEquals(page2.volunteers.length, 1);
  assertEquals(page2.total, 3);
});

Deno.test("listVolunteers includes an applicant who has no org_volunteer_index row", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const applicantId = await makeVolunteer(supabase, { full_name: "Index-less Applicant" });
  const { data: opp } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "LV Applicant Opp", type: "environment",
  }).select("id").single();
  await supabase.from("applications").insert({
    volunteer_id: applicantId, opportunity_id: opp!.id, organization_id: orgId, status: "pending_review",
  });

  const result = await listVolunteers(supabase, claimsWithPermission(orgId, "volunteers:read"), { organizationId: orgId });

  assertEquals(result.volunteers.map((v) => v.id), [applicantId]);
});

Deno.test("listVolunteers excludes a volunteer whose only application for the org is a draft", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const draftOnlyId = await makeVolunteer(supabase, { full_name: "Draft Only" });
  const { data: opp } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "LV Draft Opp", type: "environment",
  }).select("id").single();
  await supabase.from("applications").insert({
    volunteer_id: draftOnlyId, opportunity_id: opp!.id, organization_id: orgId, status: "draft",
  });

  const result = await listVolunteers(supabase, claimsWithPermission(orgId, "volunteers:read"), { organizationId: orgId });

  assertEquals(result.volunteers.length, 0);
});

Deno.test("listVolunteers rejects a caller without volunteers:read for this org", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const claims: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, canVerifyIdentity: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(() => listVolunteers(supabase, claims, { organizationId: orgId }), Error, "forbidden");
});
