import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createOpportunity } from "./handler.ts";
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

Deno.test("createOpportunity creates a row and logs the action under the caller's own staffId", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const realStaffId = crypto.randomUUID();

  const result = await createOpportunity(supabase, staffClaims(orgId, "opportunities:write", realStaffId), {
    organizationId: orgId, name: "Beach Cleanup", type: "event",
  });

  assertEquals(typeof result.opportunityId, "string");

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", result.opportunityId)
    .eq("action", "opportunity_created");
  assertEquals(logRows?.length, 1);
  assertEquals(logRows![0].staff_id, realStaffId);
});

Deno.test("createOpportunity rejects staff without opportunities:write for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();

  await assertRejects(
    () => createOpportunity(supabase, staffClaims(orgId, "opportunities:read"), {
      organizationId: orgId, name: "Beach Cleanup", type: "event",
    }),
    Error,
    "forbidden",
  );
});
