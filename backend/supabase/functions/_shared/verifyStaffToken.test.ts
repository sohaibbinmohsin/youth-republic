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
    module_access: [{ organization_id: "org-1", module: "youth-republic", permissions: ["applications:read"] }],
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

Deno.test("verifyStaffToken rejects a well-signed token with no exp claim at all", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  // djwt's verify() does not itself require exp to be present -- only
  // rejects it when present but malformed -- so a hand-crafted token that
  // omits exp entirely would otherwise verify successfully and never
  // expire. Passing exp: undefined here overrides signStaffToken's default
  // getNumericDate(60) and is dropped by JSON.stringify, producing a
  // correctly-signed token with no exp claim in its payload at all.
  const token = await signStaffToken({
    actor_type: "staff",
    staff_id: "staff-1",
    platform_owner: false,
    org_roles: [],
    module_access: [],
    exp: undefined,
  });
  await assertRejects(() => verifyStaffToken(`Bearer ${token}`), Error, "unauthorized");
});

Deno.test("verifyStaffToken surfaces canVerifyIdentity from the can_verify_identity claim", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  const token = await signStaffToken({
    actor_type: "staff",
    staff_id: "staff-1",
    platform_owner: false,
    can_verify_identity: true,
    org_roles: [],
    module_access: [],
  });
  const claims = await verifyStaffToken(`Bearer ${token}`);
  assertEquals(claims.canVerifyIdentity, true);
});

Deno.test("verifyStaffToken defaults canVerifyIdentity to false when the claim is absent", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  const token = await signStaffToken({
    actor_type: "staff",
    staff_id: "staff-1",
    platform_owner: false,
    org_roles: [],
    module_access: [],
  });
  const claims = await verifyStaffToken(`Bearer ${token}`);
  assertEquals(claims.canVerifyIdentity, false);
});

Deno.test("verifyStaffToken treats a platform_owner token as able to verify identity", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  const token = await signStaffToken({
    actor_type: "staff",
    staff_id: "staff-1",
    platform_owner: true,
    org_roles: [],
    module_access: [],
  });
  const claims = await verifyStaffToken(`Bearer ${token}`);
  assertEquals(claims.canVerifyIdentity, true);
});

const baseClaims = (overrides: Partial<StaffClaims> = {}): StaffClaims => ({
  actorType: "staff",
  staffId: "staff-1",
  platformOwner: false,
  canVerifyIdentity: false,
  orgRoles: [{ organizationId: "org-1" }],
  moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["applications:read"] }],
  ...overrides,
});

Deno.test("staffHasPermission is true when the permission is granted for that org and module", () => {
  assertEquals(staffHasPermission(baseClaims(), "org-1", "youth-republic", "applications:read"), true);
});

Deno.test("staffHasPermission is false when the permission isn't granted", () => {
  assertEquals(staffHasPermission(baseClaims(), "org-1", "youth-republic", "applications:write"), false);
});

Deno.test("staffHasPermission is false for a different organization", () => {
  assertEquals(staffHasPermission(baseClaims(), "org-2", "youth-republic", "applications:read"), false);
});

Deno.test("staffHasPermission bypasses everything for platform_owner", () => {
  assertEquals(staffHasPermission(baseClaims({ platformOwner: true, moduleAccess: [] }), "org-9", "youth-republic", "applications:write"), true);
});

Deno.test("staffHasPermission 4-arg honours per-key chapter scope", () => {
  const claims: StaffClaims = baseClaims({
    moduleAccess: [{
      organizationId: "org-1", module: "youth-republic",
      permissions: ["opportunities:read", "opportunities:write"],
      chapterScopes: { "opportunities:write": ["lums"] },
    }],
  });
  // unrestricted read
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "opportunities:read", null), true);
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "opportunities:read", "nust"), true);
  // scoped write
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "opportunities:write", "lums"), true);
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "opportunities:write", "nust"), false);
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "opportunities:write", null), false);
  // ungranted key
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "hours:update", "lums"), false);
  // 3-arg still works
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "opportunities:write"), true);
});

Deno.test("verifyStaffToken decodes chapter_scopes into moduleAccess[].chapterScopes", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  const token = await signStaffToken({
    actor_type: "staff",
    staff_id: "staff-1",
    platform_owner: false,
    org_roles: [{ organization_id: "org-1" }],
    module_access: [{
      organization_id: "org-1", module: "youth-republic",
      permissions: ["opportunities:read", "opportunities:write"],
      chapter_scopes: { "opportunities:write": ["lums"] },
    }],
  });
  const claims = await verifyStaffToken(`Bearer ${token}`);
  assertEquals(claims.moduleAccess[0].chapterScopes, { "opportunities:write": ["lums"] });
});

Deno.test("verifyStaffToken leaves chapterScopes undefined when the claim is absent", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  const token = await signStaffToken({
    actor_type: "staff",
    staff_id: "staff-1",
    platform_owner: false,
    org_roles: [],
    module_access: [{ organization_id: "org-1", module: "youth-republic", permissions: ["applications:read"] }],
  });
  const claims = await verifyStaffToken(`Bearer ${token}`);
  assertEquals(claims.moduleAccess[0].chapterScopes, undefined);
});
