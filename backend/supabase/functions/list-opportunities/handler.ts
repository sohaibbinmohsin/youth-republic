import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface ListOpportunitiesInput {
  organizationId?: string;
  type?: string;
  status?: string;
  online?: boolean;
  city?: string;
  search?: string;
  sort?: "newest" | "closing_soon" | "az";
  limit?: number;
  offset?: number;
}

export interface OpportunityCard {
  id: string;
  name: string;
  orgName: string;
  orgLogoUrl: string | null;
  type: string;
  city: string | null;
  online: boolean;
  computedStatus: string;
  description: string | null;
}

export interface ListOpportunitiesResult {
  opportunities: OpportunityCard[];
  total: number;
  facets: {
    cities: string[];
    orgs: { id: string; name: string }[];
  };
}

export interface OpportunityStatusInputs {
  statusOverride: string | null;
  applicationOpenAt: string | null;
  applicationDeadline: string | null;
  activityStartAt: string | null;
  activityEndAt: string | null;
  deactivatedAt: string | null;
}

// Ports opportunity_status() from 0003_opportunities.sql so a list of N rows
// doesn't need N round-trip RPC calls. Keep this in lockstep with that SQL
// function if its logic ever changes.
export function computeOpportunityStatus(o: OpportunityStatusInputs): string {
  if (o.statusOverride) return o.statusOverride;
  const now = Date.now();
  if (o.deactivatedAt) return "closed";
  if (o.applicationOpenAt && now < new Date(o.applicationOpenAt).getTime()) return "coming_soon";
  if (o.activityStartAt && now >= new Date(o.activityStartAt).getTime() &&
      (!o.activityEndAt || now <= new Date(o.activityEndAt).getTime())) return "in_progress";
  if (o.activityEndAt && now > new Date(o.activityEndAt).getTime()) return "completed";
  if (o.applicationDeadline && now > new Date(o.applicationDeadline).getTime()) return "closed";
  return "open";
}

const CARD_SELECT =
  "id, name, type, description, location, is_online, status_override, " +
  "application_open_at, application_deadline, activity_start_at, activity_end_at, " +
  "deactivated_at, organization_id, organizations(name, logo_url)";

interface QueryScope {
  // When set, the query (and its facets) is confined to this org.
  organizationId?: string;
  // Staff callers see deactivated opportunities; public callers never do.
  includeDeactivated: boolean;
}

function toCard(o: Record<string, unknown>): OpportunityCard {
  const org = (o.organizations ?? {}) as { name?: string | null; logo_url?: string | null };
  return {
    id: o.id as string,
    name: o.name as string,
    orgName: (org.name ?? "") as string,
    orgLogoUrl: (org.logo_url ?? null) as string | null,
    type: o.type as string,
    city: (o.location ?? null) as string | null,
    online: Boolean(o.is_online),
    description: (o.description ?? null) as string | null,
    computedStatus: computeOpportunityStatus({
      statusOverride: (o.status_override ?? null) as string | null,
      applicationOpenAt: (o.application_open_at ?? null) as string | null,
      applicationDeadline: (o.application_deadline ?? null) as string | null,
      activityStartAt: (o.activity_start_at ?? null) as string | null,
      activityEndAt: (o.activity_end_at ?? null) as string | null,
      deactivatedAt: (o.deactivated_at ?? null) as string | null,
    }),
  };
}

async function computeFacets(
  supabase: SupabaseClient,
  scope: QueryScope,
): Promise<ListOpportunitiesResult["facets"]> {
  // Facets are built from a SECOND lightweight query over the
  // org-scoped-but-otherwise-unfiltered set (NOT the filtered/paginated page),
  // so facets.cities is the full distinct city set in scope regardless of the
  // active type/city/search/status filters.
  let facetQuery = supabase.from("opportunities").select("location, organization_id");
  if (scope.organizationId) facetQuery = facetQuery.eq("organization_id", scope.organizationId);
  if (!scope.includeDeactivated) facetQuery = facetQuery.is("deactivated_at", null);
  const { data, error } = await facetQuery;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  const cities = [...new Set(
    rows.map((r) => r.location).filter((c): c is string => typeof c === "string" && c.length > 0),
  )].sort();

  const orgIds = [...new Set(rows.map((r) => r.organization_id as string).filter(Boolean))];
  let orgs: { id: string; name: string }[] = [];
  if (orgIds.length > 0) {
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .in("id", orgIds);
    if (orgError) throw orgError;
    orgs = ((orgData ?? []) as unknown as Record<string, unknown>[])
      .map((o) => ({ id: o.id as string, name: o.name as string }));
  }

  return { cities, orgs };
}

async function runOpportunityQuery(
  supabase: SupabaseClient,
  input: ListOpportunitiesInput,
  scope: QueryScope,
): Promise<ListOpportunitiesResult> {
  const limit = Math.min(input.limit ?? 25, 100);
  const offset = input.offset ?? 0;

  let query = supabase.from("opportunities").select(CARD_SELECT, { count: "exact" });
  if (scope.organizationId) query = query.eq("organization_id", scope.organizationId);
  if (!scope.includeDeactivated) query = query.is("deactivated_at", null);
  if (input.type) query = query.eq("type", input.type);
  if (typeof input.online === "boolean") query = query.eq("is_online", input.online);
  if (input.city) query = query.ilike("location", `%${input.city}%`);
  if (input.search) {
    query = query.or(`name.ilike.%${input.search}%,description.ilike.%${input.search}%`);
  }

  switch (input.sort) {
    case "closing_soon":
      query = query.order("application_deadline", { ascending: true, nullsFirst: false });
      break;
    case "az":
      query = query.order("name", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  let opportunities = ((data ?? []) as unknown as Record<string, unknown>[]).map(toCard);
  const facets = await computeFacets(supabase, scope);

  // status is computed in JS (not filterable in SQL), so a status filter
  // applies after the fact. total then reflects the filtered set's true
  // size only when no status filter is given; with one, total is the
  // filtered page count — acceptable at Phase 1 scale per the spec's §8
  // no-scale-optimization decision.
  if (input.status) {
    opportunities = opportunities.filter((o) => o.computedStatus === input.status);
    return { opportunities, total: opportunities.length, facets };
  }

  return { opportunities, total: count ?? 0, facets };
}

// Public / anon variant: only non-deactivated opportunities, optionally
// scoped to one org.
export function listOpportunitiesPublic(
  supabase: SupabaseClient,
  input: ListOpportunitiesInput,
): Promise<ListOpportunitiesResult> {
  return runOpportunityQuery(supabase, input, {
    organizationId: input.organizationId,
    includeDeactivated: false,
  });
}

// Staff variant: org-scoped, sees deactivated opportunities. Requires
// opportunities:read for the target org.
export async function listOpportunities(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListOpportunitiesInput,
): Promise<ListOpportunitiesResult> {
  if (!staffHasPermission(staffClaims, input.organizationId ?? "", "youth-republic", "opportunities:read")) {
    throw new Error("forbidden");
  }
  return await runOpportunityQuery(supabase, input, {
    organizationId: input.organizationId,
    includeDeactivated: true,
  });
}
