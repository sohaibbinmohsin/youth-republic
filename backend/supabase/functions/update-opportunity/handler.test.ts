import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateOpportunity } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const staffClaims = (orgId: string, permission: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: [permission] }],
});

Deno.test("updateOpportunity publishes by setting status_override and logs the action", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Draft Opp", type: "event",
  }).select("id").single();

  await updateOpportunity(supabase, staffClaims(orgId, "opportunities:update"), {
    opportunityId: opportunity!.id, organizationId: orgId, statusOverride: "open",
  });

  const { data: updated } = await supabase.from("opportunities").select("status_override").eq("id", opportunity!.id).single();
  assertEquals(updated!.status_override, "open");

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", opportunity!.id)
    .eq("action", "opportunity_updated");
  assertEquals(logRows?.length, 1);
});

Deno.test("updateOpportunity rejects a cross-tenant write even when the caller holds opportunities:update in the org they claim", async () => {
  const supabase = testClient();
  const orgA = crypto.randomUUID();
  const orgB = crypto.randomUUID();
  const originalName = `Org B Opp ${crypto.randomUUID()}`;
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgB, name: originalName, type: "event",
  }).select("id").single();

  // Staff genuinely hold opportunities:update for org A and pass orgA in the
  // input, but the referenced opportunity actually belongs to org B.
  await assertRejects(
    () => updateOpportunity(supabase, staffClaims(orgA, "opportunities:update"), {
      opportunityId: opportunity!.id, organizationId: orgA, name: "hijacked", statusOverride: "closed",
    }),
    Error,
    "forbidden",
  );

  const { data: unchanged } = await supabase
    .from("opportunities")
    .select("name, status_override, organization_id")
    .eq("id", opportunity!.id)
    .single();
  assertEquals(unchanged!.name, originalName);
  assertEquals(unchanged!.status_override, null);
  assertEquals(unchanged!.organization_id, orgB);
});

Deno.test("updateOpportunity rejects staff without opportunities:update for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Draft Opp", type: "event",
  }).select("id").single();

  await assertRejects(
    () => updateOpportunity(supabase, staffClaims(orgId, "opportunities:read"), {
      opportunityId: opportunity!.id, organizationId: orgId, statusOverride: "open",
    }),
    Error,
    "forbidden",
  );
});
