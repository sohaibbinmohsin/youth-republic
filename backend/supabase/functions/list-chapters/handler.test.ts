import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listChapters } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
function claims(orgId: string, perms: string[]): StaffClaims {
  return {
    actorType: "staff", staffId: crypto.randomUUID(), platformOwner: false, canVerifyIdentity: false,
    orgRoles: [{ organizationId: orgId }],
    moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: perms }],
  };
}

Deno.test("listChapters returns the org's chapters for a permitted caller", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(), name: "LC Org", slug: `lc-${crypto.randomUUID()}`,
  }).select("id").single();
  await supabase.from("chapters").insert([
    { organization_id: org!.id, name: "Lahore Chapter", city: "Lahore", status: "active" },
    { organization_id: org!.id, name: "Karachi Chapter", city: "Karachi", status: "inactive" },
  ]);

  const result = await listChapters(supabase, claims(org!.id, ["chapters:read"]), { organizationId: org!.id });
  assertEquals(result.chapters.length, 2);
  assertEquals(new Set(result.chapters.map((c) => c.name)), new Set(["Lahore Chapter", "Karachi Chapter"]));

  await assertRejects(
    () => listChapters(supabase, claims(org!.id, []), { organizationId: org!.id }),
    Error, "forbidden",
  );
});
