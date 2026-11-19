import { youthRepublicCatalog, type ModuleCatalog } from "../_shared/moduleCatalog.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

export function getModuleCatalog(claims: StaffClaims): ModuleCatalog {
  const allowed = claims.platformOwner
    || claims.moduleAccess.some((entry) => entry.module === "youth-republic");
  if (!allowed) throw new Error("forbidden");
  return youthRepublicCatalog;
}