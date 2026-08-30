import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createChapter } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const staffClaims = (orgId: string, permission: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: [permission] }],
});

Deno.test("createChapter creates a row and logs the action under the caller's own staffId", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const realStaffId = crypto.randomUUID();

  const result = await createChapter(supabase, staffClaims(orgId, "chapters:write", realStaffId), {
    organizationId: orgId, name: "LUMS Chapter", institution: "LUMS", city: "Lahore", province: "Punjab",
  });

  assertEquals(typeof result.chapterId, "string");

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", result.chapterId)
    .eq("action", "chapter_created");
  assertEquals(logRows?.length, 1);
  assertEquals(logRows![0].staff_id, realStaffId);
});

Deno.test("createChapter rejects staff without chapters:write for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();

  await assertRejects(
    () => createChapter(supabase, staffClaims(orgId, "chapters:read"), {
      organizationId: orgId, name: "LUMS Chapter",
    }),
    Error,
    "forbidden",
  );
});
