import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeOpportunityStatus,
  listOpportunities,
  listOpportunitiesPublic,
} from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

type Row = Record<string, unknown>;

// In-memory fake of the PostgREST query builder — enough of the surface that
// runOpportunityQuery / computeFacets exercise (select+count, eq, is, ilike,
// or, order, range, in), resolved lazily on await or .range().
function makeDb(tables: Record<string, Row[]>) {
  function builder(tableName: string) {
    const source = () => [...(tables[tableName] ?? [])];
    const filters: ((r: Row) => boolean)[] = [];
    let orClause: { fields: string[]; needle: string } | null = null;
    let sortSpec: { col: string; asc: boolean } | null = null;
    let rangeSpec: { from: number; to: number } | null = null;
    let wantCount = false;

    const resolve = () => {
      let out = source().filter((r) => filters.every((f) => f(r)));
      if (orClause) {
        out = out.filter((r) =>
          orClause!.fields.some((f) =>
            String(r[f] ?? "").toLowerCase().includes(orClause!.needle)
          )
        );
      }
      const count = out.length;
      if (sortSpec) {
        const { col, asc } = sortSpec;
        out = [...out].sort((a, b) => {
          const av = a[col] ?? null;
          const bv = b[col] ?? null;
          if (av === bv) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          return (av > bv ? 1 : -1) * (asc ? 1 : -1);
        });
      }
      if (rangeSpec) out = out.slice(rangeSpec.from, rangeSpec.to + 1);
      return { data: out, error: null, count: wantCount ? count : null };
    };

    // deno-lint-ignore no-explicit-any
    const api: any = {
      select(_sel: string, opts?: { count?: string }) {
        if (opts?.count) wantCount = true;
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        return api;
      },
      is(col: string, val: unknown) {
        filters.push((r) => (r[col] ?? null) === val);
        return api;
      },
      ilike(col: string, pattern: string) {
        const needle = pattern.replace(/%/g, "").toLowerCase();
        filters.push((r) => String(r[col] ?? "").toLowerCase().includes(needle));
        return api;
      },
      or(expr: string) {
        const parts = expr.split(",").map((p) => p.split("."));
        orClause = {
          fields: parts.map((p) => p[0]),
          needle: parts[0].slice(2).join(".").replace(/%/g, "").toLowerCase(),
        };
        return api;
      },
      in(col: string, vals: unknown[]) {
        filters.push((r) => vals.includes(r[col]));
        return api;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        sortSpec = { col, asc: opts?.ascending !== false };
        return api;
      },
      range(from: number, to: number) {
        rangeSpec = { from, to };
        return Promise.resolve(resolve());
      },
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        return Promise.resolve(resolve()).then(onF, onR);
      },
    };
    return api;
  }
  return { from: (t: string) => builder(t) } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

function greenOrg() {
  return { name: "Green Org", logo_url: "https://cdn/green.png" };
}
function edOrg() {
  return { name: "Ed Org", logo_url: "https://cdn/ed.png" };
}

function seedDb() {
  const opportunities: Row[] = [
    {
      id: "o1", name: "Beach Cleanup", type: "environment", description: "Clean the shore",
      location: "Karachi", is_online: false, status_override: null, capacity: 40,
      application_open_at: null, application_deadline: "2099-03-01T00:00:00Z",
      activity_start_at: "2099-03-10T00:00:00Z", activity_end_at: "2099-03-12T00:00:00Z",
      created_at: "2026-01-03T00:00:00Z", deactivated_at: null,
      organization_id: "org-1", organizations: greenOrg(),
    },
    {
      id: "o2", name: "Health Camp", type: "health", description: "Free medical checkup",
      location: "Lahore", is_online: false, status_override: null,
      application_open_at: null, application_deadline: null,
      activity_start_at: null, activity_end_at: null,
      created_at: "2026-01-02T00:00:00Z", deactivated_at: null,
      organization_id: "org-1", organizations: greenOrg(),
    },
    {
      id: "o3", name: "Archived Drive", type: "environment", description: "old drive",
      location: "Karachi", is_online: false, status_override: null,
      application_open_at: null, application_deadline: null,
      activity_start_at: null, activity_end_at: null,
      created_at: "2026-01-01T00:00:00Z", deactivated_at: "2026-02-01T00:00:00Z",
      organization_id: "org-1", organizations: greenOrg(),
    },
    {
      id: "o4", name: "Coding Mentor", type: "education", description: "Teach kids to code",
      location: "Islamabad", is_online: true, status_override: null,
      application_open_at: null, application_deadline: null,
      activity_start_at: null, activity_end_at: null,
      created_at: "2026-01-04T00:00:00Z", deactivated_at: null,
      organization_id: "org-2", organizations: edOrg(),
    },
  ];
  const organizations: Row[] = [
    { id: "org-1", name: "Green Org" },
    { id: "org-2", name: "Ed Org" },
  ];
  // Two confirmed volunteers on o1, none elsewhere — drives filledCount.
  const participation: Row[] = [
    { opportunity_id: "o1", volunteer_id: "v1" },
    { opportunity_id: "o1", volunteer_id: "v2" },
  ];
  return makeDb({ opportunities, organizations, participation });
}

function claims(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, canVerifyIdentity: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: ["opportunities:read"] }],
  };
}

Deno.test("computeOpportunityStatus prefers a manual override over every date-derived status", () => {
  assertEquals(computeOpportunityStatus({
    statusOverride: "closed", applicationOpenAt: null, applicationDeadline: null,
    activityStartAt: null, activityEndAt: null, deactivatedAt: null,
  }), "closed");
});

Deno.test("computeOpportunityStatus is 'closed' once deactivated, with no override", () => {
  assertEquals(computeOpportunityStatus({
    statusOverride: null, applicationOpenAt: null, applicationDeadline: null,
    activityStartAt: null, activityEndAt: null, deactivatedAt: "2026-01-01T00:00:00Z",
  }), "closed");
});

Deno.test("computeOpportunityStatus is 'coming_soon' before applications open", () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  assertEquals(computeOpportunityStatus({
    statusOverride: null, applicationOpenAt: future, applicationDeadline: null,
    activityStartAt: null, activityEndAt: null, deactivatedAt: null,
  }), "coming_soon");
});

Deno.test("computeOpportunityStatus is 'open' with no other signal", () => {
  assertEquals(computeOpportunityStatus({
    statusOverride: null, applicationOpenAt: null, applicationDeadline: null,
    activityStartAt: null, activityEndAt: null, deactivatedAt: null,
  }), "open");
});

Deno.test("listOpportunitiesPublic filters by type and maps each card", async () => {
  const result = await listOpportunitiesPublic(seedDb(), { type: "environment" });

  assertEquals(result.opportunities.length, 1);
  assertEquals(result.opportunities[0].id, "o1");
  assertEquals(result.opportunities[0].orgName, "Green Org");
  assertEquals(result.opportunities[0].orgLogoUrl, "https://cdn/green.png");
  assertEquals(result.opportunities[0].city, "Karachi");
  assertEquals(result.opportunities[0].computedStatus, "open");
});

Deno.test("card carries capacity, filledCount and the date fields", async () => {
  const result = await listOpportunitiesPublic(seedDb(), { type: "environment" });
  const card = result.opportunities[0];
  assertEquals(card.id, "o1");
  assertEquals(card.capacity, 40);
  assertEquals(card.filledCount, 2);
  assertEquals(card.applicationDeadline, "2099-03-01T00:00:00Z");
  assertEquals(card.activityStartAt, "2099-03-10T00:00:00Z");
  assertEquals(card.activityEndAt, "2099-03-12T00:00:00Z");
});

Deno.test("filledCount is 0 for an opportunity with no participation", async () => {
  const result = await listOpportunitiesPublic(seedDb(), { type: "health" });
  assertEquals(result.opportunities[0].filledCount, 0);
});

Deno.test("listOpportunitiesPublic filters by city", async () => {
  const result = await listOpportunitiesPublic(seedDb(), { city: "Karachi" });

  // o3 shares the city but is deactivated, so only o1 comes back.
  assertEquals(result.opportunities.map((o) => o.id), ["o1"]);
});

Deno.test("listOpportunitiesPublic search matches the name (ilike)", async () => {
  const result = await listOpportunitiesPublic(seedDb(), { search: "beach" });
  assertEquals(result.opportunities.map((o) => o.name), ["Beach Cleanup"]);
});

Deno.test("listOpportunitiesPublic search also matches the description (ilike)", async () => {
  const result = await listOpportunitiesPublic(seedDb(), { search: "checkup" });
  assertEquals(result.opportunities.map((o) => o.name), ["Health Camp"]);
});

Deno.test("listOpportunitiesPublic sort 'az' orders by name ascending", async () => {
  const result = await listOpportunitiesPublic(seedDb(), { sort: "az" });
  assertEquals(result.opportunities.map((o) => o.name), ["Beach Cleanup", "Coding Mentor", "Health Camp"]);
});

Deno.test("listOpportunitiesPublic excludes deactivated opportunities", async () => {
  const result = await listOpportunitiesPublic(seedDb(), {});
  assertEquals(result.total, 3);
  assertEquals(result.opportunities.some((o) => o.name === "Archived Drive"), false);
});

Deno.test("facets.cities is the distinct city set of the unfiltered org scope (not the filtered page)", async () => {
  const result = await listOpportunitiesPublic(seedDb(), { city: "Karachi" });

  // page is filtered to Karachi, but facets still reflect every live opportunity
  assertEquals(result.opportunities.map((o) => o.id), ["o1"]);
  assertEquals(result.facets.cities, ["Islamabad", "Karachi", "Lahore"]);
  assertEquals(
    result.facets.orgs.sort((a, b) => a.id.localeCompare(b.id)),
    [{ id: "org-1", name: "Green Org" }, { id: "org-2", name: "Ed Org" }],
  );
});

Deno.test("facets are confined to the org when scoped", async () => {
  const result = await listOpportunities(seedDb(), claims("org-1"), { organizationId: "org-1" });
  assertEquals(result.facets.cities, ["Karachi", "Lahore"]);
  assertEquals(result.facets.orgs, [{ id: "org-1", name: "Green Org" }]);
});

Deno.test("staff variant sees deactivated opportunities in its org", async () => {
  const result = await listOpportunities(seedDb(), claims("org-1"), { organizationId: "org-1" });
  assertEquals(result.total, 3);
  assertEquals(result.opportunities.some((o) => o.name === "Archived Drive"), true);
});

Deno.test("staff variant rejects a caller without opportunities:read for this org", async () => {
  const noPerm: StaffClaims = {
    actorType: "staff", staffId: "staff-1", platformOwner: false, canVerifyIdentity: false, orgRoles: [], moduleAccess: [],
  };
  await assertRejects(
    () => listOpportunities(seedDb(), noPerm, { organizationId: "org-1" }),
    Error,
    "forbidden",
  );
});
