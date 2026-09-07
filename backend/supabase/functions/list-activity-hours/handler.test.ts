import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listActivityHours } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function claims(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, canVerifyIdentity: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: ["hours:read"] }],
  };
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>) {
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `list-hours-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "List Hours Volunteer",
    email: `list-hours-${crypto.randomUUID()}@example.com`, phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();
  return data!.id as string;
}

Deno.test("listActivityHours filters by activity type (from opportunities) and participation status (from participation) together", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(), name: "List Hours Test Org", slug: `list-hours-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  const { data: envOpp } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Env Opp", type: "environment",
  }).select("id").single();
  const { data: healthOpp } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Health Opp", type: "health",
  }).select("id").single();
  const volunteerId = await makeVolunteer(supabase);

  const { data: participatingParticipation } = await supabase.from("participation").insert({
    volunteer_id: volunteerId, opportunity_id: envOpp!.id, organization_id: orgId, status: "participating",
  }).select("id").single();
  const { data: completedParticipation } = await supabase.from("participation").insert({
    volunteer_id: volunteerId, opportunity_id: healthOpp!.id, organization_id: orgId, status: "completed",
  }).select("id").single();

  await supabase.from("activity_hours").insert([
    {
      participation_id: participatingParticipation!.id, volunteer_id: volunteerId, opportunity_id: envOpp!.id,
      organization_id: orgId, activity_date: "2026-02-01", hours_submitted: 5, verification_status: "pending",
    },
    {
      participation_id: completedParticipation!.id, volunteer_id: volunteerId, opportunity_id: healthOpp!.id,
      organization_id: orgId, activity_date: "2026-02-02", hours_submitted: 3, verification_status: "verified", hours_verified: 3,
    },
  ]);

  const result = await listActivityHours(supabase, claims(orgId), {
    organizationId: orgId, activityType: "environment", participationStatus: "participating",
  });

  assertEquals(result.activity.length, 1);
  assertEquals(result.activity[0].opportunityName, "Env Opp");
  assertEquals(result.activity[0].activityType, "environment");
});

Deno.test("listActivityHours rejects a caller without hours:read for this org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const noPerm: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, canVerifyIdentity: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(() => listActivityHours(supabase, noPerm, { organizationId: orgId }), Error, "forbidden");
});

Deno.test("listActivityHours: a chapter read-scope confines results to those chapters' opportunities", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(), name: "LH Scope Org", slug: `lh-scope-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  const lums = crypto.randomUUID();
  const nust = crypto.randomUUID();
  const vId = await makeVolunteer(supabase);
  const mk = async (chapterId: string | null) => {
    const oppId = (await supabase.from("opportunities").insert({
      organization_id: orgId, name: `Opp ${chapterId ?? "org"}`, type: "environment", chapter_id: chapterId,
    }).select("id").single()).data!.id as string;
    const pId = (await supabase.from("participation").insert({
      volunteer_id: vId, opportunity_id: oppId, organization_id: orgId, status: "participating",
    }).select("id").single()).data!.id as string;
    await supabase.from("activity_hours").insert({
      participation_id: pId, volunteer_id: vId, opportunity_id: oppId, organization_id: orgId,
      activity_date: "2026-03-01", hours_submitted: 4, verification_status: "pending",
    });
    return oppId;
  };
  const lumsOpp = await mk(lums);
  await mk(nust);

  const scopedClaims: StaffClaims = {
    actorType: "staff", staffId: "s1", platformOwner: false, canVerifyIdentity: false, orgRoles: [],
    moduleAccess: [{
      organizationId: orgId, module: "youth-republic", permissions: ["hours:read"],
      chapterScopes: { "hours:read": [lums] },
    }],
  };
  const scoped = await listActivityHours(supabase, scopedClaims, { organizationId: orgId });
  assertEquals(scoped.activity.length, 1);
  assertEquals(scoped.activity[0].opportunityName, `Opp ${lums}`);
  void lumsOpp;

  const all = await listActivityHours(supabase, claims(orgId), { organizationId: orgId });
  assertEquals(all.activity.length, 2);
});
