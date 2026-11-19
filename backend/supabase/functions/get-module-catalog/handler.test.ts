import { assertEquals, assertThrows } from "@std/assert";
import { getModuleCatalog } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

const claims = (module: string | null): StaffClaims => ({
  actorType: "staff",
  staffId: "staff-1",
  platformOwner: false,
  canVerifyIdentity: false,
  orgRoles: [],
  moduleAccess: module
    ? [{ organizationId: "org-1", module, permissions: ["opportunities:read"] }]
    : [],
});

Deno.test("getModuleCatalog returns the Youth Republic catalog", () => {
  const catalog = getModuleCatalog(claims("youth-republic"));
  assertEquals(catalog.key, "youth-republic");
  assertEquals(catalog.areas.some((area) => area.key === "drives"), true);
});

Deno.test("getModuleCatalog rejects a caller with no Youth Republic access", () => {
  assertThrows(() => getModuleCatalog(claims(null)), Error, "forbidden");
});