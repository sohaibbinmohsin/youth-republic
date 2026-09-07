import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getVolunteerPortfolio } from "./handler.ts";

type Row = Record<string, unknown>;

// In-memory fake of the PostgREST query builder: eq / in / order / limit /
// single, resolved on await. Joined resources are baked into the fixtures.
function makeDb(tables: Record<string, Row[]>) {
  function builder(name: string) {
    let rows: Row[] = [...(tables[name] ?? [])];
    // deno-lint-ignore no-explicit-any
    const api: any = {
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        rows = rows.filter((r) => (r[col] ?? null) === val);
        return api;
      },
      in(col: string, vals: unknown[]) {
        rows = rows.filter((r) => vals.includes(r[col]));
        return api;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        const asc = opts?.ascending !== false;
        rows = [...rows].sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          if (av === bv) return 0;
          return (av! > bv! ? 1 : -1) * (asc ? 1 : -1);
        });
        return api;
      },
      limit(n: number) {
        rows = rows.slice(0, n);
        return api;
      },
      async single() {
        return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "no rows" } };
      },
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        return Promise.resolve({ data: rows, error: null }).then(onF, onR);
      },
    };
    return api;
  }
  return { from: builder } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

function seedDb() {
  return makeDb({
    volunteers: [{
      id: "v1",
      full_name: "Ayesha Khan",
      volunteer_code: "VOL-2026-000001",
      city: "Lahore",
      institution: "LUMS",
      status: "active",
      created_at: "2025-06-01T00:00:00Z",
    }],
    volunteer_chapter_link: [{
      volunteer_id: "v1",
      linked_at: "2025-07-01T00:00:00Z",
      chapters: { name: "LUMS Chapter" },
    }],
    applications: [
      {
        id: "a1", volunteer_id: "v1", status: "pending_review",
        opportunities: { name: "Tree Plantation", type: "environment", location: "Lahore" },
        organizations: { name: "Green Org", logo_url: "https://cdn/green.png", brand_color: "#1F7A1F" },
      },
      {
        id: "a2", volunteer_id: "v1", status: "rejected",
        opportunities: { name: "Blood Drive", type: "health", location: "Karachi" },
        organizations: { name: "Health Org", logo_url: null, brand_color: null },
      },
      {
        id: "a3", volunteer_id: "v1", status: "selected",
        opportunities: { name: "Coding Camp", type: "education", location: null },
        organizations: { name: "Ed Org", logo_url: "https://cdn/ed.png", brand_color: "#8A7A10" },
      },
    ],
    participation: [
      {
        id: "p1", volunteer_id: "v1", status: "completed",
        opportunities: {
          name: "Tree Plantation", type: "environment",
          activity_start_at: "2025-08-01T00:00:00Z", activity_end_at: "2025-08-10T00:00:00Z",
        },
        organizations: { name: "Green Org", logo_url: "https://cdn/green.png", brand_color: "#1F7A1F" },
      },
      {
        id: "p2", volunteer_id: "v1", status: "completed",
        opportunities: { name: "River Cleanup", type: "environment", activity_start_at: null, activity_end_at: null },
        organizations: { name: "Green Org", logo_url: "https://cdn/green.png", brand_color: "#1F7A1F" },
      },
      {
        id: "p3", volunteer_id: "v1", status: "participating",
        opportunities: { name: "Coding Camp", type: "education", activity_start_at: null, activity_end_at: null },
        organizations: { name: "Ed Org", logo_url: null, brand_color: null },
      },
      {
        id: "p4", volunteer_id: "v1", status: "selected",
        opportunities: { name: "Food Bank", type: "community", activity_start_at: null, activity_end_at: null },
        organizations: { name: "Rizq", logo_url: "https://cdn/rizq.png", brand_color: "#C0392B" },
      },
    ],
    activity_hours: [
      {
        id: "h1", participation_id: "p1", volunteer_id: "v1", activity_date: "2025-08-02",
        hours_submitted: 4, hours_verified: 4, verification_status: "verified", note: "planting", role: "Team Lead",
      },
      {
        id: "h2", participation_id: "p1", volunteer_id: "v1", activity_date: "2025-08-05",
        hours_submitted: 5, hours_verified: 3, verification_status: "verified", note: null, role: null,
      },
      {
        id: "h3", participation_id: "p2", volunteer_id: "v1", activity_date: "2025-09-01",
        hours_submitted: 2, hours_verified: 2, verification_status: "verified", note: null, role: null,
      },
      {
        id: "h4", participation_id: "p2", volunteer_id: "v1", activity_date: "2025-09-08",
        hours_submitted: 3, hours_verified: null, verification_status: "pending", note: "awaiting review", role: null,
      },
      {
        id: "h5", participation_id: "p3", volunteer_id: "v1", activity_date: "2025-10-01",
        hours_submitted: 6, hours_verified: null, verification_status: "pending", note: null, role: null,
      },
    ],
    attachments: [
      { id: "att1", owner_id: "h1", owner_type: "activity_hours", domain: "session_photo", status: "ready" },
      { id: "att2", owner_id: "h1", owner_type: "activity_hours", domain: "session_photo", status: "pending" },
      { id: "att3", owner_id: "h3", owner_type: "activity_hours", domain: "session_photo", status: "ready" },
    ],
  });
}

Deno.test("getVolunteerPortfolio assembles the whole impact screen", async () => {
  const p = await getVolunteerPortfolio(seedDb(), "v1");

  assertEquals(p.volunteer.fullName, "Ayesha Khan");
  assertEquals(p.volunteer.chapterName, "LUMS Chapter");
  assertEquals(p.volunteer.memberSince, "2025-06-01T00:00:00Z");
  assertEquals(p.volunteer.status, "active");

  assertEquals(p.applications.length, 3);
  assertEquals(p.programmes.length, 4);

  // Org branding rides on applications and programmes (A2).
  const a1 = p.applications.find((x) => x.id === "a1")!;
  assertEquals(a1.orgLogoUrl, "https://cdn/green.png");
  assertEquals(a1.orgBrandColor, "#1F7A1F");
  const prog1 = p.programmes.find((x) => x.participationId === "p1")!;
  assertEquals(prog1.orgLogoUrl, "https://cdn/green.png");
  assertEquals(prog1.orgBrandColor, "#1F7A1F");
});

Deno.test("getVolunteerPortfolio totals.verifiedHours sums verified hours_verified client-side", async () => {
  const p = await getVolunteerPortfolio(seedDb(), "v1");
  // 4 (h1) + 3 (h2) + 2 (h3); h4/h5 are pending
  assertEquals(p.totals.verifiedHours, 9);
});

Deno.test("getVolunteerPortfolio totals count completed programmes and active applications", async () => {
  const p = await getVolunteerPortfolio(seedDb(), "v1");
  assertEquals(p.totals.completedProgrammes, 2); // p1, p2
  assertEquals(p.totals.activeApplications, 2); // a1 pending_review, a3 selected
});

Deno.test("getVolunteerPortfolio flags a session whose verified hours differ from submitted", async () => {
  const p = await getVolunteerPortfolio(seedDb(), "v1");
  const p1 = p.programmes.find((x) => x.participationId === "p1")!;
  const h1 = p1.sessions.find((s) => s.id === "h1")!;
  const h2 = p1.sessions.find((s) => s.id === "h2")!;
  assertEquals(h1.adjusted, false);
  assertEquals(h2.adjusted, true);
  assertEquals(h2.hours, 3); // effective (verified) hours
});

Deno.test("getVolunteerPortfolio allVerified is false when any session is unverified", async () => {
  const p = await getVolunteerPortfolio(seedDb(), "v1");
  assertEquals(p.programmes.find((x) => x.participationId === "p1")!.allVerified, true);
  assertEquals(p.programmes.find((x) => x.participationId === "p2")!.allVerified, false);
  assertEquals(p.programmes.find((x) => x.participationId === "p4")!.allVerified, false); // no sessions
});

Deno.test("getVolunteerPortfolio attaches only ready session photos to their session", async () => {
  const p = await getVolunteerPortfolio(seedDb(), "v1");
  const p1 = p.programmes.find((x) => x.participationId === "p1")!;
  assertEquals(p1.sessions.find((s) => s.id === "h1")!.photoAttachmentIds, ["att1"]); // att2 is pending
  assertEquals(p1.sessions.find((s) => s.id === "h2")!.photoAttachmentIds, []);
});

Deno.test("getVolunteerPortfolio programme carries hours totals and role from sessions", async () => {
  const p = await getVolunteerPortfolio(seedDb(), "v1");
  const p1 = p.programmes.find((x) => x.participationId === "p1")!;
  assertEquals(p1.hoursTotal, 9); // 4 + 5 submitted
  assertEquals(p1.hoursVerified, 7); // 4 + 3 verified
  assertEquals(p1.role, "Team Lead");
  assertEquals(p1.startDate, "2025-08-01T00:00:00Z");
});

Deno.test("getVolunteerPortfolio throws not_found for an unknown volunteer", async () => {
  await assertRejects(
    () => getVolunteerPortfolio(makeDb({}), "ghost"),
    Error,
    "not_found",
  );
});
