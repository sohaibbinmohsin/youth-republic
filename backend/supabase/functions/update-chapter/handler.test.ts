import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateChapter } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const staffClaims = (orgId: string, permission: string): StaffClaims => ({
  actorType: "staff",
  staffId: crypto.randomUUID(),
  platformOwner: false,
  canVerifyIdentity: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: [permission] }],
});

Deno.test("updateChapter renames a chapter and logs the action", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: chapter } = await supabase.from("chapters").insert({
    organization_id: orgId, name: "Old Name",
  }).select("id").single();

  await updateChapter(supabase, staffClaims(orgId, "chapters:update"), {
    chapterId: chapter!.id, organizationId: orgId, name: "New Name",
  });

  const { data: updated } = await supabase.from("chapters").select("name").eq("id", chapter!.id).single();
  assertEquals(updated!.name, "New Name");
});

Deno.test("updateChapter rejects a cross-tenant write even when the caller holds chapters:update in the org they claim", async () => {
  const supabase = testClient();
  const orgA = crypto.randomUUID();
  const orgB = crypto.randomUUID();
  const originalName = `Org B Chapter ${crypto.randomUUID()}`;
  const { data: chapter } = await supabase.from("chapters").insert({
    organization_id: orgB, name: originalName,
  }).select("id").single();

  // Staff genuinely hold chapters:update for org A and pass orgA in the input,
  // but the referenced chapter actually belongs to org B.
  await assertRejects(
    () => updateChapter(supabase, staffClaims(orgA, "chapters:update"), {
      chapterId: chapter!.id, organizationId: orgA, name: "hijacked", status: "inactive",
    }),
    Error,
    "forbidden",
  );

  const { data: unchanged } = await supabase
    .from("chapters")
    .select("name, status, organization_id")
    .eq("id", chapter!.id)
    .single();
  assertEquals(unchanged!.name, originalName);
  assertEquals(unchanged!.status, "active");
  assertEquals(unchanged!.organization_id, orgB);
});

Deno.test("updateChapter rejects staff without chapters:update for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: chapter } = await supabase.from("chapters").insert({
    organization_id: orgId, name: "Old Name",
  }).select("id").single();

  await assertRejects(
    () => updateChapter(supabase, staffClaims(orgId, "chapters:read"), {
      chapterId: chapter!.id, organizationId: orgId, name: "New Name",
    }),
    Error,
    "forbidden",
  );
});
