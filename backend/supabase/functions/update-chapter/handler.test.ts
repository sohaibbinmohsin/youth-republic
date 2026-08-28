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
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: [permission] }],
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
