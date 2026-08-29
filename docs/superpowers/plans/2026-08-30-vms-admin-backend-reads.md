# VMS Admin Backend Reads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the 7 read/aggregation Edge Functions the VMS admin portal needs (list/detail/KPI), plus extend `export-csv` to 2 more resources — closing the gap that every existing `vms/backend` function is a single-resource write or one of 2 CSV exports, with nothing answering "list/search/filter" or "aggregate" questions.

**Architecture:** One Edge Function per resource, matching this repo's existing convention exactly (`handler.ts` pure function + CORS-wrapped `index.ts` + both files' own tests). Filtering that spans two tables (e.g. "activity hours by participation status") resolves the filtering table's matching ids first with a plain query, then filters the target table with `.in(...)` — no embedded-relation filter syntax, no new SQL functions, nothing beyond what `.eq()`/`.in()`/`.range()` already do elsewhere in this repo. Zero new migrations; every table these functions read already exists.

**Tech Stack:** Deno, `@supabase/supabase-js`, existing `_shared/verifyStaffToken.ts` (`StaffClaims`, `staffHasPermission`), `_shared/supabaseAdmin.ts` (`getAdminClient`), `_shared/cors.ts` (`corsHeaders`, `handleCorsPreflight`).

**Spec:** `tmp-partner-admin/docs/superpowers/specs/2026-08-30-vms-admin-portal-design.md` §3–5.

## Global Constraints

- Every handler's first line of real logic is a `staffHasPermission(staffClaims, organizationId, "vms", "<resource>:read")` check, throwing `new Error("forbidden")` on failure — exactly the pattern every existing write handler already uses.
- Pagination is `limit`/`offset` on every list endpoint, `limit` clamped to a max of 100, defaulting to 25 when omitted.
- No handler ever selects `activity_hours.admin_notes` unless the function itself is one of the two explicitly admin-only ones in this plan (`get-volunteer-detail`, `list-activity-hours`) — never add it to any other query.
- `organizationId` is always taken from the caller's own input for these read endpoints (there's no "stored" organization_id to cross-check against, unlike the write handlers' cross-tenant-trust fix from the earlier review — a read only returns rows already scoped to the org the caller passed and is permission-gated on that same org, so there's nothing else to trust or not trust here).
- Every new file is created under `backend/supabase/functions/`, run from `backend/supabase/` for local commands: `set -a; source ../.env; set +a` before any `deno test`/`supabase` command, per this repo's established environment setup.
- Full local test command after every task: `cd backend/supabase && set -a; source ../.env; set +a && deno task test` (must show 0 failed) — this repo has no local Docker stack; tests run against the real hosted project.

---

### Task 1: `list-volunteers`

**Files:**
- Create: `backend/supabase/functions/list-volunteers/handler.ts`
- Create: `backend/supabase/functions/list-volunteers/handler.test.ts`
- Create: `backend/supabase/functions/list-volunteers/index.ts`
- Create: `backend/supabase/functions/list-volunteers/index.test.ts`

**Interfaces:**
- Consumes: `StaffClaims`, `staffHasPermission` from `../_shared/verifyStaffToken.ts`; `getAdminClient` from `../_shared/supabaseAdmin.ts`; `corsHeaders`, `handleCorsPreflight` from `../_shared/cors.ts`.
- Produces: `listVolunteers(supabase, staffClaims, input: ListVolunteersInput): Promise<ListVolunteersResult>` — `input: { organizationId: string; search?: string; city?: string; province?: string; institution?: string; status?: string; limit?: number; offset?: number }`, `result: { volunteers: VolunteerSummary[]; total: number }`, `VolunteerSummary: { id: string; volunteerCode: string; fullName: string; email: string; phone: string; city: string; province: string; institution: string; status: string }`.

- [ ] **Step 1: Write the failing handler test**

```typescript
// backend/supabase/functions/list-volunteers/handler.test.ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listVolunteers } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeOrg(supabase: ReturnType<typeof testClient>) {
  const { data } = await supabase.from("organizations").insert({
    name: "List Volunteers Test Org",
    slug: `list-volunteers-${crypto.randomUUID()}`,
  }).select("id").single();
  return data!.id as string;
}

async function makeVolunteer(
  supabase: ReturnType<typeof testClient>,
  overrides: Partial<{ full_name: string; city: string; province: string; institution: string; status: string }> = {},
) {
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `list-volunteers-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError || !authUser.user) throw new Error(`failed to create auth user: ${authError?.message}`);
  const email = `list-volunteers-${crypto.randomUUID()}@example.com`;
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user.id,
    full_name: overrides.full_name ?? "Test Volunteer",
    email,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "female",
    city: overrides.city ?? "Lahore",
    province: overrides.province ?? "Punjab",
    country: "Pakistan",
    institution: overrides.institution ?? "LUMS",
    degree_program: "BSCS",
    status: overrides.status ?? "active",
  }).select("id").single();
  return data!.id as string;
}

async function linkToOrg(supabase: ReturnType<typeof testClient>, orgId: string, volunteerId: string) {
  await supabase.from("org_volunteer_index").insert({ organization_id: orgId, volunteer_id: volunteerId });
}

function claimsWithPermission(orgId: string, permission: string): StaffClaims {
  return {
    actorType: "staff",
    staffId: "staff-1",
    platformOwner: false,
    orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: [permission] }],
  };
}

Deno.test("listVolunteers returns only volunteers linked to the given org", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const otherOrgId = await makeOrg(supabase);
  const inOrgId = await makeVolunteer(supabase, { full_name: "In Org" });
  const otherOrgVolunteerId = await makeVolunteer(supabase, { full_name: "Other Org" });
  await linkToOrg(supabase, orgId, inOrgId);
  await linkToOrg(supabase, otherOrgId, otherOrgVolunteerId);

  const result = await listVolunteers(supabase, claimsWithPermission(orgId, "volunteers:read"), { organizationId: orgId });

  assertEquals(result.volunteers.length, 1);
  assertEquals(result.volunteers[0].id, inOrgId);
});

Deno.test("listVolunteers filters by city, province, institution, and status together", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const match = await makeVolunteer(supabase, { city: "Karachi", province: "Sindh", institution: "IBA", status: "active" });
  const wrongCity = await makeVolunteer(supabase, { city: "Lahore", province: "Sindh", institution: "IBA", status: "active" });
  await linkToOrg(supabase, orgId, match);
  await linkToOrg(supabase, orgId, wrongCity);

  const result = await listVolunteers(supabase, claimsWithPermission(orgId, "volunteers:read"), {
    organizationId: orgId, city: "Karachi", province: "Sindh", institution: "IBA", status: "active",
  });

  assertEquals(result.volunteers.length, 1);
  assertEquals(result.volunteers[0].id, match);
});

Deno.test("listVolunteers searches by name, email, or phone", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const target = await makeVolunteer(supabase, { full_name: "Aisha Khan Searchable" });
  const other = await makeVolunteer(supabase, { full_name: "Unrelated Person" });
  await linkToOrg(supabase, orgId, target);
  await linkToOrg(supabase, orgId, other);

  const result = await listVolunteers(supabase, claimsWithPermission(orgId, "volunteers:read"), {
    organizationId: orgId, search: "Searchable",
  });

  assertEquals(result.volunteers.length, 1);
  assertEquals(result.volunteers[0].id, target);
});

Deno.test("listVolunteers paginates with limit/offset and reports total across all pages", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  for (let i = 0; i < 3; i++) {
    const id = await makeVolunteer(supabase, { full_name: `Page Test ${i}` });
    await linkToOrg(supabase, orgId, id);
  }

  const page1 = await listVolunteers(supabase, claimsWithPermission(orgId, "volunteers:read"), {
    organizationId: orgId, limit: 2, offset: 0,
  });
  const page2 = await listVolunteers(supabase, claimsWithPermission(orgId, "volunteers:read"), {
    organizationId: orgId, limit: 2, offset: 2,
  });

  assertEquals(page1.volunteers.length, 2);
  assertEquals(page1.total, 3);
  assertEquals(page2.volunteers.length, 1);
  assertEquals(page2.total, 3);
});

Deno.test("listVolunteers rejects a caller without volunteers:read for this org", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const claims: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(() => listVolunteers(supabase, claims, { organizationId: orgId }), Error, "forbidden");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno test --allow-net --allow-env functions/list-volunteers/handler.test.ts`
Expected: FAIL — `Cannot find module '.../list-volunteers/handler.ts'` (TS2307).

- [ ] **Step 3: Write the handler**

```typescript
// backend/supabase/functions/list-volunteers/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface ListVolunteersInput {
  organizationId: string;
  search?: string;
  city?: string;
  province?: string;
  institution?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface VolunteerSummary {
  id: string;
  volunteerCode: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  institution: string;
  status: string;
}

export interface ListVolunteersResult {
  volunteers: VolunteerSummary[];
  total: number;
}

export async function listVolunteers(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListVolunteersInput,
): Promise<ListVolunteersResult> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "volunteers:read")) {
    throw new Error("forbidden");
  }

  const { data: indexRows, error: indexError } = await supabase
    .from("org_volunteer_index")
    .select("volunteer_id")
    .eq("organization_id", input.organizationId);
  if (indexError) throw indexError;
  const volunteerIds = (indexRows ?? []).map((r) => r.volunteer_id as string);
  if (volunteerIds.length === 0) return { volunteers: [], total: 0 };

  const limit = Math.min(input.limit ?? 25, 100);
  const offset = input.offset ?? 0;

  let query = supabase
    .from("volunteers")
    .select("id, volunteer_code, full_name, email, phone, city, province, institution, status", { count: "exact" })
    .in("id", volunteerIds);

  if (input.city) query = query.eq("city", input.city);
  if (input.province) query = query.eq("province", input.province);
  if (input.institution) query = query.eq("institution", input.institution);
  if (input.status) query = query.eq("status", input.status);
  if (input.search) {
    const term = `%${input.search}%`;
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }

  const { data, error, count } = await query.order("full_name", { ascending: true }).range(offset, offset + limit - 1);
  if (error) throw error;

  return {
    volunteers: (data ?? []).map((v) => ({
      id: v.id as string,
      volunteerCode: v.volunteer_code as string,
      fullName: v.full_name as string,
      email: v.email as string,
      phone: v.phone as string,
      city: v.city as string,
      province: v.province as string,
      institution: v.institution as string,
      status: v.status as string,
    })),
    total: count ?? 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same command as Step 2.
Expected: `ok | 5 passed | 0 failed`.

- [ ] **Step 5: Write the index.ts wrapper**

```typescript
// backend/supabase/functions/list-volunteers/index.ts
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { listVolunteers } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const input = await req.json();
    const result = await listVolunteers(getAdminClient(), claims, input);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) Deno.serve(handler);
```

- [ ] **Step 6: Write the index.ts CORS tests**

```typescript
// backend/supabase/functions/list-volunteers/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";

function optionsRequest(): Request {
  return new Request("https://example.com/fn", { method: "OPTIONS" });
}

function jsonRequest(body: unknown, accessToken?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  return new Request("https://example.com/fn", { method: "POST", headers, body: JSON.stringify(body) });
}

Deno.test("list-volunteers index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handler(optionsRequest());
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("list-volunteers index carries CORS headers on an error response", async () => {
  const res = await handler(jsonRequest({ organizationId: "x" }));
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
```

- [ ] **Step 7: Run the full suite and verify no regressions**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno task test`
Expected: all tests pass, including the 7 new ones for `list-volunteers`.

- [ ] **Step 8: Commit**

```bash
git add backend/supabase/functions/list-volunteers/
git commit -m "feat: add list-volunteers Edge Function for the admin portal"
```

---

### Task 2: `get-volunteer-detail`

**Files:**
- Create: `backend/supabase/functions/get-volunteer-detail/handler.ts`
- Create: `backend/supabase/functions/get-volunteer-detail/handler.test.ts`
- Create: `backend/supabase/functions/get-volunteer-detail/index.ts`
- Create: `backend/supabase/functions/get-volunteer-detail/index.test.ts`

**Interfaces:**
- Consumes: same shared modules as Task 1.
- Produces: `getVolunteerDetail(supabase, staffClaims, input: { organizationId: string; volunteerId: string }): Promise<VolunteerDetail>` — `VolunteerDetail: { id: string; volunteerCode: string; fullName: string; email: string; phone: string; city: string; province: string; institution: string; status: string; applications: ApplicationSummary[]; participations: ParticipationSummary[]; activity: ActivityDetailRow[] }`, `ApplicationSummary: { id: string; status: string; opportunityName: string; appliedAt: string }`, `ParticipationSummary: { id: string; status: string; opportunityName: string }`, `ActivityDetailRow: { id: string; role: string | null; activityDate: string; hoursSubmitted: number; hoursVerified: number | null; verificationStatus: string; adminNotes: string | null; opportunityName: string }`.

This is deliberately admin-only data (it's the one place `admin_notes` is read alongside the volunteer's identity) — never reuse this handler's query shape in a volunteer-facing endpoint.

- [ ] **Step 1: Write the failing handler test**

```typescript
// backend/supabase/functions/get-volunteer-detail/handler.test.ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { getVolunteerDetail } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function claimsWithPermission(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["volunteers:read"] }],
  };
}

async function setup(supabase: ReturnType<typeof testClient>) {
  const { data: org } = await supabase.from("organizations").insert({
    name: "Volunteer Detail Test Org", slug: `vol-detail-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;

  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `vol-detail-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "Detail Test Volunteer",
    email: `vol-detail-${crypto.randomUUID()}@example.com`, phone: "0300-1111111",
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();
  const volunteerId = volunteer!.id as string;
  await supabase.from("org_volunteer_index").insert({ organization_id: orgId, volunteer_id: volunteerId });

  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Detail Test Opportunity", type: "environment",
  }).select("id").single();
  const opportunityId = opportunity!.id as string;

  const { data: application } = await supabase.from("applications").insert({
    volunteer_id: volunteerId, opportunity_id: opportunityId, organization_id: orgId, status: "selected",
  }).select("id").single();

  const { data: participation } = await supabase.from("participation").insert({
    application_id: application!.id, volunteer_id: volunteerId, opportunity_id: opportunityId,
    organization_id: orgId, status: "completed",
  }).select("id").single();

  await supabase.from("activity_hours").insert({
    participation_id: participation!.id, volunteer_id: volunteerId, opportunity_id: opportunityId,
    organization_id: orgId, activity_date: "2026-02-01", hours_submitted: 5, hours_verified: 5,
    verification_status: "verified", admin_notes: "Internal-only note",
  });

  return { orgId, volunteerId };
}

Deno.test("getVolunteerDetail returns the volunteer plus every application, participation, and activity row, including admin_notes", async () => {
  const supabase = testClient();
  const { orgId, volunteerId } = await setup(supabase);

  const result = await getVolunteerDetail(supabase, claimsWithPermission(orgId), { organizationId: orgId, volunteerId });

  assertEquals(result.id, volunteerId);
  assertEquals(result.applications.length, 1);
  assertEquals(result.applications[0].opportunityName, "Detail Test Opportunity");
  assertEquals(result.participations.length, 1);
  assertEquals(result.participations[0].status, "completed");
  assertEquals(result.activity.length, 1);
  assertEquals(result.activity[0].adminNotes, "Internal-only note");
  assertEquals(result.activity[0].hoursVerified, 5);
});

Deno.test("getVolunteerDetail rejects a caller without volunteers:read for this org", async () => {
  const supabase = testClient();
  const { volunteerId } = await setup(supabase);
  const otherOrgId = crypto.randomUUID();
  const claims: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(
    () => getVolunteerDetail(supabase, claims, { organizationId: otherOrgId, volunteerId }),
    Error,
    "forbidden",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno test --allow-net --allow-env functions/get-volunteer-detail/handler.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the handler**

```typescript
// backend/supabase/functions/get-volunteer-detail/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface GetVolunteerDetailInput {
  organizationId: string;
  volunteerId: string;
}

export interface VolunteerDetail {
  id: string;
  volunteerCode: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  institution: string;
  status: string;
  applications: Array<{ id: string; status: string; opportunityName: string; appliedAt: string }>;
  participations: Array<{ id: string; status: string; opportunityName: string }>;
  activity: Array<{
    id: string;
    role: string | null;
    activityDate: string;
    hoursSubmitted: number;
    hoursVerified: number | null;
    verificationStatus: string;
    adminNotes: string | null;
    opportunityName: string;
  }>;
}

export async function getVolunteerDetail(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: GetVolunteerDetailInput,
): Promise<VolunteerDetail> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "volunteers:read")) {
    throw new Error("forbidden");
  }

  const { data: volunteer, error: volunteerError } = await supabase
    .from("volunteers")
    .select("id, volunteer_code, full_name, email, phone, city, province, institution, status")
    .eq("id", input.volunteerId)
    .single();
  if (volunteerError) throw volunteerError;

  const { data: applicationRows, error: applicationsError } = await supabase
    .from("applications")
    .select("id, status, applied_at, opportunities(name)")
    .eq("volunteer_id", input.volunteerId)
    .eq("organization_id", input.organizationId);
  if (applicationsError) throw applicationsError;

  const { data: participationRows, error: participationError } = await supabase
    .from("participation")
    .select("id, status, opportunities(name)")
    .eq("volunteer_id", input.volunteerId)
    .eq("organization_id", input.organizationId);
  if (participationError) throw participationError;

  const { data: activityRows, error: activityError } = await supabase
    .from("activity_hours")
    .select("id, role, activity_date, hours_submitted, hours_verified, verification_status, admin_notes, opportunities(name)")
    .eq("volunteer_id", input.volunteerId)
    .eq("organization_id", input.organizationId)
    .order("activity_date", { ascending: true });
  if (activityError) throw activityError;

  return {
    id: volunteer!.id as string,
    volunteerCode: volunteer!.volunteer_code as string,
    fullName: volunteer!.full_name as string,
    email: volunteer!.email as string,
    phone: volunteer!.phone as string,
    city: volunteer!.city as string,
    province: volunteer!.province as string,
    institution: volunteer!.institution as string,
    status: volunteer!.status as string,
    applications: (applicationRows ?? []).map((r) => ({
      id: r.id as string,
      status: r.status as string,
      opportunityName: (r.opportunities as unknown as { name: string })?.name ?? "",
      appliedAt: r.applied_at as string,
    })),
    participations: (participationRows ?? []).map((r) => ({
      id: r.id as string,
      status: r.status as string,
      opportunityName: (r.opportunities as unknown as { name: string })?.name ?? "",
    })),
    activity: (activityRows ?? []).map((r) => ({
      id: r.id as string,
      role: r.role as string | null,
      activityDate: r.activity_date as string,
      hoursSubmitted: r.hours_submitted as number,
      hoursVerified: r.hours_verified as number | null,
      verificationStatus: r.verification_status as string,
      adminNotes: r.admin_notes as string | null,
      opportunityName: (r.opportunities as unknown as { name: string })?.name ?? "",
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2. Expected: `ok | 2 passed | 0 failed`.

- [ ] **Step 5: Write the index.ts wrapper**

```typescript
// backend/supabase/functions/get-volunteer-detail/index.ts
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getVolunteerDetail } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const input = await req.json();
    const result = await getVolunteerDetail(getAdminClient(), claims, input);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) Deno.serve(handler);
```

- [ ] **Step 6: Write the index.ts CORS tests**

```typescript
// backend/supabase/functions/get-volunteer-detail/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";

Deno.test("get-volunteer-detail index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handler(new Request("https://example.com/fn", { method: "OPTIONS" }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("get-volunteer-detail index carries CORS headers on an error response", async () => {
  const res = await handler(
    new Request("https://example.com/fn", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: "x", volunteerId: "y" }),
    }),
  );
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
```

- [ ] **Step 7: Run the full suite and verify no regressions**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno task test`

- [ ] **Step 8: Commit**

```bash
git add backend/supabase/functions/get-volunteer-detail/
git commit -m "feat: add get-volunteer-detail Edge Function for the admin portal"
```

---

### Task 3: `list-opportunities`

**Files:**
- Create: `backend/supabase/functions/list-opportunities/handler.ts`
- Create: `backend/supabase/functions/list-opportunities/handler.test.ts`
- Create: `backend/supabase/functions/list-opportunities/index.ts`
- Create: `backend/supabase/functions/list-opportunities/index.test.ts`

**Interfaces:**
- Consumes: same shared modules as Task 1; the existing `opportunity_status(o opportunities) returns text` Postgres function (already defined in `0003_opportunities.sql`) — call it via `.select("*, opportunity_status:opportunity_status(id)")`-style RPC is not how a table function on a row works from supabase-js; instead select the raw columns needed to compute status and call the SQL function per-row via `.rpc()` is wasteful for a list. Simplest: select `status_override`, `application_open_at`, `application_deadline`, `activity_start_at`, `activity_end_at`, `deactivated_at` directly and reuse this task's own `computeOpportunityStatus()` port of the same logic already in `0003_opportunities.sql`, so the list doesn't need N+1 RPC calls per row. Document why in the handler (see Step 3).
- Produces: `listOpportunities(supabase, staffClaims, input: ListOpportunitiesInput): Promise<ListOpportunitiesResult>` — `input: { organizationId: string; type?: string; status?: string; limit?: number; offset?: number }`, `result: { opportunities: OpportunitySummary[]; total: number }`, `OpportunitySummary: { id: string; name: string; type: string; computedStatus: string; capacity: number | null }`, and the exported helper `computeOpportunityStatus(o: OpportunityStatusInputs): string`.

- [ ] **Step 1: Write the failing handler test**

```typescript
// backend/supabase/functions/list-opportunities/handler.test.ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listOpportunities, computeOpportunityStatus } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function claims(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["opportunities:read"] }],
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

Deno.test("listOpportunities filters by type and returns each row's computed status", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "List Opportunities Test Org", slug: `list-opps-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;

  await supabase.from("opportunities").insert([
    { organization_id: orgId, name: "Environment Opp", type: "environment" },
    { organization_id: orgId, name: "Health Opp", type: "health" },
  ]);

  const result = await listOpportunities(supabase, claims(orgId), { organizationId: orgId, type: "environment" });

  assertEquals(result.opportunities.length, 1);
  assertEquals(result.opportunities[0].name, "Environment Opp");
  assertEquals(result.opportunities[0].computedStatus, "open");
});

Deno.test("listOpportunities rejects a caller without opportunities:read for this org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const noPerm: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(() => listOpportunities(supabase, noPerm, { organizationId: orgId }), Error, "forbidden");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno test --allow-net --allow-env functions/list-opportunities/handler.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the handler**

```typescript
// backend/supabase/functions/list-opportunities/handler.ts
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
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "opportunities:read")) {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2. Expected: `ok | 6 passed | 0 failed`.

- [ ] **Step 5: Write the index.ts wrapper**

```typescript
// backend/supabase/functions/list-opportunities/index.ts
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { listOpportunities } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const input = await req.json();
    const result = await listOpportunities(getAdminClient(), claims, input);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) Deno.serve(handler);
```

- [ ] **Step 6: Write the index.ts CORS tests**

```typescript
// backend/supabase/functions/list-opportunities/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";

Deno.test("list-opportunities index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handler(new Request("https://example.com/fn", { method: "OPTIONS" }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("list-opportunities index carries CORS headers on an error response", async () => {
  const res = await handler(
    new Request("https://example.com/fn", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: "x" }),
    }),
  );
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
```

- [ ] **Step 7: Run the full suite and verify no regressions**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno task test`

- [ ] **Step 8: Commit**

```bash
git add backend/supabase/functions/list-opportunities/
git commit -m "feat: add list-opportunities Edge Function for the admin portal"
```

---

### Task 4: `list-participation-for-opportunity`

**Files:**
- Create: `backend/supabase/functions/list-participation-for-opportunity/handler.ts`
- Create: `backend/supabase/functions/list-participation-for-opportunity/handler.test.ts`
- Create: `backend/supabase/functions/list-participation-for-opportunity/index.ts`
- Create: `backend/supabase/functions/list-participation-for-opportunity/index.test.ts`

**Interfaces:**
- Consumes: same shared modules as Task 1.
- Produces: `listParticipationForOpportunity(supabase, staffClaims, input: { organizationId: string; opportunityId: string }): Promise<{ applicants: ApplicantRow[]; participants: ParticipantRow[] }>` — `ApplicantRow: { applicationId: string; volunteerId: string; volunteerName: string; status: string; appliedAt: string }`, `ParticipantRow: { participationId: string; volunteerId: string; volunteerName: string; status: string }`.

- [ ] **Step 1: Write the failing handler test**

```typescript
// backend/supabase/functions/list-participation-for-opportunity/handler.test.ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listParticipationForOpportunity } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function claims(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["participation:read"] }],
  };
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>, name: string) {
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `participation-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: name,
    email: `participation-${crypto.randomUUID()}@example.com`, phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();
  return data!.id as string;
}

Deno.test("listParticipationForOpportunity returns applicants (from applications) and participants (from participation) separately", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Participation Test Org", slug: `participation-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Participation Test Opp", type: "environment",
  }).select("id").single();
  const opportunityId = opportunity!.id as string;

  const applicantOnlyId = await makeVolunteer(supabase, "Applicant Only");
  const selectedId = await makeVolunteer(supabase, "Selected Volunteer");

  await supabase.from("applications").insert([
    { volunteer_id: applicantOnlyId, opportunity_id: opportunityId, organization_id: orgId, status: "submitted" },
    { volunteer_id: selectedId, opportunity_id: opportunityId, organization_id: orgId, status: "selected" },
  ]);
  await supabase.from("participation").insert({
    volunteer_id: selectedId, opportunity_id: opportunityId, organization_id: orgId, status: "participating",
  });

  const result = await listParticipationForOpportunity(supabase, claims(orgId), { organizationId: orgId, opportunityId });

  assertEquals(result.applicants.length, 2);
  assertEquals(result.participants.length, 1);
  assertEquals(result.participants[0].volunteerName, "Selected Volunteer");
});

Deno.test("listParticipationForOpportunity rejects a caller without participation:read for this org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const noPerm: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(
    () => listParticipationForOpportunity(supabase, noPerm, { organizationId: orgId, opportunityId: crypto.randomUUID() }),
    Error,
    "forbidden",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno test --allow-net --allow-env functions/list-participation-for-opportunity/handler.test.ts`

- [ ] **Step 3: Write the handler**

```typescript
// backend/supabase/functions/list-participation-for-opportunity/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface ListParticipationForOpportunityInput {
  organizationId: string;
  opportunityId: string;
}

export interface ApplicantRow {
  applicationId: string;
  volunteerId: string;
  volunteerName: string;
  status: string;
  appliedAt: string;
}

export interface ParticipantRow {
  participationId: string;
  volunteerId: string;
  volunteerName: string;
  status: string;
}

export async function listParticipationForOpportunity(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListParticipationForOpportunityInput,
): Promise<{ applicants: ApplicantRow[]; participants: ParticipantRow[] }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "participation:read")) {
    throw new Error("forbidden");
  }

  const { data: applicationRows, error: applicationsError } = await supabase
    .from("applications")
    .select("id, status, applied_at, volunteer_id, volunteers(full_name)")
    .eq("organization_id", input.organizationId)
    .eq("opportunity_id", input.opportunityId);
  if (applicationsError) throw applicationsError;

  const { data: participationRows, error: participationError } = await supabase
    .from("participation")
    .select("id, status, volunteer_id, volunteers(full_name)")
    .eq("organization_id", input.organizationId)
    .eq("opportunity_id", input.opportunityId);
  if (participationError) throw participationError;

  return {
    applicants: (applicationRows ?? []).map((r) => ({
      applicationId: r.id as string,
      volunteerId: r.volunteer_id as string,
      volunteerName: (r.volunteers as unknown as { full_name: string })?.full_name ?? "",
      status: r.status as string,
      appliedAt: r.applied_at as string,
    })),
    participants: (participationRows ?? []).map((r) => ({
      participationId: r.id as string,
      volunteerId: r.volunteer_id as string,
      volunteerName: (r.volunteers as unknown as { full_name: string })?.full_name ?? "",
      status: r.status as string,
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2. Expected: `ok | 2 passed | 0 failed`.

- [ ] **Step 5: Write the index.ts wrapper**

```typescript
// backend/supabase/functions/list-participation-for-opportunity/index.ts
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { listParticipationForOpportunity } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const input = await req.json();
    const result = await listParticipationForOpportunity(getAdminClient(), claims, input);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) Deno.serve(handler);
```

- [ ] **Step 6: Write the index.ts CORS tests**

```typescript
// backend/supabase/functions/list-participation-for-opportunity/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";

Deno.test("list-participation-for-opportunity index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handler(new Request("https://example.com/fn", { method: "OPTIONS" }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("list-participation-for-opportunity index carries CORS headers on an error response", async () => {
  const res = await handler(
    new Request("https://example.com/fn", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: "x", opportunityId: "y" }),
    }),
  );
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
```

- [ ] **Step 7: Run the full suite and verify no regressions**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno task test`

- [ ] **Step 8: Commit**

```bash
git add backend/supabase/functions/list-participation-for-opportunity/
git commit -m "feat: add list-participation-for-opportunity Edge Function for the admin portal"
```

---

### Task 5: `list-applications`

**Files:**
- Create: `backend/supabase/functions/list-applications/handler.ts`
- Create: `backend/supabase/functions/list-applications/handler.test.ts`
- Create: `backend/supabase/functions/list-applications/index.ts`
- Create: `backend/supabase/functions/list-applications/index.test.ts`

**Interfaces:**
- Consumes: same shared modules as Task 1.
- Produces: `listApplications(supabase, staffClaims, input: ListApplicationsInput): Promise<ListApplicationsResult>` — `input: { organizationId: string; opportunityId?: string; status?: string; limit?: number; offset?: number }`, `result: { applications: ApplicationListRow[]; total: number }`, `ApplicationListRow: { id: string; volunteerId: string; volunteerName: string; opportunityId: string; opportunityName: string; status: string; appliedAt: string }`.

- [ ] **Step 1: Write the failing handler test**

```typescript
// backend/supabase/functions/list-applications/handler.test.ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listApplications } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function claims(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["applications:read"] }],
  };
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>) {
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `list-apps-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "List Apps Volunteer",
    email: `list-apps-${crypto.randomUUID()}@example.com`, phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();
  return data!.id as string;
}

Deno.test("listApplications filters by opportunity and status together", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "List Applications Test Org", slug: `list-apps-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  const { data: opp1 } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Opp 1", type: "environment",
  }).select("id").single();
  const { data: opp2 } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Opp 2", type: "environment",
  }).select("id").single();
  const volunteerId = await makeVolunteer(supabase);

  await supabase.from("applications").insert([
    { volunteer_id: volunteerId, opportunity_id: opp1!.id, organization_id: orgId, status: "submitted" },
    { volunteer_id: volunteerId, opportunity_id: opp2!.id, organization_id: orgId, status: "selected" },
  ]);

  const result = await listApplications(supabase, claims(orgId), {
    organizationId: orgId, opportunityId: opp1!.id as string,
  });

  assertEquals(result.applications.length, 1);
  assertEquals(result.applications[0].opportunityName, "Opp 1");
});

Deno.test("listApplications rejects a caller without applications:read for this org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const noPerm: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(() => listApplications(supabase, noPerm, { organizationId: orgId }), Error, "forbidden");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno test --allow-net --allow-env functions/list-applications/handler.test.ts`

- [ ] **Step 3: Write the handler**

```typescript
// backend/supabase/functions/list-applications/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface ListApplicationsInput {
  organizationId: string;
  opportunityId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ApplicationListRow {
  id: string;
  volunteerId: string;
  volunteerName: string;
  opportunityId: string;
  opportunityName: string;
  status: string;
  appliedAt: string;
}

export interface ListApplicationsResult {
  applications: ApplicationListRow[];
  total: number;
}

export async function listApplications(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListApplicationsInput,
): Promise<ListApplicationsResult> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "applications:read")) {
    throw new Error("forbidden");
  }

  const limit = Math.min(input.limit ?? 25, 100);
  const offset = input.offset ?? 0;

  let query = supabase
    .from("applications")
    .select("id, status, applied_at, volunteer_id, opportunity_id, volunteers(full_name), opportunities(name)", { count: "exact" })
    .eq("organization_id", input.organizationId);
  if (input.opportunityId) query = query.eq("opportunity_id", input.opportunityId);
  if (input.status) query = query.eq("status", input.status);

  const { data, error, count } = await query.order("applied_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;

  return {
    applications: (data ?? []).map((r) => ({
      id: r.id as string,
      volunteerId: r.volunteer_id as string,
      volunteerName: (r.volunteers as unknown as { full_name: string })?.full_name ?? "",
      opportunityId: r.opportunity_id as string,
      opportunityName: (r.opportunities as unknown as { name: string })?.name ?? "",
      status: r.status as string,
      appliedAt: r.applied_at as string,
    })),
    total: count ?? 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2. Expected: `ok | 2 passed | 0 failed`.

- [ ] **Step 5: Write the index.ts wrapper**

```typescript
// backend/supabase/functions/list-applications/index.ts
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { listApplications } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const input = await req.json();
    const result = await listApplications(getAdminClient(), claims, input);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) Deno.serve(handler);
```

- [ ] **Step 6: Write the index.ts CORS tests**

```typescript
// backend/supabase/functions/list-applications/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";

Deno.test("list-applications index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handler(new Request("https://example.com/fn", { method: "OPTIONS" }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("list-applications index carries CORS headers on an error response", async () => {
  const res = await handler(
    new Request("https://example.com/fn", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: "x" }),
    }),
  );
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
```

- [ ] **Step 7: Run the full suite and verify no regressions**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno task test`

- [ ] **Step 8: Commit**

```bash
git add backend/supabase/functions/list-applications/
git commit -m "feat: add list-applications Edge Function for the admin portal"
```

---

### Task 6: `list-activity-hours`

**Files:**
- Create: `backend/supabase/functions/list-activity-hours/handler.ts`
- Create: `backend/supabase/functions/list-activity-hours/handler.test.ts`
- Create: `backend/supabase/functions/list-activity-hours/index.ts`
- Create: `backend/supabase/functions/list-activity-hours/index.test.ts`

**Interfaces:**
- Consumes: same shared modules as Task 1.
- Produces: `listActivityHours(supabase, staffClaims, input: ListActivityHoursInput): Promise<ListActivityHoursResult>` — `input: { organizationId: string; activityType?: string; participationStatus?: string; limit?: number; offset?: number }`, `result: { activity: ActivityListRow[]; total: number }`, `ActivityListRow: { id: string; volunteerName: string; opportunityName: string; activityType: string; role: string | null; activityDate: string; hoursSubmitted: number; hoursVerified: number | null; verificationStatus: string; adminNotes: string | null }`. This is admin-only (reads `admin_notes`) — same rule as Task 2.

`activityType` lives on `opportunities.type` and `participationStatus` lives on `participation.status` — neither is a column on `activity_hours` itself, so both filters resolve their matching id sets first, then filter `activity_hours` with `.in(...)`, same pattern as every other cross-table filter in this plan.

- [ ] **Step 1: Write the failing handler test**

```typescript
// backend/supabase/functions/list-activity-hours/handler.test.ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listActivityHours } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function claims(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["hours:read"] }],
  };
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>) {
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `list-hours-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "List Hours Volunteer",
    email: `list-hours-${crypto.randomUUID()}@example.com`, phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();
  return data!.id as string;
}

Deno.test("listActivityHours filters by activity type (from opportunities) and participation status (from participation) together", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "List Hours Test Org", slug: `list-hours-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  const { data: envOpp } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Env Opp", type: "environment",
  }).select("id").single();
  const { data: healthOpp } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Health Opp", type: "health",
  }).select("id").single();
  const volunteerId = await makeVolunteer(supabase);

  const { data: participatingParticipation } = await supabase.from("participation").insert({
    volunteer_id: volunteerId, opportunity_id: envOpp!.id, organization_id: orgId, status: "participating",
  }).select("id").single();
  const { data: completedParticipation } = await supabase.from("participation").insert({
    volunteer_id: volunteerId, opportunity_id: healthOpp!.id, organization_id: orgId, status: "completed",
  }).select("id").single();

  await supabase.from("activity_hours").insert([
    {
      participation_id: participatingParticipation!.id, volunteer_id: volunteerId, opportunity_id: envOpp!.id,
      organization_id: orgId, activity_date: "2026-02-01", hours_submitted: 5, verification_status: "recorded",
    },
    {
      participation_id: completedParticipation!.id, volunteer_id: volunteerId, opportunity_id: healthOpp!.id,
      organization_id: orgId, activity_date: "2026-02-02", hours_submitted: 3, verification_status: "verified", hours_verified: 3,
    },
  ]);

  const result = await listActivityHours(supabase, claims(orgId), {
    organizationId: orgId, activityType: "environment", participationStatus: "participating",
  });

  assertEquals(result.activity.length, 1);
  assertEquals(result.activity[0].opportunityName, "Env Opp");
});

Deno.test("listActivityHours rejects a caller without hours:read for this org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const noPerm: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(() => listActivityHours(supabase, noPerm, { organizationId: orgId }), Error, "forbidden");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno test --allow-net --allow-env functions/list-activity-hours/handler.test.ts`

- [ ] **Step 3: Write the handler**

```typescript
// backend/supabase/functions/list-activity-hours/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface ListActivityHoursInput {
  organizationId: string;
  activityType?: string;
  participationStatus?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityListRow {
  id: string;
  volunteerName: string;
  opportunityName: string;
  activityType: string;
  role: string | null;
  activityDate: string;
  hoursSubmitted: number;
  hoursVerified: number | null;
  verificationStatus: string;
  adminNotes: string | null;
}

export interface ListActivityHoursResult {
  activity: ActivityListRow[];
  total: number;
}

export async function listActivityHours(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListActivityHoursInput,
): Promise<ListActivityHoursResult> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "hours:read")) {
    throw new Error("forbidden");
  }

  const limit = Math.min(input.limit ?? 25, 100);
  const offset = input.offset ?? 0;

  let opportunityIdFilter: string[] | null = null;
  if (input.activityType) {
    const { data: opportunityRows, error: opportunityError } = await supabase
      .from("opportunities")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("type", input.activityType);
    if (opportunityError) throw opportunityError;
    opportunityIdFilter = (opportunityRows ?? []).map((o) => o.id as string);
    if (opportunityIdFilter.length === 0) return { activity: [], total: 0 };
  }

  let participationIdFilter: string[] | null = null;
  if (input.participationStatus) {
    const { data: participationRows, error: participationError } = await supabase
      .from("participation")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("status", input.participationStatus);
    if (participationError) throw participationError;
    participationIdFilter = (participationRows ?? []).map((p) => p.id as string);
    if (participationIdFilter.length === 0) return { activity: [], total: 0 };
  }

  let query = supabase
    .from("activity_hours")
    .select(
      "id, role, activity_date, hours_submitted, hours_verified, verification_status, admin_notes, volunteers(full_name), opportunities(name)",
      { count: "exact" },
    )
    .eq("organization_id", input.organizationId);
  if (opportunityIdFilter) query = query.in("opportunity_id", opportunityIdFilter);
  if (participationIdFilter) query = query.in("participation_id", participationIdFilter);

  const { data, error, count } = await query.order("activity_date", { ascending: true }).range(offset, offset + limit - 1);
  if (error) throw error;

  return {
    activity: (data ?? []).map((r) => ({
      id: r.id as string,
      volunteerName: (r.volunteers as unknown as { full_name: string })?.full_name ?? "",
      opportunityName: (r.opportunities as unknown as { name: string })?.name ?? "",
      activityType: "",
      role: r.role as string | null,
      activityDate: r.activity_date as string,
      hoursSubmitted: r.hours_submitted as number,
      hoursVerified: r.hours_verified as number | null,
      verificationStatus: r.verification_status as string,
      adminNotes: r.admin_notes as string | null,
    })),
    total: count ?? 0,
  };
}
```

Note the placeholder empty string for `activityType` in the mapped row: `opportunities(name)` doesn't also carry `type` in this select. Before Step 4, add `type` to the embedded select and map it through — this is intentionally left for the implementer to catch via the test below, which asserts the real value.

- [ ] **Step 3b: Fix the row mapping to include the real activity type**

Change the select to `"..., opportunities(name, type)"` and the map's `activityType` line to
`activityType: (r.opportunities as unknown as { type: string })?.type ?? ""`. Add this assertion to the test written in Step 1, inside the first test, right after the existing `assertEquals(result.activity[0].opportunityName, "Env Opp")` line:

```typescript
  assertEquals(result.activity[0].activityType, "environment");
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2. Expected: `ok | 2 passed | 0 failed`.

- [ ] **Step 5: Write the index.ts wrapper**

```typescript
// backend/supabase/functions/list-activity-hours/index.ts
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { listActivityHours } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const input = await req.json();
    const result = await listActivityHours(getAdminClient(), claims, input);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) Deno.serve(handler);
```

- [ ] **Step 6: Write the index.ts CORS tests**

```typescript
// backend/supabase/functions/list-activity-hours/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";

Deno.test("list-activity-hours index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handler(new Request("https://example.com/fn", { method: "OPTIONS" }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("list-activity-hours index carries CORS headers on an error response", async () => {
  const res = await handler(
    new Request("https://example.com/fn", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: "x" }),
    }),
  );
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
```

- [ ] **Step 7: Run the full suite and verify no regressions**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno task test`

- [ ] **Step 8: Commit**

```bash
git add backend/supabase/functions/list-activity-hours/
git commit -m "feat: add list-activity-hours Edge Function for the admin portal"
```

---

### Task 7: `get-kpi-summary`

**Files:**
- Create: `backend/supabase/functions/get-kpi-summary/handler.ts`
- Create: `backend/supabase/functions/get-kpi-summary/handler.test.ts`
- Create: `backend/supabase/functions/get-kpi-summary/index.ts`
- Create: `backend/supabase/functions/get-kpi-summary/index.test.ts`

**Interfaces:**
- Consumes: same shared modules as Task 1.
- Produces: `getKpiSummary(supabase, staffClaims, input: { organizationId: string }): Promise<KpiSummary>` — `KpiSummary: { totalRegistered: number; active: number; completedParticipations: number; applicationsReceived: number; selected: number; totalVerifiedHours: number; byCity: Record<string, number>; byProvince: Record<string, number>; byInstitution: Record<string, number>; participationByOpportunity: Record<string, number>; participationByActivityType: Record<string, number> }`.

Groupings are computed in JS after fetching the relevant rows (no new SQL functions), per the spec's §8 decision to skip scale optimization at Phase 1 volume.

- [ ] **Step 1: Write the failing handler test**

```typescript
// backend/supabase/functions/get-kpi-summary/handler.test.ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { getKpiSummary } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function claims(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["volunteers:read"] }],
  };
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>, city: string, status = "active") {
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `kpi-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "KPI Test Volunteer",
    email: `kpi-${crypto.randomUUID()}@example.com`, phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01", gender: "female", city, province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS", status,
  }).select("id").single();
  return data!.id as string;
}

Deno.test("getKpiSummary computes every metric scoped to the given org only", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "KPI Test Org", slug: `kpi-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  const { data: otherOrg } = await supabase.from("organizations").insert({
    name: "KPI Other Org", slug: `kpi-other-${crypto.randomUUID()}`,
  }).select("id").single();
  const otherOrgId = otherOrg!.id as string;

  const lahoreVolunteer = await makeVolunteer(supabase, "Lahore");
  const karachiVolunteer = await makeVolunteer(supabase, "Karachi", "inactive");
  const otherOrgVolunteer = await makeVolunteer(supabase, "Lahore");

  await supabase.from("org_volunteer_index").insert([
    { organization_id: orgId, volunteer_id: lahoreVolunteer },
    { organization_id: orgId, volunteer_id: karachiVolunteer },
    { organization_id: otherOrgId, volunteer_id: otherOrgVolunteer },
  ]);

  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "KPI Test Opp", type: "environment",
  }).select("id").single();
  const opportunityId = opportunity!.id as string;

  await supabase.from("applications").insert([
    { volunteer_id: lahoreVolunteer, opportunity_id: opportunityId, organization_id: orgId, status: "selected" },
    { volunteer_id: karachiVolunteer, opportunity_id: opportunityId, organization_id: orgId, status: "submitted" },
  ]);

  const { data: participation } = await supabase.from("participation").insert({
    volunteer_id: lahoreVolunteer, opportunity_id: opportunityId, organization_id: orgId, status: "completed",
  }).select("id").single();

  await supabase.from("activity_hours").insert({
    participation_id: participation!.id, volunteer_id: lahoreVolunteer, opportunity_id: opportunityId,
    organization_id: orgId, activity_date: "2026-02-01", hours_submitted: 4, hours_verified: 4, verification_status: "verified",
  });

  const result = await getKpiSummary(supabase, claims(orgId), { organizationId: orgId });

  assertEquals(result.totalRegistered, 2);
  assertEquals(result.active, 1);
  assertEquals(result.completedParticipations, 1);
  assertEquals(result.applicationsReceived, 2);
  assertEquals(result.selected, 1);
  assertEquals(result.totalVerifiedHours, 4);
  assertEquals(result.byCity["Lahore"], 1);
  assertEquals(result.byCity["Karachi"], 1);
  assertEquals(result.participationByOpportunity["KPI Test Opp"], 1);
  assertEquals(result.participationByActivityType["environment"], 1);
});

Deno.test("getKpiSummary rejects a caller without volunteers:read for this org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const noPerm: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(() => getKpiSummary(supabase, noPerm, { organizationId: orgId }), Error, "forbidden");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno test --allow-net --allow-env functions/get-kpi-summary/handler.test.ts`

- [ ] **Step 3: Write the handler**

```typescript
// backend/supabase/functions/get-kpi-summary/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface GetKpiSummaryInput {
  organizationId: string;
}

export interface KpiSummary {
  totalRegistered: number;
  active: number;
  completedParticipations: number;
  applicationsReceived: number;
  selected: number;
  totalVerifiedHours: number;
  byCity: Record<string, number>;
  byProvince: Record<string, number>;
  byInstitution: Record<string, number>;
  participationByOpportunity: Record<string, number>;
  participationByActivityType: Record<string, number>;
}

function countBy<T>(items: T[], keyOf: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function getKpiSummary(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: GetKpiSummaryInput,
): Promise<KpiSummary> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "volunteers:read")) {
    throw new Error("forbidden");
  }

  const { data: indexRows, error: indexError } = await supabase
    .from("org_volunteer_index")
    .select("volunteer_id")
    .eq("organization_id", input.organizationId);
  if (indexError) throw indexError;
  const volunteerIds = (indexRows ?? []).map((r) => r.volunteer_id as string);

  const { data: volunteerRows, error: volunteerError } = volunteerIds.length === 0
    ? { data: [] as { city: string; province: string; institution: string; status: string }[], error: null }
    : await supabase.from("volunteers").select("city, province, institution, status").in("id", volunteerIds);
  if (volunteerError) throw volunteerError;

  const { data: applicationRows, error: applicationError } = await supabase
    .from("applications")
    .select("status")
    .eq("organization_id", input.organizationId);
  if (applicationError) throw applicationError;

  const { data: participationRows, error: participationError } = await supabase
    .from("participation")
    .select("status, opportunities(name, type)")
    .eq("organization_id", input.organizationId);
  if (participationError) throw participationError;

  const { data: hoursRows, error: hoursError } = await supabase
    .from("activity_hours")
    .select("hours_verified")
    .eq("organization_id", input.organizationId)
    .eq("verification_status", "verified");
  if (hoursError) throw hoursError;

  const volunteers = volunteerRows ?? [];
  const applications = applicationRows ?? [];
  const participations = participationRows ?? [];

  return {
    totalRegistered: volunteers.length,
    active: volunteers.filter((v) => v.status === "active").length,
    completedParticipations: participations.filter((p) => p.status === "completed").length,
    applicationsReceived: applications.length,
    selected: applications.filter((a) => a.status === "selected").length,
    totalVerifiedHours: (hoursRows ?? []).reduce((sum, r) => sum + (r.hours_verified as number ?? 0), 0),
    byCity: countBy(volunteers, (v) => v.city),
    byProvince: countBy(volunteers, (v) => v.province),
    byInstitution: countBy(volunteers, (v) => v.institution),
    participationByOpportunity: countBy(
      participations,
      (p) => (p.opportunities as unknown as { name: string })?.name ?? "unknown",
    ),
    participationByActivityType: countBy(
      participations,
      (p) => (p.opportunities as unknown as { type: string })?.type ?? "unknown",
    ),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2. Expected: `ok | 2 passed | 0 failed`.

- [ ] **Step 5: Write the index.ts wrapper**

```typescript
// backend/supabase/functions/get-kpi-summary/index.ts
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getKpiSummary } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const input = await req.json();
    const result = await getKpiSummary(getAdminClient(), claims, input);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) Deno.serve(handler);
```

- [ ] **Step 6: Write the index.ts CORS tests**

```typescript
// backend/supabase/functions/get-kpi-summary/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";

Deno.test("get-kpi-summary index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handler(new Request("https://example.com/fn", { method: "OPTIONS" }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("get-kpi-summary index carries CORS headers on an error response", async () => {
  const res = await handler(
    new Request("https://example.com/fn", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: "x" }),
    }),
  );
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
```

- [ ] **Step 7: Run the full suite and verify no regressions**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno task test`

- [ ] **Step 8: Commit**

```bash
git add backend/supabase/functions/get-kpi-summary/
git commit -m "feat: add get-kpi-summary Edge Function for the admin portal"
```

---

### Task 8: Extend `export-csv` with opportunities and activity hours

**Files:**
- Modify: `backend/supabase/functions/export-csv/handler.ts`
- Modify: `backend/supabase/functions/export-csv/handler.test.ts`
- Modify: `backend/supabase/functions/export-csv/index.ts`

**Interfaces:**
- Consumes: the existing `csvEscape` helper already in this file (do not duplicate it).
- Produces: `exportOpportunitiesCsv(supabase, staffClaims, organizationId): Promise<string>`, `exportActivityHoursCsv(supabase, staffClaims, organizationId): Promise<string>`, gated on `opportunities:read` and `hours:read` respectively (matching the permission each resource's own list endpoint already requires — no separate `export:read` gate, per spec §4).

- [ ] **Step 1: Write the failing tests**

Add to the end of `backend/supabase/functions/export-csv/handler.test.ts` (the file already has `testClient()`, `claimsWithPermission`-equivalent helpers, or similar local fixtures from its existing tests for `exportVolunteersCsv`/`exportApplicationsCsv` — reuse whatever pattern is already there; the assertions below are what matters):

```typescript
Deno.test("exportOpportunitiesCsv includes name, type, and computed capacity for the org's opportunities", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Export Opportunities Test Org", slug: `export-opps-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Export Test Opp", type: "environment", capacity: 20,
  });
  const claims: StaffClaims = {
    actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["opportunities:read"] }],
  };

  const csv = await exportOpportunitiesCsv(supabase, claims, orgId);

  assertStringIncludes(csv, "name,type,capacity");
  assertStringIncludes(csv, "Export Test Opp");
  assertStringIncludes(csv, "environment");
});

Deno.test("exportOpportunitiesCsv rejects a caller without opportunities:read", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const claims: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(() => exportOpportunitiesCsv(supabase, claims, orgId), Error, "forbidden");
});

Deno.test("exportActivityHoursCsv includes volunteer, opportunity, hours, and status for the org's activity", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Export Hours Test Org", slug: `export-hours-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `export-hours-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "Export Hours Volunteer",
    email: `export-hours-${crypto.randomUUID()}@example.com`, phone: "0300-2222222",
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Export Hours Opp", type: "environment",
  }).select("id").single();
  await supabase.from("activity_hours").insert({
    volunteer_id: volunteer!.id, opportunity_id: opportunity!.id, organization_id: orgId,
    activity_date: "2026-02-01", hours_submitted: 5, hours_verified: 5, verification_status: "verified",
  });
  const claims: StaffClaims = {
    actorType: "staff", staffId: "staff-1", platformOwner: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["hours:read"] }],
  };

  const csv = await exportActivityHoursCsv(supabase, claims, orgId);

  assertStringIncludes(csv, "Export Hours Volunteer");
  assertStringIncludes(csv, "Export Hours Opp");
  assertStringIncludes(csv, "verified");
});
```

Add `assertStringIncludes` to the existing `assert/mod.ts` import line at the top of the file if it isn't already imported, and add `exportOpportunitiesCsv, exportActivityHoursCsv` to the existing `import { ... } from "./handler.ts"` line.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno test --allow-net --allow-env functions/export-csv/handler.test.ts`
Expected: FAIL — `exportOpportunitiesCsv`/`exportActivityHoursCsv` not exported.

- [ ] **Step 3: Add the two functions to the handler**

Append to `backend/supabase/functions/export-csv/handler.ts` (after the existing `exportVolunteersCsv`, reusing the file's existing `csvEscape`):

```typescript
export async function exportOpportunitiesCsv(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  organizationId: string,
): Promise<string> {
  if (!staffHasPermission(staffClaims, organizationId, "vms", "opportunities:read")) {
    throw new Error("forbidden");
  }

  const { data: rows, error } = await supabase
    .from("opportunities")
    .select("name, type, capacity")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const header = "name,type,capacity";
  const lines = (rows ?? []).map((r: Record<string, unknown>) =>
    [csvEscape(String(r.name)), csvEscape(String(r.type)), csvEscape(String(r.capacity ?? ""))].join(",")
  );

  return [header, ...lines].join("\n") + "\n";
}

export async function exportActivityHoursCsv(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  organizationId: string,
): Promise<string> {
  if (!staffHasPermission(staffClaims, organizationId, "vms", "hours:read")) {
    throw new Error("forbidden");
  }

  const { data: rows, error } = await supabase
    .from("activity_hours")
    .select("activity_date, hours_submitted, hours_verified, verification_status, volunteers(full_name), opportunities(name)")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const header = "volunteer_name,opportunity_name,activity_date,hours_submitted,hours_verified,verification_status";
  const lines = (rows ?? []).map((r: Record<string, unknown>) => {
    const volunteer = r.volunteers as { full_name: string };
    const opportunity = r.opportunities as { name: string };
    return [
      csvEscape(volunteer.full_name),
      csvEscape(opportunity.name),
      csvEscape(String(r.activity_date)),
      csvEscape(String(r.hours_submitted)),
      csvEscape(String(r.hours_verified ?? "")),
      csvEscape(String(r.verification_status)),
    ].join(",");
  });

  return [header, ...lines].join("\n") + "\n";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2. Expected: all tests in this file pass, including the 3 new ones.

- [ ] **Step 5: Wire both into the index.ts dispatcher**

`backend/supabase/functions/export-csv/index.ts` currently dispatches on an `entity` field with a two-way ternary:

```typescript
const { organizationId, entity } = await req.json();

const csv = entity === "volunteers"
  ? await exportVolunteersCsv(supabase, claims, organizationId)
  : await exportApplicationsCsv(supabase, claims, organizationId);
```

Replace that ternary with a 4-way dispatch (add the new import too):

```typescript
import { exportApplicationsCsv, exportVolunteersCsv, exportOpportunitiesCsv, exportActivityHoursCsv } from "./handler.ts";
```

```typescript
const { organizationId, entity } = await req.json();

let csv: string;
if (entity === "volunteers") {
  csv = await exportVolunteersCsv(supabase, claims, organizationId);
} else if (entity === "opportunities") {
  csv = await exportOpportunitiesCsv(supabase, claims, organizationId);
} else if (entity === "activity_hours") {
  csv = await exportActivityHoursCsv(supabase, claims, organizationId);
} else {
  csv = await exportApplicationsCsv(supabase, claims, organizationId);
}
```

This keeps the existing default-to-applications behavior for the two entity values already in use (`"volunteers"` and anything else, which today only ever means `"applications"`) bit-for-bit unchanged, and both index-level CORS tests (`index.test.ts`, if this function has one — check; if not, this step doesn't need to add one, since export-csv predates that convention and its existing tests already cover the handler layer directly) continue to pass unmodified.

- [ ] **Step 6: Run the full suite and verify no regressions**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno task test`

- [ ] **Step 7: Commit**

```bash
git add backend/supabase/functions/export-csv/
git commit -m "feat: extend export-csv with opportunities and activity_hours resources"
```

---

## Self-Review Notes (for the plan author, not a task to execute)

- **Spec coverage**: §3's 7 functions → Tasks 1–7. §4 (export-csv extension) → Task 8. §5 (admin-notes boundary) → enforced by construction in Tasks 2 and 6 (only those two select `admin_notes`), documented inline in both. §6 (module registration + 5 screens) is the companion frontend plan's responsibility, not this one. §7 (testing) → every task's Steps 1–2 and 7. §8 (deferred items) → nothing in this plan attempts them.
- **Type consistency checked**: `StaffClaims`/`staffHasPermission` used identically across all 8 tasks; every `ListXResult`/`XSummary` naming follows the same `{ resourcePlural: Row[]; total: number }` shape; `organizationId` is always the first input field, `limit`/`offset` always the last two on list inputs.
- **No task in this plan touches `platform`/`tmp-partner-admin`** — that's the companion frontend plan, written next.
