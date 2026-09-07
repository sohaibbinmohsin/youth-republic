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

async function seedOrg(supabase: ReturnType<typeof testClient>): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("organizations").insert({
    id, name: "Fixture Org", slug: `fixture-${id}`,
  });
  if (error) throw error;
  return id;
}

Deno.test("createOpportunity creates a row and logs the action under the caller's own staffId", async () => {
  const supabase = testClient();
  const orgId = await seedOrg(supabase);
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

Deno.test("createOpportunity honours a statusOverride of 'draft'", async () => {
  const supabase = testClient();
  const orgId = await seedOrg(supabase);

  const result = await createOpportunity(supabase, staffClaims(orgId, "opportunities:write"), {
    organizationId: orgId, name: "Draft Drive", type: "event", statusOverride: "draft",
  });

  const { data: opp } = await supabase
    .from("opportunities")
    .select("status_override")
    .eq("id", result.opportunityId)
    .single();
  assertEquals(opp!.status_override, "draft");
});

Deno.test("createOpportunity rejects staff without opportunities:write for the org", async () => {
  const supabase = testClient();
  const orgId = await seedOrg(supabase);

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
  const orgId = await seedOrg(supabase);

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
  const orgId = await seedOrg(supabase);

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
  const orgId = await seedOrg(supabase);
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
  const orgId = await seedOrg(supabase);

  const { opportunityId } = await createOpportunity(supabase, staffClaims(orgId, "opportunities:write"), {
    organizationId: orgId,
    name: "Legacy Opp",
    type: "event",
    // deno-lint-ignore no-explicit-any
    eligibilityCriteria: "old free-text string",
  } as any);

  assertEquals(typeof opportunityId, "string");
});

const scopedClaims = (orgId: string, permission: string, scopes?: Record<string, string[]>): StaffClaims => ({
  actorType: "staff",
  staffId: crypto.randomUUID(),
  platformOwner: false,
  canVerifyIdentity: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{
    organizationId: orgId,
    module: "youth-republic",
    permissions: [permission],
    ...(scopes ? { chapterScopes: scopes } : {}),
  }],
});

Deno.test("createOpportunity: a chapter-scoped writer can only file under a scoped chapter", async () => {
  const supabase = testClient();
  const orgId = await seedOrg(supabase);
  const lums = crypto.randomUUID();
  const nust = crypto.randomUUID();
  const claims = scopedClaims(orgId, "opportunities:write", { "opportunities:write": [lums] });

  const { opportunityId } = await createOpportunity(supabase, claims, {
    organizationId: orgId, name: "LUMS Drive", type: "event", chapterId: lums,
  });
  const { data } = await supabase.from("opportunities").select("chapter_id").eq("id", opportunityId).single();
  assertEquals(data!.chapter_id, lums);

  await assertRejects(
    () => createOpportunity(supabase, claims, { organizationId: orgId, name: "NUST Drive", type: "event", chapterId: nust }),
    Error, "forbidden",
  );
  await assertRejects(
    () => createOpportunity(supabase, claims, { organizationId: orgId, name: "Org Drive", type: "event", chapterId: null }),
    Error, "forbidden",
  );
});

Deno.test("createOpportunity: an unrestricted writer can file org-wide or under any chapter", async () => {
  const supabase = testClient();
  const orgId = await seedOrg(supabase);
  const anyChapter = crypto.randomUUID();
  const claims = scopedClaims(orgId, "opportunities:write");

  const a = await createOpportunity(supabase, claims, { organizationId: orgId, name: "Org Wide", type: "event", chapterId: null });
  const { data: rowA } = await supabase.from("opportunities").select("chapter_id").eq("id", a.opportunityId).single();
  assertEquals(rowA!.chapter_id, null);

  const b = await createOpportunity(supabase, claims, { organizationId: orgId, name: "Any Chapter", type: "event", chapterId: anyChapter });
  const { data: rowB } = await supabase.from("opportunities").select("chapter_id").eq("id", b.opportunityId).single();
  assertEquals(rowB!.chapter_id, anyChapter);
});
