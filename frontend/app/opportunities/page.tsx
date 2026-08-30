import Link from "next/link";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import { OpportunityCard } from "@/components/OpportunityCard";
import { OPPORTUNITY_TYPES } from "@/lib/opportunityTypes";
import { computeOpportunityStatus } from "@/lib/opportunityStatus";

export const revalidate = 60;

const PAGE_SIZE = 12;
const STATUSES = ["coming_soon", "open", "closed", "in_progress", "completed"] as const;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; page?: string }>;
}) {
  const { type, status, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await getServerSupabaseClient();
  let query = supabase
    .from("opportunities")
    .select(
      "id, name, type, location, organization_id, status_override, application_open_at, application_deadline, activity_start_at, activity_end_at, deactivated_at",
      { count: "exact" },
    )
    .is("deactivated_at", null);
  if (type) query = query.eq("type", type);

  const { data: rawOpportunities, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  let opportunities = (rawOpportunities ?? []).map((o) => ({
    ...o,
    computedStatus: computeOpportunityStatus({
      statusOverride: o.status_override,
      applicationOpenAt: o.application_open_at,
      applicationDeadline: o.application_deadline,
      activityStartAt: o.activity_start_at,
      activityEndAt: o.activity_end_at,
      deactivatedAt: o.deactivated_at,
    }),
  }));
  if (status) opportunities = opportunities.filter((o) => o.computedStatus === status);

  const organizationIds = [...new Set(opportunities.map((o) => o.organization_id))];
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", organizationIds);
  const organizationNameById = new Map((organizations ?? []).map((o) => [o.id, o.name]));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  function pageHref(targetPage: number, overrides: { type?: string; status?: string } = {}) {
    const params = new URLSearchParams();
    const effectiveType = overrides.type ?? type;
    const effectiveStatus = overrides.status ?? status;
    if (effectiveType) params.set("type", effectiveType);
    if (effectiveStatus) params.set("status", effectiveStatus);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/opportunities?${query}` : "/opportunities";
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Opportunities</h1>

      <form className="mb-4 flex gap-4" action="/opportunities" method="get">
        <div>
          <label htmlFor="type" className="block text-sm">Type</label>
          <select id="type" name="type" defaultValue={type ?? ""} className="mt-1 rounded border px-3 py-2">
            <option value="">All</option>
            {OPPORTUNITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="mt-1 rounded border px-3 py-2">
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="mt-auto rounded bg-gray-900 px-4 py-2 text-white">Filter</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {opportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={{
              ...opportunity,
              organizationName: organizationNameById.get(opportunity.organization_id) ?? "Unknown organization",
            }}
          />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        {page > 1 ? (
          <Link href={pageHref(page - 1)} className="underline">Previous</Link>
        ) : (
          <span />
        )}
        <span>Page {page} of {totalPages}</span>
        {page < totalPages ? (
          <Link href={pageHref(page + 1)} className="underline">Next</Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
