import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { applyToOpportunity } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>, overrides: Record<string, unknown> = {}) {
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user!.id,
    full_name: "Apply Test",
    email: `apply-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "male",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    institution: "Test Uni",
    degree_program: "BSCS",
    cnic_number: `${Math.floor(Math.random() * 100000000000)}`,
    ...overrides,
  }).select("id").single();
  return data!.id as string;
}

async function makeOpportunity(supabase: ReturnType<typeof testClient>, organizationId: string) {
  const { data } = await supabase.from("opportunities").insert({
    organization_id: organizationId,
    name: "Test Opp",
    type: "event",
  }).select("id").single();
  return data!.id as string;
}

Deno.test("applyToOpportunity creates an application", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const volunteerId = await makeVolunteer(supabase);
  const opportunityId = await makeOpportunity(supabase, orgId);

  const result = await applyToOpportunity(supabase, {
    volunteerId,
    opportunityId,
    organizationId: orgId,
  });

  assertEquals(typeof result.applicationId, "string");
});

Deno.test("applyToOpportunity records the opportunity's real organization_id, not a mismatched client-supplied one", async () => {
  const supabase = testClient();
  const realOrgId = crypto.randomUUID();
  const spoofedOrgId = crypto.randomUUID();
  const volunteerId = await makeVolunteer(supabase);
  const opportunityId = await makeOpportunity(supabase, realOrgId);

  const result = await applyToOpportunity(supabase, {
    volunteerId,
    opportunityId,
    organizationId: spoofedOrgId,
  });

  const { data: application } = await supabase
    .from("applications")
    .select("organization_id")
    .eq("id", result.applicationId)
    .single();
  assertEquals(application!.organization_id, realOrgId);

  // The org_volunteer_index link (which grants staff PII read access) must
  // likewise be minted only for the opportunity's real org.
  const { data: indexRows } = await supabase
    .from("org_volunteer_index")
    .select("organization_id")
    .eq("volunteer_id", volunteerId);
  assertEquals(indexRows?.length, 1);
  assertEquals(indexRows![0].organization_id, realOrgId);
});

Deno.test("applyToOpportunity rejects an application to a deactivated opportunity", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const volunteerId = await makeVolunteer(supabase);
  const opportunityId = await makeOpportunity(supabase, orgId);
  await supabase.from("opportunities")
    .update({ deactivated_at: new Date().toISOString() })
    .eq("id", opportunityId);

  await assertRejects(
    () => applyToOpportunity(supabase, { volunteerId, opportunityId, organizationId: orgId }),
    Error,
    "opportunity_unavailable",
  );

  const { data: applications } = await supabase
    .from("applications")
    .select("id")
    .eq("volunteer_id", volunteerId);
  assertEquals(applications?.length, 0);
});

Deno.test("applyToOpportunity rejects when the volunteer has no cnic_number on file", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const volunteerId = await makeVolunteer(supabase, { cnic_number: null });
  const opportunityId = await makeOpportunity(supabase, orgId);

  await assertRejects(
    () => applyToOpportunity(supabase, { volunteerId, opportunityId, organizationId: orgId }),
    Error,
    "cnic_required",
  );
});
