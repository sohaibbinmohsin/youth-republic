import { SupabaseClient } from "@supabase/supabase-js";
import { type StaffClaims } from "./verifyStaffToken.ts";

/** The platform chapter id an opportunity is filed under, or null (org-wide). */
export async function opportunityChapterId(
  supabase: SupabaseClient,
  opportunityId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("opportunities")
    .select("chapter_id")
    .eq("id", opportunityId)
    .single();
  return (data?.chapter_id as string | null) ?? null;
}

/**
 * The chapter ids a caller's read scope is limited to for `readPermission`, or
 * `null` when unrestricted (platform owner, no scope entry, or an empty list).
 */
export function readScopeChapterIds(
  claims: StaffClaims,
  organizationId: string,
  readPermission: string,
): string[] | null {
  if (claims.platformOwner) return null;
  const entry = claims.moduleAccess.find(
    (m) => m.organizationId === organizationId && m.module === "youth-republic",
  );
  const scope = entry?.chapterScopes?.[readPermission];
  return scope && scope.length > 0 ? scope : null;
}
