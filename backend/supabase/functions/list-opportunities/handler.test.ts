import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listOpportunities, computeOpportunityStatus } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function claims(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["opportunities:read"] }],
  };
}

Deno.test("computeOpportunityStatus prefers a manual override over every date-derived status", () => {
  assertEquals(computeOpportunityStatus({
    statusOverride: "closed", applicationOpenAt: null, applicationDeadline: null,
    activityStartAt: null, activityEndAt: null, deactivatedAt: null,
  }), "closed");
});

Deno.test("computeOpportunityStatus is 'closed' once deactivated, with no override", () => {
  assertEquals(computeOpportunityStatus({
    statusOverride: null, applicationOpenAt: null, applicationDeadline: null,
    activityStartAt: null, activityEndAt: null, deactivatedAt: "2026-01-01T00:00:00Z",
  }), "closed");
});

Deno.test("computeOpportunityStatus is 'coming_soon' before applications open", () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  assertEquals(computeOpportunityStatus({
    statusOverride: null, applicationOpenAt: future, applicationDeadline: null,
    activityStartAt: null, activityEndAt: null, deactivatedAt: null,
  }), "coming_soon");
});

Deno.test("computeOpportunityStatus is 'open' with no other signal", () => {
  assertEquals(computeOpportunityStatus({
    statusOverride: null, applicationOpenAt: null, applicationDeadline: null,
    activityStartAt: null, activityEndAt: null, deactivatedAt: null,
  }), "open");
});

Deno.test("listOpportunities filters by type and returns each row's computed status", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(), name: "List Opportunities Test Org", slug: `list-opps-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;

  await supabase.from("opportunities").insert([
    { organization_id: orgId, name: "Environment Opp", type: "environment" },
    { organization_id: orgId, name: "Health Opp", type: "health" },
  ]);

  const result = await listOpportunities(supabase, claims(orgId), { organizationId: orgId, type: "environment" });

  assertEquals(result.opportunities.length, 1);
  assertEquals(result.opportunities[0].name, "Environment Opp");
  assertEquals(result.opportunities[0].computedStatus, "open");
});

Deno.test("listOpportunities rejects a caller without opportunities:read for this org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const noPerm: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(() => listOpportunities(supabase, noPerm, { organizationId: orgId }), Error, "forbidden");
});
