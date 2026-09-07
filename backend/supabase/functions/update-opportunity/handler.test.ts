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
  canVerifyIdentity: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: [permission] }],
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

Deno.test("updateOpportunity lets staff with opportunities:delete deactivate an opportunity, and its computed status becomes closed", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Deactivate Target", type: "event",
  }).select("id").single();

  const deactivatedAt = new Date().toISOString();
  await updateOpportunity(supabase, staffClaims(orgId, "opportunities:delete"), {
    opportunityId: opportunity!.id, organizationId: orgId, deactivatedAt,
  });

  const { data: updated } = await supabase
    .from("opportunities")
    .select("deactivated_at, opportunity_status")
    .eq("id", opportunity!.id)
    .single();
  assertEquals(new Date(updated!.deactivated_at).getTime(), new Date(deactivatedAt).getTime());
  assertEquals(updated!.opportunity_status, "closed");
});

Deno.test("updateOpportunity permanently deletes opportunity and logs when hardDelete is true", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Delete Target", type: "event",
  }).select("id").single();

  await updateOpportunity(supabase, staffClaims(orgId, "opportunities:delete"), {
    opportunityId: opportunity!.id, organizationId: orgId, hardDelete: true,
  });

  const { data: found } = await supabase.from("opportunities").select("id").eq("id", opportunity!.id).maybeSingle();
  assertEquals(found, null);

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", opportunity!.id)
    .eq("action", "opportunity_deleted");
  assertEquals(logRows?.length, 1);
});

Deno.test("updateOpportunity rejects staff without opportunities:delete trying hardDelete", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Delete Target", type: "event",
  }).select("id").single();

  await assertRejects(
    () => updateOpportunity(supabase, staffClaims(orgId, "opportunities:update"), {
      opportunityId: opportunity!.id, organizationId: orgId, hardDelete: true,
    }),
    Error,
    "forbidden",
  );
});

Deno.test("updateOpportunity rejects staff with only opportunities:update trying to set deactivatedAt", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Deactivate Target", type: "event",
  }).select("id").single();

  await assertRejects(
    () => updateOpportunity(supabase, staffClaims(orgId, "opportunities:update"), {
      opportunityId: opportunity!.id, organizationId: orgId, deactivatedAt: new Date().toISOString(),
    }),
    Error,
    "forbidden",
  );

  const { data: unchanged } = await supabase
    .from("opportunities")
    .select("deactivated_at")
    .eq("id", opportunity!.id)
    .single();
  assertEquals(unchanged!.deactivated_at, null);
});

Deno.test("updateOpportunity persists about, duties, eligibility and whatToBring", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Content Target", type: "event",
  }).select("id").single();

  await updateOpportunity(supabase, staffClaims(orgId, "opportunities:update"), {
    opportunityId: opportunity!.id,
    organizationId: orgId,
    about: "Rewritten prose.",
    duties: ["Set up chairs"],
    eligibility: ["Any age"],
    whatToBring: ["ID card", "Pen"],
  });

  const { data: updated } = await supabase
    .from("opportunities")
    .select("about, duties, eligibility, what_to_bring")
    .eq("id", opportunity!.id)
    .single();
  assertEquals(updated!.about, "Rewritten prose.");
  assertEquals(updated!.duties, ["Set up chairs"]);
  assertEquals(updated!.eligibility, ["Any age"]);
  assertEquals(updated!.what_to_bring, ["ID card", "Pen"]);
});

Deno.test("updateOpportunity validates applicationForm and rejects an invalid one with invalid_form", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Form Target", type: "event",
  }).select("id").single();

  await assertRejects(
    () => updateOpportunity(supabase, staffClaims(orgId, "opportunities:update"), {
      opportunityId: opportunity!.id,
      organizationId: orgId,
      applicationForm: { version: 1, fields: [{ type: "bogus" }] },
    }),
    Error,
    "invalid_form",
  );
});

Deno.test("updateOpportunity writes a valid applicationForm definition", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Form Target", type: "event",
  }).select("id").single();
  const form = {
    version: 1,
    fields: [{ id: "q1", type: "short_text", label: "Full name" }],
  };

  await updateOpportunity(supabase, staffClaims(orgId, "opportunities:update"), {
    opportunityId: opportunity!.id,
    organizationId: orgId,
    applicationForm: form,
  });

  const { data: updated } = await supabase
    .from("opportunities")
    .select("application_form")
    .eq("id", opportunity!.id)
    .single();
  assertEquals(updated!.application_form, form);
});

Deno.test("updateOpportunity gates the new content fields on opportunities:update", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Guard Target", type: "event",
  }).select("id").single();

  await assertRejects(
    () => updateOpportunity(supabase, staffClaims(orgId, "opportunities:read"), {
      opportunityId: opportunity!.id, organizationId: orgId, about: "sneaky edit",
    }),
    Error,
    "forbidden",
  );
});

Deno.test("updateOpportunity lets staff with opportunities:delete reactivate an opportunity by setting deactivatedAt to null", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Reactivate Target", type: "event", deactivated_at: new Date().toISOString(),
  }).select("id").single();

  await updateOpportunity(supabase, staffClaims(orgId, "opportunities:delete"), {
    opportunityId: opportunity!.id, organizationId: orgId, deactivatedAt: null,
  });

  const { data: updated } = await supabase
    .from("opportunities")
    .select("deactivated_at, opportunity_status")
    .eq("id", opportunity!.id)
    .single();
  assertEquals(updated!.deactivated_at, null);
  assertEquals(updated!.opportunity_status, "open");
});
