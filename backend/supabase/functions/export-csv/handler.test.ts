import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { exportApplicationsCsv, exportVolunteersCsv } from "./handler.ts";
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

Deno.test("exportVolunteersCsv rejects staff without volunteers:read for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();

  await assertRejects(() => exportVolunteersCsv(supabase, volunteersReadClaims(otherOrgId), orgId), Error, "forbidden");
});
