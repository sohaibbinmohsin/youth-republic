import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface ListOpportunitiesInput {
  organizationId: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface OpportunitySummary {
  id: string;
  name: string;
  type: string;
  computedStatus: string;
  capacity: number | null;
}

export interface ListOpportunitiesResult {
  opportunities: OpportunitySummary[];
  total: number;
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

export async function listOpportunities(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListOpportunitiesInput,
): Promise<ListOpportunitiesResult> {
  if (!staffHasPermission(staffClaims, input.organizationId, "youth-republic", "opportunities:read")) {
    throw new Error("forbidden");
  }

  const limit = Math.min(input.limit ?? 25, 100);
  const offset = input.offset ?? 0;

  let query = supabase
    .from("opportunities")
    .select(
      "id, name, type, capacity, status_override, application_open_at, application_deadline, activity_start_at, activity_end_at, deactivated_at",
      { count: "exact" },
    )
    .eq("organization_id", input.organizationId);
  if (input.type) query = query.eq("type", input.type);

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;

  let opportunities: OpportunitySummary[] = (data ?? []).map((o) => ({
    id: o.id as string,
    name: o.name as string,
    type: o.type as string,
    capacity: o.capacity as number | null,
    computedStatus: computeOpportunityStatus({
      statusOverride: o.status_override as string | null,
      applicationOpenAt: o.application_open_at as string | null,
      applicationDeadline: o.application_deadline as string | null,
      activityStartAt: o.activity_start_at as string | null,
      activityEndAt: o.activity_end_at as string | null,
      deactivatedAt: o.deactivated_at as string | null,
    }),
  }));

  // status is computed in JS (not filterable in SQL), so a status filter
  // applies after the fact. total then reflects the filtered set's true
  // size only when no status filter is given; with one, total is the
  // filtered page count — acceptable at Phase 1 scale per the spec's §8
  // no-scale-optimization decision.
  if (input.status) {
    opportunities = opportunities.filter((o) => o.computedStatus === input.status);
    return { opportunities, total: opportunities.length };
  }

  return { opportunities, total: count ?? 0 };
}
