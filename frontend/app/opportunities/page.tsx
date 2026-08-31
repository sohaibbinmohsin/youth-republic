import Link from "next/link";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import { OpportunityCard } from "@/components/OpportunityCard";
import { OPPORTUNITY_TYPES } from "@/lib/opportunityTypes";
import { computeOpportunityStatus } from "@/lib/opportunityStatus";

export const revalidate = 0;

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
      "id, name, type, location, is_online, description, organization_id, status_override, application_open_at, application_deadline, activity_start_at, activity_end_at, deactivated_at",
      { count: "exact" },
    )
    .is("deactivated_at", null);
  if (type) query = query.eq("type", type);

  const { data: rawOpportunities, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  let opportunities = (rawOpportunities ?? []).map((o: any) => ({
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
  const organizationNameById = new Map((organizations ?? []).map((o: any) => [o.id, o.name]));

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
    <div className="space-y-8 font-['Jost']">
      {/* Header */}
      <div className="pb-6 border-b border-[#E7E4DC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-['Oswald'] text-3xl font-bold uppercase tracking-tight text-[#24262D]">
            Explore Opportunities
          </h1>
          <p className="text-sm text-[#6B6B66] mt-1">
            Browse verified community service drives &amp; volunteering programs across Pakistan.
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#941A80]/10 text-[#941A80]">
          {count ?? opportunities.length} Drives Available
        </span>
      </div>

      {/* Filter Toolbar */}
      <form className="p-4 rounded-xl border border-[#E7E4DC] bg-[#F7F5EF] flex flex-wrap items-end gap-4 text-xs font-medium" action="/opportunities" method="get">
        <div className="space-y-1">
          <label htmlFor="type" className="block text-[#6B6B66] uppercase font-['Oswald'] tracking-wider">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type ?? ""}
            className="rounded-lg border border-[#E7E4DC] bg-white px-3 py-2 text-xs text-[#24262D] focus:border-[#941A80] focus:outline-none min-w-[140px]"
          >
            <option value="">All Types</option>
            {OPPORTUNITY_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="status" className="block text-[#6B6B66] uppercase font-['Oswald'] tracking-wider">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-[#E7E4DC] bg-white px-3 py-2 text-xs text-[#24262D] focus:border-[#941A80] focus:outline-none min-w-[140px]"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-[#941A80] hover:bg-[#7C1568] text-white font-semibold transition shadow-sm"
        >
          Filter Results
        </button>

        {(type || status) && (
          <Link
            href="/opportunities"
            className="px-3 py-2 text-xs text-[#6B6B66] hover:text-[#24262D] hover:underline"
          >
            Clear filters
          </Link>
        )}
      </form>

      {/* Grid */}
      {opportunities.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-[#E7E4DC] bg-[#F7F5EF]">
          <p className="text-sm text-[#6B6B66]">No opportunities found matching these filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={{
                ...opportunity,
                organizationName: organizationNameById.get(opportunity.organization_id) ?? "Youth Republic Partner",
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="pt-6 border-t border-[#E7E4DC] flex items-center justify-between text-xs text-[#6B6B66]">
        {page > 1 ? (
          <Link href={pageHref(page - 1)} className="font-semibold text-[#941A80] hover:underline">
            Previous
          </Link>
        ) : (
          <span />
        )}
        <span>
          Page <strong>{page}</strong> of <strong>{totalPages}</strong>
        </span>
        {page < totalPages ? (
          <Link href={pageHref(page + 1)} className="font-semibold text-[#941A80] hover:underline">
            Next
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
