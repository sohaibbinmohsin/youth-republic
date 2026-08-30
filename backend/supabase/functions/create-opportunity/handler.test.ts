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
  canVerifyIdentity: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: [permission] }],
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

Deno.test("createOpportunity persists about, duties, eligibility and whatToBring, and applies the application_form default when omitted", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();

  const { opportunityId } = await createOpportunity(supabase, staffClaims(orgId, "opportunities:write"), {
    organizationId: orgId,
    name: "Content Opp",
    type: "event",
    about: "A longer prose description.",
    duties: ["Greet guests", "Hand out water"],
    eligibility: ["18 or older"],
    whatToBring: ["Comfortable shoes"],
  });

  const { data } = await supabase
    .from("opportunities")
    .select("about, duties, eligibility, what_to_bring, application_form")
    .eq("id", opportunityId)
    .single();

  assertEquals(data!.about, "A longer prose description.");
  assertEquals(data!.duties, ["Greet guests", "Hand out water"]);
  assertEquals(data!.eligibility, ["18 or older"]);
  assertEquals(data!.what_to_bring, ["Comfortable shoes"]);
  assertEquals(data!.application_form, { version: 1, fields: [] });
});

Deno.test("createOpportunity rejects an invalid applicationForm with invalid_form", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();

  await assertRejects(
    () => createOpportunity(supabase, staffClaims(orgId, "opportunities:write"), {
      organizationId: orgId,
      name: "Bad Form Opp",
      type: "event",
      applicationForm: { version: 2, fields: "not-an-array" },
    }),
    Error,
    "invalid_form",
  );
});

Deno.test("createOpportunity stores a valid applicationForm definition", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const form = {
    version: 1,
    fields: [{ id: "why", type: "long_text", label: "Why do you want to join?" }],
  };

  const { opportunityId } = await createOpportunity(supabase, staffClaims(orgId, "opportunities:write"), {
    organizationId: orgId,
    name: "Form Opp",
    type: "event",
    applicationForm: form,
  });

  const { data } = await supabase
    .from("opportunities")
    .select("application_form")
    .eq("id", opportunityId)
    .single();
  assertEquals(data!.application_form, form);
});

Deno.test("createOpportunity silently ignores a legacy eligibilityCriteria field in the body", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();

  const { opportunityId } = await createOpportunity(supabase, staffClaims(orgId, "opportunities:write"), {
    organizationId: orgId,
    name: "Legacy Opp",
    type: "event",
    // deno-lint-ignore no-explicit-any
    eligibilityCriteria: "old free-text string",
  } as any);

  assertEquals(typeof opportunityId, "string");
});
