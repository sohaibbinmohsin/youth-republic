import { assertEquals, assertRejects, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { exportApplicationsCsv, exportVolunteersCsv, exportOpportunitiesCsv, exportActivityHoursCsv } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const staffClaims = (orgId: string): StaffClaims => ({
  actorType: "staff",
  staffId: crypto.randomUUID(),
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["applications:read"] }],
});

Deno.test("exportApplicationsCsv includes a header row and one row per application", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user!.id, full_name: "CSV Test", email: `csv-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`, dob: "1999-01-01", gender: "male",
    city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Test Uni", degree_program: "BSCS",
  }).select("id, volunteer_code").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "CSV Opp", type: "event",
  }).select("id, name").single();
  await supabase.from("applications").insert({
    volunteer_id: volunteer!.id, opportunity_id: opportunity!.id, organization_id: orgId,
  });

  const csv = await exportApplicationsCsv(supabase, staffClaims(orgId), orgId);
  const lines = csv.trim().split("\n");

  assertEquals(lines[0], "volunteer_code,full_name,email,opportunity_name,status,applied_at");
  assertEquals(lines.length, 2);
  assertEquals(lines[1].includes(volunteer!.volunteer_code), true);
});

Deno.test("exportApplicationsCsv neutralizes a leading formula character in an exported field", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user!.id, full_name: "=cmd|'/c calc'!A0", email: `csv-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`, dob: "1999-01-01", gender: "male",
    city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Test Uni", degree_program: "BSCS",
  }).select("id, volunteer_code").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "+1+cmd|'/c calc'!A0", type: "event",
  }).select("id, name").single();
  await supabase.from("applications").insert({
    volunteer_id: volunteer!.id, opportunity_id: opportunity!.id, organization_id: orgId,
  });

  const csv = await exportApplicationsCsv(supabase, staffClaims(orgId), orgId);
  const lines = csv.trim().split("\n");

  // Opening a CSV where a cell's actual content starts with =, +, -, or @
  // in Excel/Sheets executes it as a formula. Quoting the field (the
  // pre-existing CSV escaping) does not prevent this -- neutralizing it
  // requires prefixing the value itself, e.g. with a leading single quote.
  assertEquals(lines[1].includes('"=cmd'), false);
  assertEquals(lines[1].includes('"\'=cmd'), true);
  assertEquals(lines[1].includes('"+1+cmd'), false);
  assertEquals(lines[1].includes('"\'+1+cmd'), true);
});

Deno.test("exportApplicationsCsv rejects staff without applications:read for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();

  await assertRejects(() => exportApplicationsCsv(supabase, staffClaims(otherOrgId), orgId), Error, "forbidden");
});

const volunteersReadClaims = (orgId: string): StaffClaims => ({
  actorType: "staff",
  staffId: crypto.randomUUID(),
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["volunteers:read"] }],
});

Deno.test("exportVolunteersCsv includes a header row and one row per volunteer linked to the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user!.id, full_name: "CSV Volunteer Test", email: `csv-vol-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`, dob: "1999-01-01", gender: "male",
    city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Test Uni", degree_program: "BSCS",
  }).select("id, volunteer_code").single();
  await supabase.rpc("touch_org_volunteer_index", { p_org_id: orgId, p_volunteer_id: volunteer!.id });

  const csv = await exportVolunteersCsv(supabase, volunteersReadClaims(orgId), orgId);
  const lines = csv.trim().split("\n");

  assertEquals(lines[0], "volunteer_code,full_name,email,phone,city,province,institution,status");
  assertEquals(lines.length, 2);
  assertEquals(lines[1].includes(volunteer!.volunteer_code), true);
});

Deno.test("exportVolunteersCsv neutralizes a leading formula character in an exported field", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user!.id, full_name: "@SUM(1+1)", email: `csv-vol-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`, dob: "1999-01-01", gender: "male",
    city: "-1+1", province: "Punjab", country: "Pakistan", institution: "Test Uni", degree_program: "BSCS",
  }).select("id, volunteer_code").single();
  await supabase.rpc("touch_org_volunteer_index", { p_org_id: orgId, p_volunteer_id: volunteer!.id });

  const csv = await exportVolunteersCsv(supabase, volunteersReadClaims(orgId), orgId);
  const lines = csv.trim().split("\n");

  assertEquals(lines[1].includes('"@SUM'), false);
  assertEquals(lines[1].includes('"\'@SUM'), true);
  assertEquals(lines[1].includes('"-1+1'), false);
  assertEquals(lines[1].includes('"\'-1+1'), true);
});

Deno.test("exportVolunteersCsv rejects staff without volunteers:read for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();

  await assertRejects(() => exportVolunteersCsv(supabase, volunteersReadClaims(otherOrgId), orgId), Error, "forbidden");
});

Deno.test("exportOpportunitiesCsv includes name, type, and computed capacity for the org's opportunities", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(), name: "Export Opportunities Test Org", slug: `export-opps-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Export Test Opp", type: "environment", capacity: 20,
  });
  const claims: StaffClaims = {
    actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["opportunities:read"] }],
  };

  const csv = await exportOpportunitiesCsv(supabase, claims, orgId);

  assertStringIncludes(csv, "name,type,capacity");
  assertStringIncludes(csv, "Export Test Opp");
  assertStringIncludes(csv, "environment");
});

Deno.test("exportOpportunitiesCsv rejects a caller without opportunities:read", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const claims: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(() => exportOpportunitiesCsv(supabase, claims, orgId), Error, "forbidden");
});

Deno.test("exportActivityHoursCsv includes volunteer, opportunity, hours, and status for the org's activity", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(), name: "Export Hours Test Org", slug: `export-hours-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `export-hours-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "Export Hours Volunteer",
    email: `export-hours-${crypto.randomUUID()}@example.com`, phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Export Hours Opp", type: "environment",
  }).select("id").single();
  const { data: participation } = await supabase.from("participation").insert({
    volunteer_id: volunteer!.id, opportunity_id: opportunity!.id, organization_id: orgId, status: "completed",
  }).select("id").single();
  await supabase.from("activity_hours").insert({
    participation_id: participation!.id, volunteer_id: volunteer!.id, opportunity_id: opportunity!.id, organization_id: orgId,
    activity_date: "2026-02-01", hours_submitted: 5, hours_verified: 5, verification_status: "verified",
  });
  const claims: StaffClaims = {
    actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["hours:read"] }],
  };

  const csv = await exportActivityHoursCsv(supabase, claims, orgId);

  assertStringIncludes(csv, "Export Hours Volunteer");
  assertStringIncludes(csv, "Export Hours Opp");
  assertStringIncludes(csv, "verified");
});
