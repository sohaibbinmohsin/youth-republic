import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyStaffToken, staffHasPermission, type StaffClaims } from "./verifyStaffToken.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const secret = "test-shared-secret-32-characters!";

async function signStaffToken(claims: Record<string, unknown>): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return create({ alg: "HS256", typ: "JWT" }, { exp: getNumericDate(60), ...claims }, key);
}

Deno.test("verifyStaffToken accepts a well-formed staff token", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  const token = await signStaffToken({
    actor_type: "staff",
    staff_id: "staff-1",
    platform_owner: false,
    org_roles: [{ organization_id: "org-1" }],
    module_access: [{ organization_id: "org-1", module: "vms", permissions: ["applications:read"] }],
  });
  const claims = await verifyStaffToken(`Bearer ${token}`);
  assertEquals(claims.actorType, "staff");
  assertEquals(claims.staffId, "staff-1");
  assertEquals(claims.orgRoles[0].organizationId, "org-1");
  assertEquals(claims.moduleAccess[0].permissions, ["applications:read"]);
});

Deno.test("verifyStaffToken rejects a missing header", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  await assertRejects(() => verifyStaffToken(null), Error, "unauthorized");
});

Deno.test("verifyStaffToken rejects a token signed with the wrong secret", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  const badKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("wrong-secret-32-characters-long!"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const token = await create({ alg: "HS256", typ: "JWT" }, { exp: getNumericDate(60), actor_type: "staff" }, badKey);
  await assertRejects(() => verifyStaffToken(`Bearer ${token}`), Error, "unauthorized");
});

Deno.test("verifyStaffToken rejects a well-signed token with no staff_id claim", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  const token = await signStaffToken({
    actor_type: "staff",
    platform_owner: false,
    org_roles: [{ organization_id: "org-1" }],
    module_access: [],
  });
  await assertRejects(() => verifyStaffToken(`Bearer ${token}`), Error, "unauthorized");
});

const baseClaims = (overrides: Partial<StaffClaims> = {}): StaffClaims => ({
  actorType: "staff",
  staffId: "staff-1",
  platformOwner: false,
  orgRoles: [{ organizationId: "org-1" }],
  moduleAccess: [{ organizationId: "org-1", module: "vms", permissions: ["applications:read"] }],
  ...overrides,
});

Deno.test("staffHasPermission is true when the permission is granted for that org and module", () => {
  assertEquals(staffHasPermission(baseClaims(), "org-1", "vms", "applications:read"), true);
});

Deno.test("staffHasPermission is false when the permission isn't granted", () => {
  assertEquals(staffHasPermission(baseClaims(), "org-1", "vms", "applications:write"), false);
});

Deno.test("staffHasPermission is false for a different organization", () => {
  assertEquals(staffHasPermission(baseClaims(), "org-2", "vms", "applications:read"), false);
});

Deno.test("staffHasPermission bypasses everything for platform_owner", () => {
  assertEquals(staffHasPermission(baseClaims({ platformOwner: true, moduleAccess: [] }), "org-9", "vms", "applications:write"), true);
});
