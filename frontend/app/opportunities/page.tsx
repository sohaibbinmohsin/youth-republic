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
    <div className="space-y-6">
      {/* Header */}
      <div style={{ paddingBottom: "1.5rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="display" style={{ fontSize: "2.4rem" }}>
            Explore Opportunities
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: "1rem", marginTop: ".5rem" }}>
            Browse verified community service drives & volunteering programs across Pakistan.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <form
        action="/opportunities"
        method="get"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "1rem",
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "1rem 1.25rem",
          fontSize: ".88rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <label htmlFor="type" style={{ fontWeight: 600, fontSize: ".82rem", textTransform: "uppercase", letterSpacing: ".08em", fontFamily: "Oswald, sans-serif" }}>
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type ?? ""}
            style={{ padding: ".4rem 1.8rem .4rem .6rem", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", font: "inherit" }}
          >
            <option value="">All Types</option>
            {OPPORTUNITY_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <label htmlFor="status" style={{ fontWeight: 600, fontSize: ".82rem", textTransform: "uppercase", letterSpacing: ".08em", fontFamily: "Oswald, sans-serif" }}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            style={{ padding: ".4rem 1.8rem .4rem .6rem", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", font: "inherit" }}
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn--primary btn--sm">
          Filter
        </button>

        {(type || status) && (
          <Link href="/opportunities" style={{ fontSize: ".82rem", color: "var(--blue)" }}>
            Clear filters
          </Link>
        )}
      </form>

      {/* Grid */}
      {opportunities.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", border: "1px dashed var(--line)", borderRadius: "var(--radius-card)", background: "var(--bg-2)", color: "var(--ink-2)", fontSize: ".9rem" }}>
          No opportunities found matching these filters.
        </div>
      ) : (
        <div className="cards">
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
      <div className="pager">
        {page > 1 ? (
          <Link href={pageHref(page - 1)}>
            Previous
          </Link>
        ) : (
          <span />
        )}
        <span style={{ alignSelf: "center", fontSize: ".85rem", color: "var(--ink-2)" }}>
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={pageHref(page + 1)}>
            Next
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
