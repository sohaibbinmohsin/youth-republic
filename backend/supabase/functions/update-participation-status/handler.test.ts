import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateParticipationStatus } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeParticipation(supabase: ReturnType<typeof testClient>, organizationId: string) {
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user!.id,
    full_name: "Participation Test",
    email: `participation-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "male",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    institution: "Test Uni",
    degree_program: "BSCS",
  }).select("id").single();

  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: organizationId,
    name: "Participation Test Opp",
    type: "event",
  }).select("id").single();

  const { data: participation } = await supabase.from("participation").insert({
    volunteer_id: volunteer!.id,
    opportunity_id: opportunity!.id,
    organization_id: organizationId,
  }).select("id").single();

  return participation!.id as string;
}

const staffClaims = (orgId: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  canVerifyIdentity: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: ["participation:update"] }],
});

async function seedOrg(supabase: ReturnType<typeof testClient>): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("organizations").insert({
    id, name: "Fixture Org", slug: `fixture-${id}`,
  });
  if (error) throw error;
  return id;
}

Deno.test("updateParticipationStatus moves selected to participating", async () => {
  const supabase = testClient();
  const orgId = await seedOrg(supabase);
  const participationId = await makeParticipation(supabase, orgId);

  await updateParticipationStatus(supabase, staffClaims(orgId), {
    participationId,
    status: "participating",
  });

  const { data } = await supabase.from("participation").select("status").eq("id", participationId).single();
  assertEquals(data!.status, "participating");
});

Deno.test("updateParticipationStatus writes an admin_action_log entry attributed to the caller's own staffId", async () => {
  const supabase = testClient();
  const orgId = await seedOrg(supabase);
  const participationId = await makeParticipation(supabase, orgId);
  const realStaffId = crypto.randomUUID();

  await updateParticipationStatus(supabase, staffClaims(orgId, realStaffId), {
    participationId,
    status: "no_show",
  });

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", participationId)
    .eq("action", "participation_status_updated");

  assertEquals(logRows?.length, 1);
  assertEquals(logRows![0].staff_id, realStaffId);
});

Deno.test("updateParticipationStatus rejects when staff lacks participation:update for the org", async () => {
  const supabase = testClient();
  const orgId = await seedOrg(supabase);
  const otherOrgId = await seedOrg(supabase);
  const participationId = await makeParticipation(supabase, orgId);

  await assertRejects(
    () =>
      updateParticipationStatus(supabase, staffClaims(otherOrgId), {
        participationId,
        status: "completed",
      }),
    Error,
    "forbidden",
  );
});

const scopedClaims = (orgId: string, permission: string, scopes?: Record<string, string[]>): StaffClaims => ({
  actorType: "staff",
  staffId: crypto.randomUUID(),
  platformOwner: false,
  canVerifyIdentity: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{
    organizationId: orgId, module: "youth-republic", permissions: [permission],
    ...(scopes ? { chapterScopes: scopes } : {}),
  }],
});

Deno.test("updateParticipationStatus: a chapter-scoped participation:update only touches its own chapter", async () => {
  const supabase = testClient();
  const orgId = await seedOrg(supabase);
  const lums = crypto.randomUUID();
  const nust = crypto.randomUUID();
  const claims = scopedClaims(orgId, "participation:update", { "participation:update": [lums] });

  const mk = async (chapterId: string | null) => {
    const pid = await makeParticipation(supabase, orgId);
    const { data } = await supabase.from("participation").select("opportunity_id").eq("id", pid).single();
    await supabase.from("opportunities").update({ chapter_id: chapterId }).eq("id", data!.opportunity_id);
    return pid;
  };
  const lumsP = await mk(lums);
  const nustP = await mk(nust);
  const orgP = await mk(null);

  await updateParticipationStatus(supabase, claims, { participationId: lumsP, status: "participating" });

  await assertRejects(
    () => updateParticipationStatus(supabase, claims, { participationId: nustP, status: "participating" }),
    Error, "forbidden",
  );
  await assertRejects(
    () => updateParticipationStatus(supabase, claims, { participationId: orgP, status: "participating" }),
    Error, "forbidden",
  );
});
