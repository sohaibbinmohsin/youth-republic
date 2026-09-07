import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

export interface ModuleAccessEntry {
  organizationId: string;
  module: string;
  permissions: string[];
  chapterScopes?: Record<string, string[]>;
}

export interface StaffClaims {
  actorType: string;
  staffId: string;
  platformOwner: boolean;
  canVerifyIdentity: boolean;
  orgRoles: { organizationId: string }[];
  moduleAccess: ModuleAccessEntry[];
}

export async function verifyStaffToken(authHeader: string | null): Promise<StaffClaims> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("unauthorized");
  }
  const token = authHeader.slice("Bearer ".length);
  const secret = Deno.env.get("STAFF_JWT_SECRET");
  if (!secret) {
    throw new Error("unauthorized");
  }
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const payload = await verify(token, key);
    if (!payload.staff_id || typeof payload.staff_id !== "string") {
      // A token with no staff_id can't be attributed to anyone — reject it
      // outright rather than falling back to an empty string, which would
      // otherwise reach admin_action_log.staff_id (a uuid column) and fail
      // as an opaque DB error instead of a clean 401.
      throw new Error("unauthorized");
    }
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      // djwt's verify() only rejects a malformed exp claim, not a missing
      // one — a hand-crafted (but correctly-signed) token that omits exp
      // entirely would otherwise verify successfully and never expire.
      throw new Error("unauthorized");
    }
    return {
      actorType: String(payload.actor_type ?? "staff"),
      staffId: payload.staff_id,
      platformOwner: Boolean(payload.platform_owner),
      canVerifyIdentity: Boolean(payload.can_verify_identity) || Boolean(payload.platform_owner),
      orgRoles: Array.isArray(payload.org_roles)
        ? (payload.org_roles as Array<Record<string, unknown>>).map((r) => ({
          organizationId: String(r.organization_id),
        }))
        : [],
      moduleAccess: Array.isArray(payload.module_access)
        ? (payload.module_access as Array<Record<string, unknown>>).map((m) => ({
          organizationId: String(m.organization_id),
          module: String(m.module),
          permissions: Array.isArray(m.permissions) ? m.permissions.map(String) : [],
          chapterScopes:
            m.chapter_scopes && typeof m.chapter_scopes === "object"
              ? Object.fromEntries(
                Object.entries(m.chapter_scopes as Record<string, unknown>).map(([k, v]) => [
                  k,
                  Array.isArray(v) ? v.map(String) : [],
                ]),
              )
              : undefined,
        }))
        : [],
    };
  } catch {
    throw new Error("unauthorized");
  }
}

export function staffHasPermission(
  claims: StaffClaims,
  organizationId: string,
  module: string,
  permission: string,
): boolean;
export function staffHasPermission(
  claims: StaffClaims,
  organizationId: string,
  module: string,
  permission: string,
  targetChapterId: string | null,
): boolean;
export function staffHasPermission(
  claims: StaffClaims,
  organizationId: string,
  module: string,
  permission: string,
  targetChapterId?: string | null,
): boolean {
  if (claims.platformOwner) return true;
  const entry = claims.moduleAccess.find(
    (m) => m.organizationId === organizationId && m.module === module,
  );
  if (!entry || !entry.permissions.includes(permission)) return false;
  if (targetChapterId === undefined) return true; // 3-arg: any scope
  const scope = entry.chapterScopes?.[permission];
  if (!scope) return true; // key unrestricted
  return targetChapterId !== null && scope.includes(targetChapterId);
}
