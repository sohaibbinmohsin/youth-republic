# VMS Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `backend/` — the Supabase project (schema, RLS, Edge Functions) that owns all VMS data — as a fully working, independently testable service, with no dependency on `frontend/` or `platform`.

**Architecture:** Postgres schema with the global volunteer pool and org-scoped join tables, enforced by RLS using JWT claims shared with the `platform` project. All state-changing operations go through Edge Functions (never direct table writes from clients), each backed by a pure, dependency-injected handler function so it can be unit-tested against a local Supabase instance without HTTP.

**Tech Stack:** Supabase (Postgres 15, Auth, Edge Functions), Supabase CLI for local dev and migrations, Deno + TypeScript for Edge Functions, pgTAP for database/RLS tests, Deno's built-in test runner for Edge Function tests.

**Spec:** [docs/superpowers/specs/2026-08-26-vms-design.md](../specs/2026-08-26-vms-design.md)

## Global Constraints

- `volunteers` has no `organization_id` column — org visibility is always via `org_volunteer_index`, never a flat column match (spec §2, §4).
- Every state-changing operation goes through an Edge Function; no table is ever written to directly by a frontend client (spec §2). This covers opportunities and chapters too — `create-opportunity`/`update-opportunity` (Task 26) and `create-chapter`/`update-chapter` (Task 27) exist specifically so `platform`'s admin hub never has to write those tables via a raw PostgREST call. Task 11's RLS write policies (`staff_has_permission()`-gated, not just org-membership) are the backstop for this constraint, not a substitute for it — a client that skipped the Edge Function and wrote via PostgREST directly would still be permission-checked, but wouldn't produce an `admin_action_log` entry, which is why the Edge Function path is the one actually documented and expected.
- `actor_type` is an open string, not a fixed enum (spec §2).
- Minors (computed from `dob`, under 18) cannot complete registration without `guardian_name`, `guardian_contact`, and `guardian_consent_at` all set (spec §2, §3).
- CNIC documents are stored via signed URLs only; the storage bucket is never public (spec §3, §4).
- `profile_field_changes` logs only these fields: `dob`, `cnic_number`, `phone`, `emergency_contact`, `guardian_name`, `guardian_contact` (spec §3).
- No hard deletes outside append-only logs; use `deactivated_at` (spec §3).
- Rejected `activity_hours` rows are retained with a reason, never deleted (spec §4).
- **Never change the request/response shape of an Edge Function or the columns exposed via PostgREST that `platform` (the `tmp-partner-admin` repo's admin hub) depends on.** `platform` is a separately deployed consumer with its own hand-written client (`lib/modules/vms/client.ts`), verified against this repo via an automated contract/integration test in `platform`'s CI (mechanism detailed in the `platform`/`tmp-partner-admin` spec; may start as a local-stack integration suite and later move to consumer-driven contract testing — the rule holds either way). A breaking change must ship as a new, additively-versioned endpoint (e.g. `decide-application-v2`) alongside the old one — the old one is only removed after `platform` has migrated off it and its contract test targets the new shape. This applies to any task below that touches an existing Edge Function's request/response shape or an existing table's RLS-visible columns.
- **This plan runs against a hosted Supabase Cloud project, not local Docker.** The plan was originally written assuming `npx supabase start` (a local Postgres/Auth/Edge-Functions stack via Docker) for every task's test cycle. Neither the local dev machine nor the intended cloud execution environment for this plan has Docker available, so every task below has been rewritten to work against a real hosted project instead — this is a substitution, not a design change; nothing about the schema, RLS policies, or Edge Function logic differs. Concretely: `npx supabase db reset && npx supabase test db` becomes `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done` (push whatever new migration the task just added, then run every pgTAP test file directly against the hosted database over `psql`); a standalone `npx supabase test db` (used to confirm a test fails *before* its migration exists) becomes just the `psql` loop, with no push; `deno test`/`deno task test` commands are unchanged — they already just read `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` from the environment, local or hosted makes no difference to them. Running pgTAP files directly via `psql` is safe to repeat against a shared project because every test file wraps its assertions in `begin; ...; rollback;` — nothing persists past the file. `backend/.env` (git-ignored, from `backend/.env.example`) must be sourced (`set -a; source backend/.env; set +a`) before any of these commands in a given shell.

---

## File Structure

```
backend/
  supabase/
    config.toml
    migrations/
      0001_volunteers.sql
      0002_org_volunteer_index.sql
      0003_opportunities.sql
      0004_applications.sql
      0005_participation.sql
      0006_activity_hours.sql
      0007_chapters.sql
      0008_admin_action_log_and_profile_field_changes.sql
      0009_rls_volunteers.sql
      0010_rls_org_scoped.sql
    tests/database/
      000_setup.sql
      volunteers_test.sql
      org_volunteer_index_test.sql
      opportunities_test.sql
      applications_test.sql
      participation_test.sql
      activity_hours_test.sql
      chapters_test.sql
      admin_action_log_and_profile_field_changes_test.sql
      rls_volunteers_test.sql
      rls_org_scoped_test.sql
    functions/
      _shared/
        supabaseAdmin.ts
        verifyStaffToken.ts
        verifyStaffToken.test.ts
        rateLimit.ts
        rateLimit.test.ts
        sendEmail.ts
        sendEmail.test.ts
        verifyVolunteerAuth.ts
        verifyVolunteerAuth.test.ts
      register-volunteer/
        handler.ts
        handler.test.ts
        index.ts
      apply-to-opportunity/
        handler.ts
        handler.test.ts
        index.ts
      decide-application/
        handler.ts
        handler.test.ts
        index.ts
      submit-hours/
        handler.ts
        handler.test.ts
        index.ts
      verify-hours/
        handler.ts
        handler.test.ts
        index.ts
      bulk-assign-hours/
        handler.ts
        handler.test.ts
        index.ts
      upload-cnic-document/
        handler.ts
        handler.test.ts
        index.ts
      update-sensitive-field/
        handler.ts
        handler.test.ts
        index.ts
      export-csv/
        handler.ts
        handler.test.ts
        index.ts
      sync-organization/
        handler.ts
        handler.test.ts
        index.ts
      update-participation-status/
        handler.ts
        handler.test.ts
        index.ts
      create-opportunity/
        handler.ts
        handler.test.ts
        index.ts
      update-opportunity/
        handler.ts
        handler.test.ts
        index.ts
      create-chapter/
        handler.ts
        handler.test.ts
        index.ts
      update-chapter/
        handler.ts
        handler.test.ts
        index.ts
      enroll-participant/
        handler.ts
        handler.test.ts
        index.ts
    deno.jsonc
```

Each Edge Function directory splits `handler.ts` (pure logic, takes a Supabase client as a parameter, unit-tested directly) from `index.ts` (the `Deno.serve` HTTP wrapper: parses the request, calls the handler, shapes the response). This is what makes each function testable without spinning up HTTP — the pattern every function task below follows.

---

### Task 1: Backend project bootstrap

**Files:**
- Create: `backend/supabase/config.toml` (via `supabase init`)
- Create: `backend/supabase/deno.jsonc`
- Create: `backend/supabase/functions/_shared/supabaseAdmin.ts`
- Create: `backend/README.md`
- Consumes (already committed, not created by this task): `backend/.env.example` — copy it to `backend/.env` and fill in real values before starting Task 1; every command in this plan reads from that file.

**Interfaces:**
- Produces: `getAdminClient(): SupabaseClient` — every Edge Function handler test and `index.ts` wrapper uses this to get a service-role client against the project's own database.

**Environment note:** this plan runs against a real hosted Supabase Cloud project, not a local Docker-based stack — `npx supabase start`/`db reset`/`test db` all assume a local Postgres container, and there is no Docker in either the local dev machine or the cloud execution environment this plan is meant to run in. Every `Run:` command from here on either pushes migrations to the linked hosted project (`supabase db push --linked`) or runs pgTAP test files directly against it via `psql "$SUPABASE_DB_URL"` — safe to run repeatedly against a shared project because every test file wraps its assertions in `begin; ...; rollback;` (this was already true of every test in this plan; nothing about the tests themselves changes, only how they're invoked). See the Global Constraints section for the full rationale.

- [x] **Step 1: Install the Supabase CLI and initialize the project**

```bash
mkdir -p backend
cd backend
npx supabase init
```

This creates `supabase/config.toml` and an empty `supabase/migrations/` directory. `supabase init` is local scaffolding only — it doesn't need Docker, and stays the same step whether the eventual target is a local or hosted project.

- [x] **Step 2: Link to the hosted Supabase Cloud project and confirm connectivity**

Copy `backend/.env.example` to `backend/.env` (if not already done) and fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`, and `SUPABASE_ACCESS_TOKEN` from the project's dashboard (Settings > API for the first three, Settings > Database > Connection string > URI for `SUPABASE_DB_URL`, Settings > General for the project ref, and https://supabase.com/dashboard/account/tokens for a personal access token). Then, from `backend/`:

```bash
set -a; source .env; set +a
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
psql "$SUPABASE_DB_URL" -c "select 1;"
```

Expected: `link` completes without error, and the `psql` sanity check returns a single row containing `1` — confirming the project is reachable before any migration work starts. Every later task's `Run:` commands assume `.env` has already been sourced this way in the current shell (or that you re-run `set -a; source backend/.env; set +a` in any new shell).

- [x] **Step 3: Add the Deno config for Edge Functions**

Create `backend/supabase/deno.jsonc`:

```jsonc
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2"
  },
  "tasks": {
    "test": "deno test --allow-net --allow-env functions/"
  }
}
```

- [x] **Step 4: Write the shared admin client module**

Create `backend/supabase/functions/_shared/supabaseAdmin.ts`:

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function getAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [x] **Step 5: Document dev setup in the backend README**

Create `backend/README.md`:

```markdown
# vms backend

Runs against a real hosted Supabase Cloud project — no local Docker stack.

Setup (once):

    cp .env.example .env       # then fill in real values, see .env.example for where each comes from
    set -a; source .env; set +a
    npx supabase link --project-ref "$SUPABASE_PROJECT_REF"

Every dev session:

    set -a; source .env; set +a
    npx supabase db push --linked                                                          # applies any new migrations
    for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done   # runs pgTAP database/RLS tests
    deno task test                                                                          # runs Edge Function unit tests (from supabase/)

Required environment variables (see `.env.example`, values are set
per-environment, never committed): `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`,
`SUPABASE_ACCESS_TOKEN`, `STAFF_JWT_SECRET`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET_URL`, `RESEND_API_KEY`,
`EMAIL_FROM_ADDRESS`.
```

- [x] **Step 6: Commit**

```bash
git add backend/supabase/config.toml backend/supabase/deno.jsonc backend/supabase/functions/_shared/supabaseAdmin.ts backend/README.md
git commit -m "chore: bootstrap vms backend Supabase project"
```

---

### Task 2: `volunteers` table

**Files:**
- Create: `backend/supabase/migrations/0001_volunteers.sql`
- Test: `backend/supabase/tests/database/000_setup.sql`
- Test: `backend/supabase/tests/database/volunteers_test.sql`

**Interfaces:**
- Produces: table `volunteers` with columns per spec §3; function `generate_volunteer_code() returns text`; function `volunteer_is_minor(v_dob date) returns boolean`. Later tasks (Task 3 onward) reference `volunteers(id)`.

- [x] **Step 1: Write the pgTAP test setup file**

Create `backend/supabase/tests/database/000_setup.sql`:

```sql
create extension if not exists pgtap with schema extensions;
```

- [x] **Step 2: Write the failing test**

Create `backend/supabase/tests/database/volunteers_test.sql`:

```sql
begin;
select plan(9);

select has_table('public', 'volunteers', 'volunteers table exists');
select has_column('public', 'volunteers', 'email', 'has email column');
select col_is_unique('public', 'volunteers', 'email', 'email is unique');
select col_is_unique('public', 'volunteers', 'phone', 'phone is unique');
select col_is_unique('public', 'volunteers', 'cnic_number', 'cnic_number is unique');
select has_column('public', 'volunteers', 'organization_id', 'volunteers has no organization_id')
  is (false), 'volunteers must not carry organization_id';

select is(volunteer_is_minor('2015-01-01'::date), true, 'a 2015-born registrant is a minor');
select is(volunteer_is_minor('1990-01-01'::date), false, 'a 1990-born registrant is not a minor');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Guardian Test', 'guardian-test@example.com', '0300-0000000', '2015-01-01', 'female', 'Lahore', 'Punjab', 'Pakistan', 'Test School', 'O-Level');

select throws_ok(
  $$ update volunteers set guardian_name = 'Only Name' where email = 'guardian-test@example.com' $$,
  '23514',
  null,
  'guardian_name alone without guardian_contact violates the paired-fields constraint'
);

select * from finish();
rollback;
```

Note: the "has no organization_id" assertion above is written awkwardly on purpose to be explicit in test output; if `has_column` doesn't support this negation form in your pgTAP version, replace that block with:

```sql
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'volunteers' and column_name = 'organization_id'
  ),
  'volunteers must not carry organization_id'
);
```

- [x] **Step 3: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — `volunteers` table does not exist.

- [x] **Step 4: Write the migration**

Create `backend/supabase/migrations/0001_volunteers.sql`:

```sql
create sequence volunteer_code_seq;

create or replace function generate_volunteer_code() returns text as $$
  select 'VOL-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('volunteer_code_seq')::text, 6, '0');
$$ language sql;

create or replace function volunteer_is_minor(v_dob date) returns boolean as $$
  select v_dob > (current_date - interval '18 years');
$$ language sql stable;

create table volunteers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  volunteer_code text not null unique default generate_volunteer_code(),
  full_name text not null,
  email text not null unique,
  phone text not null unique,
  dob date not null,
  gender text not null,
  city text not null,
  province text not null,
  country text not null,
  institution text not null,
  degree_program text not null,
  cnic_number text unique,
  cnic_document_url text,
  graduation_year int,
  skills text[],
  interests text[],
  availability text,
  emergency_contact jsonb,
  profile_picture_url text,
  guardian_name text,
  guardian_contact text,
  guardian_consent_at timestamptz,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'active', 'inactive')),
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  constraint guardian_fields_together check (
    (guardian_name is null and guardian_contact is null) or
    (guardian_name is not null and guardian_contact is not null)
  )
);

create index volunteers_city_idx on volunteers (city);
create index volunteers_institution_idx on volunteers (institution);
create index volunteers_status_idx on volunteers (status);
```

- [x] **Step 5: Apply the migration and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS on all 9 assertions.

- [x] **Step 6: Commit**

```bash
git add backend/supabase/migrations/0001_volunteers.sql backend/supabase/tests/database/000_setup.sql backend/supabase/tests/database/volunteers_test.sql
git commit -m "feat(backend): add volunteers table with minor/guardian constraint"
```

---

### Task 3: `org_volunteer_index` table

**Files:**
- Create: `backend/supabase/migrations/0002_org_volunteer_index.sql`
- Test: `backend/supabase/tests/database/org_volunteer_index_test.sql`

**Interfaces:**
- Consumes: `volunteers(id)` from Task 2.
- Produces: table `org_volunteer_index`; function `touch_org_volunteer_index(p_org_id uuid, p_volunteer_id uuid) returns void`. Used by Task 9/10 (`decide-application`, `submit-hours` handlers) to record org contact.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/org_volunteer_index_test.sql`:

```sql
begin;
select plan(4);

select has_table('public', 'org_volunteer_index', 'org_volunteer_index exists');
select col_is_pk('public', 'org_volunteer_index', array['organization_id', 'volunteer_id'], 'composite pk');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Index Test', 'index-test@example.com', '0300-1111111', '1999-01-01', 'male', 'Karachi', 'Sindh', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

select touch_org_volunteer_index('11111111-1111-1111-1111-111111111111', :'vol_id');
select is((select count(*) from org_volunteer_index where volunteer_id = :'vol_id'), 1::bigint, 'first touch inserts one row');

select touch_org_volunteer_index('11111111-1111-1111-1111-111111111111', :'vol_id');
select is((select count(*) from org_volunteer_index where volunteer_id = :'vol_id'), 1::bigint, 'second touch updates, does not duplicate');

select * from finish();
rollback;
```

- [x] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — table does not exist.

- [x] **Step 3: Write the migration**

Create `backend/supabase/migrations/0002_org_volunteer_index.sql`:

```sql
create table org_volunteer_index (
  organization_id uuid not null,
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  first_activity_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  primary key (organization_id, volunteer_id)
);

create index org_volunteer_index_volunteer_idx on org_volunteer_index (volunteer_id);

create or replace function touch_org_volunteer_index(p_org_id uuid, p_volunteer_id uuid) returns void as $$
  insert into org_volunteer_index (organization_id, volunteer_id)
  values (p_org_id, p_volunteer_id)
  on conflict (organization_id, volunteer_id)
  do update set last_activity_at = now();
$$ language sql;
```

- [x] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0002_org_volunteer_index.sql backend/supabase/tests/database/org_volunteer_index_test.sql
git commit -m "feat(backend): add org_volunteer_index junction table"
```

---

### Task 4: `opportunities` table

**Files:**
- Create: `backend/supabase/migrations/0003_opportunities.sql`
- Test: `backend/supabase/tests/database/opportunities_test.sql`

**Interfaces:**
- Produces: table `opportunities`; function `opportunity_status(o opportunities) returns text`. Used by Task 5 (`applications` FK) and the `decide-application`/`apply-to-opportunity` handlers.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/opportunities_test.sql`:

```sql
begin;
select plan(6);

select has_table('public', 'opportunities', 'opportunities exists');
select has_column('public', 'opportunities', 'organization_id', 'org-scoped');

insert into opportunities (organization_id, name, type, application_open_at, activity_start_at, activity_end_at)
values ('11111111-1111-1111-1111-111111111111', 'Beach Cleanup', 'event', now() - interval '1 day', now() + interval '5 days', now() + interval '6 days')
returning id as opp_id \gset

select is((select opportunity_status(o) from opportunities o where id = :'opp_id'), 'open', 'open before activity start');

update opportunities set activity_start_at = now() - interval '1 hour' where id = :'opp_id';
select is((select opportunity_status(o) from opportunities o where id = :'opp_id'), 'in_progress', 'in_progress during activity window');

update opportunities set activity_end_at = now() - interval '1 hour' where id = :'opp_id';
select is((select opportunity_status(o) from opportunities o where id = :'opp_id'), 'completed', 'completed after activity end');

update opportunities set status_override = 'closed' where id = :'opp_id';
select is((select opportunity_status(o) from opportunities o where id = :'opp_id'), 'closed', 'manual override wins');

select * from finish();
rollback;
```

- [x] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — table does not exist.

- [x] **Step 3: Write the migration**

Create `backend/supabase/migrations/0003_opportunities.sql`:

```sql
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  type text not null,
  description text,
  location text,
  is_online boolean not null default false,
  application_open_at timestamptz,
  application_deadline timestamptz,
  activity_start_at timestamptz,
  activity_end_at timestamptz,
  eligibility_criteria text,
  capacity int,
  status_override text check (status_override in ('coming_soon', 'open', 'closed', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create index opportunities_org_idx on opportunities (organization_id);
create index opportunities_status_override_idx on opportunities (status_override);

create or replace function opportunity_status(o opportunities) returns text as $$
  select coalesce(
    o.status_override,
    case
      when o.deactivated_at is not null then 'closed'
      when o.application_open_at is not null and now() < o.application_open_at then 'coming_soon'
      when o.activity_start_at is not null and now() >= o.activity_start_at
           and (o.activity_end_at is null or now() <= o.activity_end_at) then 'in_progress'
      when o.activity_end_at is not null and now() > o.activity_end_at then 'completed'
      when o.application_deadline is not null and now() > o.application_deadline then 'closed'
      else 'open'
    end
  );
$$ language sql stable;
```

- [x] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0003_opportunities.sql backend/supabase/tests/database/opportunities_test.sql
git commit -m "feat(backend): add opportunities table with computed status"
```

---

### Task 5: `applications` table

**Files:**
- Create: `backend/supabase/migrations/0004_applications.sql`
- Test: `backend/supabase/tests/database/applications_test.sql`

**Interfaces:**
- Consumes: `volunteers(id)` (Task 2), `opportunities(id)` (Task 4).
- Produces: table `applications` with statuses `submitted | under_review | selected | waitlisted | rejected | withdrawn`. `waitlisted` supports manual admin promotion to `selected` when a spot opens (requirements doc §5D) — promotion is just another `decideApplication()` call, no separate mechanism needed. Consumed by Task 6 (`participation`) and `apply-to-opportunity`/`decide-application` handlers.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/applications_test.sql`:

```sql
begin;
select plan(5);

select has_table('public', 'applications', 'applications exists');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'App Test', 'app-test@example.com', '0300-2222222', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

insert into opportunities (organization_id, name, type)
values ('11111111-1111-1111-1111-111111111111', 'Tutoring', 'ongoing')
returning id as opp_id \gset

insert into applications (volunteer_id, opportunity_id, organization_id)
values (:'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111');

select is((select status from applications where volunteer_id = :'vol_id'), 'submitted', 'defaults to submitted');

select throws_ok(
  format($$ insert into applications (volunteer_id, opportunity_id, organization_id) values ('%s', '%s', '11111111-1111-1111-1111-111111111111') $$, :'vol_id', :'opp_id'),
  '23505',
  null,
  'duplicate application for the same volunteer+opportunity is rejected'
);

select throws_ok(
  format($$ update applications set status = 'bogus' where volunteer_id = '%s' $$, :'vol_id'),
  '23514',
  null,
  'invalid status is rejected'
);

update applications set status = 'waitlisted' where volunteer_id = :'vol_id';
select is((select status from applications where volunteer_id = :'vol_id'), 'waitlisted', 'waitlisted is a valid status for manual admin promotion later');

select * from finish();
rollback;
```

- [x] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — table does not exist.

- [x] **Step 3: Write the migration**

Create `backend/supabase/migrations/0004_applications.sql`:

```sql
create table applications (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  organization_id uuid not null,
  motivation_statement text,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'selected', 'waitlisted', 'rejected', 'withdrawn')),
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  unique (volunteer_id, opportunity_id)
);

create index applications_org_idx on applications (organization_id);
create index applications_status_idx on applications (status);
create index applications_volunteer_idx on applications (volunteer_id);
```

- [x] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0004_applications.sql backend/supabase/tests/database/applications_test.sql
git commit -m "feat(backend): add applications table"
```

---

### Task 6: `participation` table

**Files:**
- Create: `backend/supabase/migrations/0005_participation.sql`
- Test: `backend/supabase/tests/database/participation_test.sql`

**Interfaces:**
- Consumes: `applications(id)` (Task 5, nullable FK), `volunteers(id)`, `opportunities(id)`.
- Produces: table `participation`, statuses `selected | participating | completed | no_show | withdrawn` — matching the requirements doc's own two-phase participation lifecycle (`Selected → Participating → Completed/No-show/Withdrawn`, §5D). Rows default to `selected` whether auto-created by `decideApplication()` or created directly by an admin without a prior application; the `selected → participating → {completed|no_show|withdrawn}` transitions are admin-driven via `update-participation-status` (Task 25). A partial unique index on `application_id` (non-null only) enforces at most one participation row per application — a DB-level backstop for `decideApplication()`'s own idempotency check (Task 16), so re-selecting an already-selected application can never silently double the volunteer's participation/hours history even if the application-code check is ever bypassed or raced. Consumed by Task 7 (`activity_hours`) and `decide-application`/`submit-hours` handlers.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/participation_test.sql`:

```sql
begin;
select plan(4);

select has_table('public', 'participation', 'participation exists');
select has_column('public', 'participation', 'application_id', 'application_id present');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Part Test', 'part-test@example.com', '0300-3333333', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

insert into opportunities (organization_id, name, type)
values ('11111111-1111-1111-1111-111111111111', 'Tutoring', 'ongoing')
returning id as opp_id \gset

insert into participation (volunteer_id, opportunity_id, organization_id)
values (:'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111');

select is((select status from participation where volunteer_id = :'vol_id'), 'selected', 'defaults to selected, admin-enrolled without an application');

insert into applications (volunteer_id, opportunity_id, organization_id)
values (:'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111')
returning id as app_id \gset

insert into participation (application_id, volunteer_id, opportunity_id, organization_id)
values (:'app_id', :'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111');

select throws_ok(
  format($$ insert into participation (application_id, volunteer_id, opportunity_id, organization_id) values ('%s', '%s', '%s', '11111111-1111-1111-1111-111111111111') $$, :'app_id', :'vol_id', :'opp_id'),
  '23505',
  null,
  'a second participation row for the same application_id is rejected — regression test for decideApplication double-selection creating duplicates'
);

select * from finish();
rollback;
```

- [x] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — table does not exist.

- [x] **Step 3: Write the migration**

Create `backend/supabase/migrations/0005_participation.sql`:

```sql
create table participation (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete set null,
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  organization_id uuid not null,
  status text not null default 'selected'
    check (status in ('selected', 'participating', 'completed', 'no_show', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index participation_org_idx on participation (organization_id);
create index participation_volunteer_idx on participation (volunteer_id);

-- An application can auto-create at most one participation row (decide-application,
-- Task 16). admin-direct enrollment (Task 28) always has a null application_id, so
-- this is a partial index — it must not constrain that path.
create unique index participation_application_id_key on participation (application_id)
  where application_id is not null;
```

- [x] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0005_participation.sql backend/supabase/tests/database/participation_test.sql
git commit -m "feat(backend): add participation table"
```

---

### Task 7: `activity_hours` table

**Files:**
- Create: `backend/supabase/migrations/0006_activity_hours.sql`
- Test: `backend/supabase/tests/database/activity_hours_test.sql`

**Interfaces:**
- Consumes: `participation(id)` (Task 6).
- Produces: table `activity_hours`; function `volunteer_total_verified_hours(p_volunteer_id uuid) returns numeric`. Consumed by `submit-hours`/`verify-hours` handlers and the frontend portfolio view.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/activity_hours_test.sql`:

```sql
begin;
select plan(5);

select has_table('public', 'activity_hours', 'activity_hours exists');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Hours Test', 'hours-test@example.com', '0300-4444444', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

insert into opportunities (organization_id, name, type)
values ('11111111-1111-1111-1111-111111111111', 'Tutoring', 'ongoing')
returning id as opp_id \gset

insert into participation (volunteer_id, opportunity_id, organization_id)
values (:'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111')
returning id as part_id \gset

insert into activity_hours (participation_id, volunteer_id, opportunity_id, organization_id, activity_date, hours_submitted, hours_verified, verification_status)
values (:'part_id', :'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111', current_date, 4, 4, 'verified');

insert into activity_hours (participation_id, volunteer_id, opportunity_id, organization_id, activity_date, hours_submitted, verification_status, rejection_reason)
values (:'part_id', :'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111', current_date, 2, 'rejected', 'No sign-in sheet provided');

select is(volunteer_total_verified_hours(:'vol_id'), 4::numeric, 'only verified hours count toward total');
select is((select count(*) from activity_hours where verification_status = 'rejected'), 1::bigint, 'rejected rows are retained, not deleted');

select throws_ok(
  format($$ insert into activity_hours (participation_id, volunteer_id, opportunity_id, organization_id, activity_date, hours_submitted) values ('%s', '%s', '%s', '11111111-1111-1111-1111-111111111111', current_date, -1) $$, :'part_id', :'vol_id', :'opp_id'),
  '23514',
  null,
  'non-positive hours_submitted is rejected'
);

select * from finish();
rollback;
```

- [x] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — table does not exist.

- [x] **Step 3: Write the migration**

Create `backend/supabase/migrations/0006_activity_hours.sql`:

```sql
create table activity_hours (
  id uuid primary key default gen_random_uuid(),
  participation_id uuid not null references participation(id) on delete cascade,
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  organization_id uuid not null,
  role text,
  activity_date date not null,
  location text,
  hours_submitted numeric(5,2) not null check (hours_submitted > 0),
  hours_verified numeric(5,2),
  verification_status text not null default 'recorded'
    check (verification_status in ('recorded', 'pending', 'verified', 'rejected')),
  rejection_reason text,
  admin_notes text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index activity_hours_org_idx on activity_hours (organization_id);
create index activity_hours_volunteer_idx on activity_hours (volunteer_id);
create index activity_hours_status_idx on activity_hours (verification_status);

create or replace function volunteer_total_verified_hours(p_volunteer_id uuid) returns numeric as $$
  select coalesce(sum(hours_verified), 0) from activity_hours
  where volunteer_id = p_volunteer_id and verification_status = 'verified';
$$ language sql stable;
```

- [x] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0006_activity_hours.sql backend/supabase/tests/database/activity_hours_test.sql
git commit -m "feat(backend): add activity_hours table with verified-hours rollup"
```

---

### Task 8: `chapters` and `volunteer_chapter_link` tables

**Files:**
- Create: `backend/supabase/migrations/0007_chapters.sql`
- Test: `backend/supabase/tests/database/chapters_test.sql`

**Interfaces:**
- Consumes: `volunteers(id)` (Task 2).
- Produces: tables `chapters`, `volunteer_chapter_link`.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/chapters_test.sql`:

```sql
begin;
select plan(3);

select has_table('public', 'chapters', 'chapters exists');
select has_table('public', 'volunteer_chapter_link', 'volunteer_chapter_link exists');

insert into chapters (organization_id, name, institution, city, province)
values ('11111111-1111-1111-1111-111111111111', 'LUMS Chapter', 'LUMS', 'Lahore', 'Punjab')
returning id as chapter_id \gset

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Chapter Test', 'chapter-test@example.com', '0300-5555555', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'LUMS', 'BSCS')
returning id as vol_id \gset

insert into volunteer_chapter_link (volunteer_id, chapter_id, organization_id)
values (:'vol_id', :'chapter_id', '11111111-1111-1111-1111-111111111111');

select is((select count(*) from volunteer_chapter_link where volunteer_id = :'vol_id'), 1::bigint, 'link created');

select * from finish();
rollback;
```

- [x] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — tables do not exist.

- [x] **Step 3: Write the migration**

Create `backend/supabase/migrations/0007_chapters.sql`:

```sql
create table chapters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  institution text,
  city text,
  province text,
  status text not null default 'active' check (status in ('active', 'inactive'))
);

create index chapters_org_idx on chapters (organization_id);

create table volunteer_chapter_link (
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  organization_id uuid not null,
  linked_at timestamptz not null default now(),
  primary key (volunteer_id, chapter_id)
);
```

- [x] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0007_chapters.sql backend/supabase/tests/database/chapters_test.sql
git commit -m "feat(backend): add chapters and volunteer_chapter_link tables"
```

---

### Task 9: `admin_action_log` and `profile_field_changes` tables

**Files:**
- Create: `backend/supabase/migrations/0008_admin_action_log_and_profile_field_changes.sql`
- Test: `backend/supabase/tests/database/admin_action_log_and_profile_field_changes_test.sql`

**Interfaces:**
- Consumes: `volunteers(id)` (Task 2).
- Produces: append-only tables `admin_action_log`, `profile_field_changes`. Written to by every state-changing Edge Function from Task 12 onward.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/admin_action_log_and_profile_field_changes_test.sql`:

```sql
begin;
select plan(4);

select has_table('public', 'admin_action_log', 'admin_action_log exists');
select has_table('public', 'profile_field_changes', 'profile_field_changes exists');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Log Test', 'log-test@example.com', '0300-6666666', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

select throws_ok(
  format($$ insert into profile_field_changes (volunteer_id, field_name, old_value, new_value) values ('%s', 'full_name', 'a', 'b') $$, :'vol_id'),
  '23514',
  null,
  'field_name is restricted to the safeguarding-relevant field list'
);

insert into profile_field_changes (volunteer_id, field_name, old_value, new_value)
values (:'vol_id', 'dob', '1999-01-01', '1998-01-01');

select is((select count(*) from profile_field_changes where volunteer_id = :'vol_id'), 1::bigint, 'allowed field_name is accepted');

select * from finish();
rollback;
```

- [x] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — tables do not exist.

- [x] **Step 3: Write the migration**

Create `backend/supabase/migrations/0008_admin_action_log_and_profile_field_changes.sql`:

```sql
create table admin_action_log (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid,
  actor_type text not null default 'staff',
  action text not null,
  target_type text not null,
  target_id uuid not null,
  organization_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index admin_action_log_org_idx on admin_action_log (organization_id);
create index admin_action_log_target_idx on admin_action_log (target_type, target_id);

create table profile_field_changes (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  field_name text not null
    check (field_name in ('dob', 'cnic_number', 'phone', 'emergency_contact', 'guardian_name', 'guardian_contact')),
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);

create index profile_field_changes_volunteer_idx on profile_field_changes (volunteer_id);
```

- [x] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0008_admin_action_log_and_profile_field_changes.sql backend/supabase/tests/database/admin_action_log_and_profile_field_changes_test.sql
git commit -m "feat(backend): add admin_action_log and profile_field_changes tables"
```

---

### Task 10: RLS on `volunteers` + staff-claim helper functions

**Files:**
- Create: `backend/supabase/migrations/0009_rls_volunteers.sql`
- Test: `backend/supabase/tests/database/rls_volunteers_test.sql`

**Interfaces:**
- Consumes: `volunteers`, `org_volunteer_index` (Tasks 2–3).
- Produces: functions `is_platform_owner() returns boolean`, `staff_org_ids() returns uuid[]`, `staff_has_org_role(p_org_id uuid) returns boolean` (org *visibility* only — no role-name filtering, see below), `staff_has_permission(p_org_id uuid, p_module text, p_permission text) returns boolean` (fine-grained *authorization* for a specific action) — used by every RLS policy in Task 11 and by Edge Function handlers that need to check staff authority server-side.

The staff JWT (issued by `platform`, verified here because both Supabase projects share the same JWT secret) carries this claim shape (per the `platform`/`tmp-partner-admin` spec §4):

```json
{
  "actor_type": "staff",
  "platform_owner": false,
  "org_roles": [{ "organization_id": "uuid" }],
  "module_access": [
    { "organization_id": "uuid", "module": "vms", "permissions": ["applications:read", "applications:update"] }
  ]
}
```

`org_roles` carries only `organization_id` — `platform`'s own org-management tiers (`org_admin`/`org_super_admin`) are a `platform`-internal concept and never travel here (this superseded an earlier draft of this claim shape that included a `role` field; nothing in this repo ever shipped against that draft). `staff_has_org_role()` is therefore a pure "is this staff affiliated with this org" check, used for RLS *visibility* only (e.g. "can this staff see this volunteer's row"). Whether a specific *write* is allowed is a `staff_has_permission()` check against `module_access[].permissions`, resolved by `platform`'s `mintStaffToken()` at token-mint time — an `org_super_admin` gets every permission for every module their org has enabled resolved directly into the token, so this function never needs to know about `platform`'s org tiers.

`volunteers` gets a self-select policy only, no self-update policy. A volunteer's own row can only be written by `registerVolunteer()` (create) and `updateSensitiveField()` (update) — both service-role Edge Functions. This was not the case originally: a `volunteers_self_update` policy with no `with check` clause let a volunteer `PATCH` their own row directly via PostgREST and edit `dob`, `cnic_number`, `phone`, `emergency_contact`, `guardian_name`, and `guardian_contact` — exactly the fields `updateSensitiveField()` exists to gate and log to `profile_field_changes` (spec §3, §4). Postgres RLS can't restrict *which columns* an `update` policy allows (only which *rows*), so there is no safe middle ground here: since the frontend plan never has a legitimate reason to write any field on `volunteers` directly (every self-edit already routes through `updateSensitiveField()`, and there is currently no frontend flow for editing any other field), the correct fix is no self-update RLS policy at all, not a narrower one.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/rls_volunteers_test.sql`:

```sql
begin;
select plan(9);

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'RLS Test', 'rls-test@example.com', '0300-7777777', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

select touch_org_volunteer_index('22222222-2222-2222-2222-222222222222', :'vol_id');

select set_config('request.jwt.claims', format('{"sub": "%s"}', (select auth_user_id from volunteers where id = :'vol_id')), true);
select set_config('role', 'authenticated', true);
update volunteers set cnic_number = '00000000000' where id = :'vol_id';
select is(
  (select cnic_number from volunteers where id = :'vol_id'),
  null,
  'a volunteer cannot update their own row directly via RLS — with no self-update policy, the UPDATE silently matches zero rows (RLS filters rows for UPDATE, it does not raise); only updateSensitiveField() and registerVolunteer() (service-role Edge Functions) may write volunteers'
);

select set_config('request.jwt.claims', '{"platform_owner": true}', true);
select is(is_platform_owner(), true, 'platform_owner claim recognized');

select set_config('request.jwt.claims', '{"org_roles": [{"organization_id": "22222222-2222-2222-2222-222222222222"}]}', true);
select ok('22222222-2222-2222-2222-222222222222'::uuid = any(staff_org_ids()), 'staff_org_ids extracts org uuids from claim');
select is(staff_has_org_role('22222222-2222-2222-2222-222222222222'::uuid), true, 'staff_has_org_role true for a matching org');
select is(staff_has_org_role('33333333-3333-3333-3333-333333333333'::uuid), false, 'staff_has_org_role false for a non-matching org');

select set_config('request.jwt.claims', '{}', true);
select is(staff_has_org_role('22222222-2222-2222-2222-222222222222'::uuid), false, 'no claim means no access');

select set_config('request.jwt.claims', '{"module_access": [{"organization_id": "22222222-2222-2222-2222-222222222222", "module": "vms", "permissions": ["applications:update"]}]}', true);
select is(staff_has_permission('22222222-2222-2222-2222-222222222222'::uuid, 'vms', 'applications:update'), true, 'staff_has_permission true for a granted permission');
select is(staff_has_permission('22222222-2222-2222-2222-222222222222'::uuid, 'vms', 'applications:write'), false, 'staff_has_permission false for an ungranted permission');

select set_config('request.jwt.claims', '{"platform_owner": true}', true);
select is(staff_has_permission('44444444-4444-4444-4444-444444444444'::uuid, 'vms', 'applications:write'), true, 'platform_owner bypasses permission checks entirely');

select * from finish();
rollback;
```

- [x] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — functions do not exist.

- [x] **Step 3: Write the migration**

Create `backend/supabase/migrations/0009_rls_volunteers.sql`:

```sql
create or replace function is_platform_owner() returns boolean as $$
  select coalesce((auth.jwt() ->> 'platform_owner')::boolean, false);
$$ language sql stable;

create or replace function staff_org_ids() returns uuid[] as $$
  select coalesce(array_agg((r ->> 'organization_id')::uuid), '{}')
  from jsonb_array_elements(coalesce(auth.jwt() -> 'org_roles', '[]'::jsonb)) r;
$$ language sql stable;

create or replace function staff_has_org_role(p_org_id uuid) returns boolean as $$
  select is_platform_owner() or exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'org_roles', '[]'::jsonb)) r
    where (r ->> 'organization_id')::uuid = p_org_id
  );
$$ language sql stable;

create or replace function staff_has_permission(p_org_id uuid, p_module text, p_permission text) returns boolean as $$
  select is_platform_owner() or exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'module_access', '[]'::jsonb)) m
    where (m ->> 'organization_id')::uuid = p_org_id
      and (m ->> 'module') = p_module
      and (m -> 'permissions') ? p_permission
  );
$$ language sql stable;

alter table volunteers enable row level security;

create policy volunteers_self_select on volunteers
  for select using (auth_user_id = auth.uid());

-- Deliberately no self-update policy: a volunteer's own row is written only by
-- registerVolunteer() and updateSensitiveField() (both service-role Edge
-- Functions). RLS update policies filter which rows an UPDATE can touch, not
-- which columns, so there is no safe narrower policy here that still lets a
-- volunteer bypass updateSensitiveField()'s profile_field_changes audit log.

create policy volunteers_staff_select on volunteers
  for select using (
    is_platform_owner()
    or exists (
      select 1 from org_volunteer_index ovi
      where ovi.volunteer_id = volunteers.id
        and ovi.organization_id = any(staff_org_ids())
    )
  );
```

Note: `auth.jwt()` reads verified claims from `request.jwt.claims`, which pgTAP tests set directly via `set_config` to simulate a request without needing a real HTTP call — this is the standard way to test RLS policies locally.

- [x] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0009_rls_volunteers.sql backend/supabase/tests/database/rls_volunteers_test.sql
git commit -m "feat(backend): add RLS on volunteers with join-based staff visibility"
```

---

### Task 11: RLS on org-scoped tables

**Files:**
- Create: `backend/supabase/migrations/0010_rls_org_scoped.sql`
- Test: `backend/supabase/tests/database/rls_org_scoped_test.sql`

**Interfaces:**
- Consumes: `staff_has_org_role()`, `staff_has_permission()`, `is_platform_owner()` (Task 10); all org-scoped tables (Tasks 3–9), including `org_volunteer_index` (Task 3) which was previously left without RLS entirely. Staff *select* policies stay org-visibility-only (`staff_has_org_role()`), matching platform's admin hub reading a module backend's PostgREST directly with the staff JWT (`platform`/`tmp-partner-admin` spec §7) — reads for a staff member's own org are always fine to show, and the fine-grained model is about gating actions, not visibility. Staff *write* policies (insert/update/delete) now call `staff_has_permission()` for the specific resource:action instead of the coarse org-membership-only check they used before. This matters because the admin hub's browser client attaches the staff JWT and calls PostgREST directly, not exclusively through Edge Functions (platform spec §7, "direct client calls, no proxy") — so RLS, not "every write already goes through a service-role Edge Function," is the real backstop for any table a caller can reach with nothing but a valid staff token. A staff member holding only a read-only role must not be able to write by skipping the UI and calling PostgREST directly; the previous `staff_has_org_role(organization_id)`-only write policies allowed exactly that for every org-scoped table.

`applications` and `activity_hours` also drop their volunteer-side self-insert policies entirely, for the same reason `volunteers` drops its self-update policy (Task 10): every legitimate volunteer write to these tables already goes through `apply-to-opportunity()` and `submit-hours()` (both service-role Edge Functions), so a direct-insert RLS policy only exists to be bypassed. It previously was one — `applications_self_insert` let a volunteer insert an application directly, skipping `apply-to-opportunity()`'s `cnic_required` gate entirely, and `activity_hours_self_insert` let a volunteer submit hours against *any* `participation_id` system-wide, since the policy only checked that `volunteer_id` matched the caller and never verified the referenced participation actually belonged to them. `applications_self_select`/`activity_hours_self_select` are unaffected — volunteers still need to read their own rows for the My Applications and Portfolio pages.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/rls_org_scoped_test.sql`:

```sql
begin;
select plan(10);

insert into opportunities (organization_id, name, type)
values ('22222222-2222-2222-2222-222222222222', 'Public Op', 'event')
returning id as opp_id \gset

select set_config('request.jwt.claims', '{}', true);
select set_config('role', 'authenticated', true);
select is((select count(*) from opportunities where id = :'opp_id'), 1::bigint, 'anyone can read a non-deactivated opportunity');

select set_config('request.jwt.claims', '{"org_roles": [{"organization_id": "33333333-3333-3333-3333-333333333333"}]}', true);
select throws_ok(
  format($$ update opportunities set name = 'hijacked' where id = '%s' $$, :'opp_id'),
  null,
  null,
  'staff from a different org cannot write to this opportunity'
);

select set_config(
  'request.jwt.claims',
  '{"org_roles": [{"organization_id": "22222222-2222-2222-2222-222222222222"}], "module_access": [{"organization_id": "22222222-2222-2222-2222-222222222222", "module": "vms", "permissions": ["opportunities:read"]}]}',
  true
);
select throws_ok(
  format($$ update opportunities set name = 'read-only hijack' where id = '%s' $$, :'opp_id'),
  null,
  null,
  'staff from the owning org with only opportunities:read cannot write to this opportunity — org membership alone is not enough'
);

select set_config(
  'request.jwt.claims',
  '{"org_roles": [{"organization_id": "22222222-2222-2222-2222-222222222222"}], "module_access": [{"organization_id": "22222222-2222-2222-2222-222222222222", "module": "vms", "permissions": ["opportunities:update"]}]}',
  true
);
update opportunities set name = 'updated by owning org staff' where id = :'opp_id';
select is((select name from opportunities where id = :'opp_id'), 'updated by owning org staff', 'staff from the owning org with opportunities:update can write');

select set_config('request.jwt.claims', '{}', true);
select is((select count(*) from applications), 0::bigint, 'no applications visible with no volunteer session and no staff claim');

select touch_org_volunteer_index('22222222-2222-2222-2222-222222222222', gen_random_uuid());

select set_config('request.jwt.claims', '{}', true);
select is((select count(*) from org_volunteer_index), 0::bigint, 'org_volunteer_index is not readable with no staff claim — regression test for the table having no RLS at all');

select set_config('request.jwt.claims', '{"org_roles": [{"organization_id": "22222222-2222-2222-2222-222222222222"}]}', true);
select is((select count(*) from org_volunteer_index where organization_id = '22222222-2222-2222-2222-222222222222'), 1::bigint, 'staff affiliated with the org can read its org_volunteer_index rows');

select throws_ok(
  $$ insert into org_volunteer_index (organization_id, volunteer_id) values ('22222222-2222-2222-2222-222222222222', gen_random_uuid()) $$,
  null,
  null,
  'no insert policy exists for org_volunteer_index — even an owning-org staff member cannot write it directly, only touch_org_volunteer_index() via the service-role client can'
);

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Direct Insert Test', 'direct-insert-test@example.com', '0300-8888888', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id, auth_user_id \gset direct_insert_

insert into participation (volunteer_id, opportunity_id, organization_id)
values (:'direct_insert_id', :'opp_id', '22222222-2222-2222-2222-222222222222')
returning id as direct_insert_participation_id \gset

select set_config('request.jwt.claims', format('{"sub": "%s"}', :'direct_insert_auth_user_id'), true);
select set_config('role', 'authenticated', true);

-- Unlike UPDATE (Task 10's volunteers_self_update test), a missing INSERT
-- policy makes Postgres evaluate an implicit `with check (false)` — the insert
-- itself raises an RLS violation rather than silently affecting zero rows.
select throws_ok(
  format($$ insert into applications (volunteer_id, opportunity_id, organization_id) values ('%s', '%s', '22222222-2222-2222-2222-222222222222') $$, :'direct_insert_id', :'opp_id'),
  null,
  null,
  'a volunteer cannot insert into applications directly via RLS — no self-insert policy exists; only apply-to-opportunity() (service-role, enforces cnic_required) may write it'
);

select throws_ok(
  format(
    $$ insert into activity_hours (participation_id, volunteer_id, opportunity_id, organization_id, activity_date, hours_submitted) values ('%s', '%s', '%s', '22222222-2222-2222-2222-222222222222', current_date, 3) $$,
    :'direct_insert_participation_id', :'direct_insert_id', :'opp_id'
  ),
  null,
  null,
  'a volunteer cannot insert into activity_hours directly via RLS — no self-insert policy exists; only submit-hours() (service-role) may write it'
);

select * from finish();
rollback;
```

- [x] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — RLS not yet enabled/tightened, so the "read-only cannot write," "org_volunteer_index not readable with no claim," and "no insert policy" assertions fail.

- [x] **Step 3: Write the migration**

Create `backend/supabase/migrations/0010_rls_org_scoped.sql`:

```sql
alter table opportunities enable row level security;

create policy opportunities_public_select on opportunities
  for select using (deactivated_at is null);

create policy opportunities_staff_select on opportunities
  for select using (staff_has_org_role(organization_id));

create policy opportunities_staff_insert on opportunities
  for insert with check (staff_has_permission(organization_id, 'vms', 'opportunities:write'));

create policy opportunities_staff_update on opportunities
  for update using (staff_has_permission(organization_id, 'vms', 'opportunities:update'));

create policy opportunities_staff_delete on opportunities
  for delete using (staff_has_permission(organization_id, 'vms', 'opportunities:delete'));

alter table applications enable row level security;

create policy applications_self_select on applications
  for select using (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

-- Deliberately no self-insert policy: apply-to-opportunity() (service-role)
-- enforces cnic_required before writing; a direct insert would bypass that.

create policy applications_staff_select on applications
  for select using (staff_has_org_role(organization_id));

create policy applications_staff_update on applications
  for update using (staff_has_permission(organization_id, 'vms', 'applications:update'));

alter table participation enable row level security;

create policy participation_self_select on participation
  for select using (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

create policy participation_staff_select on participation
  for select using (staff_has_org_role(organization_id));

create policy participation_staff_insert on participation
  for insert with check (staff_has_permission(organization_id, 'vms', 'participation:write'));

create policy participation_staff_update on participation
  for update using (staff_has_permission(organization_id, 'vms', 'participation:update'));

alter table activity_hours enable row level security;

create policy activity_hours_self_select on activity_hours
  for select using (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

-- Deliberately no self-insert policy: submit-hours() (service-role) is the
-- only write path — a direct insert here previously only checked that
-- volunteer_id matched the caller, never that the participation_id they
-- supplied actually belonged to them.

create policy activity_hours_staff_select on activity_hours
  for select using (staff_has_org_role(organization_id));

create policy activity_hours_staff_insert on activity_hours
  for insert with check (staff_has_permission(organization_id, 'vms', 'hours:write'));

create policy activity_hours_staff_update on activity_hours
  for update using (staff_has_permission(organization_id, 'vms', 'hours:update'));

alter table chapters enable row level security;

create policy chapters_public_select on chapters
  for select using (status = 'active');

create policy chapters_staff_select on chapters
  for select using (staff_has_org_role(organization_id));

create policy chapters_staff_insert on chapters
  for insert with check (staff_has_permission(organization_id, 'vms', 'chapters:write'));

create policy chapters_staff_update on chapters
  for update using (staff_has_permission(organization_id, 'vms', 'chapters:update'));

create policy chapters_staff_delete on chapters
  for delete using (staff_has_permission(organization_id, 'vms', 'chapters:delete'));

alter table volunteer_chapter_link enable row level security;

create policy volunteer_chapter_link_self_select on volunteer_chapter_link
  for select using (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

create policy volunteer_chapter_link_staff_select on volunteer_chapter_link
  for select using (staff_has_org_role(organization_id));

create policy volunteer_chapter_link_staff_insert on volunteer_chapter_link
  for insert with check (staff_has_permission(organization_id, 'vms', 'chapters:write'));

create policy volunteer_chapter_link_staff_delete on volunteer_chapter_link
  for delete using (staff_has_permission(organization_id, 'vms', 'chapters:update'));

alter table admin_action_log enable row level security;

create policy admin_action_log_staff_select on admin_action_log
  for select using (organization_id is null or staff_has_org_role(organization_id));

alter table profile_field_changes enable row level security;

create policy profile_field_changes_staff_select on profile_field_changes
  for select using (
    is_platform_owner()
    or exists (
      select 1 from org_volunteer_index ovi
      where ovi.volunteer_id = profile_field_changes.volunteer_id
        and ovi.organization_id = any(staff_org_ids())
    )
  );

alter table org_volunteer_index enable row level security;

create policy org_volunteer_index_staff_select on org_volunteer_index
  for select using (staff_has_org_role(organization_id));
```

`volunteer_chapter_link` has no dedicated permission resource in the catalog (platform spec §3's `permissions` seed list only defines `chapters:*`) since a chapter-membership link is treated as part of chapter management: linking a volunteer to a chapter requires `chapters:write`, unlinking requires `chapters:update`.

No insert/update/delete policies are defined for `admin_action_log`, `profile_field_changes`, or **`org_volunteer_index`** — all three are written only by Edge Functions using the service-role key, which bypasses RLS entirely, matching the spec's "never a direct frontend-to-DB write" constraint. `org_volunteer_index` previously had RLS disabled altogether (no `alter table ... enable row level security` statement anywhere in this plan), which meant every row — the entire platform-wide graph of which volunteers have contacted which organizations — was readable by any authenticated caller by default, and, far more seriously, writable: anyone could `insert` an `(organization_id, volunteer_id)` row directly, and since `volunteers_staff_select` (Task 10) and `upload-cnic-document`'s "read" action (Task 23) both grant visibility based on an `org_volunteer_index` link existing, a forged row was a way to self-grant visibility into any volunteer's PII or CNIC document. Enabling RLS with a select-only policy and no write policy closes this — `touch_org_volunteer_index()` remains the only write path, and since it's `language sql` (invoker-rights by default, no `security definer`), its internal `insert ... on conflict` is itself subject to this same RLS when called directly via `supabase.rpc()` outside a service-role Edge Function, so no separate `revoke execute` is needed.

- [x] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS on all 10 assertions.

- [x] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0010_rls_org_scoped.sql backend/supabase/tests/database/rls_org_scoped_test.sql
git commit -m "fix(backend): enable RLS on org_volunteer_index, require fine-grained permissions for staff writes, close volunteer self-insert bypasses"
```

---

### Task 12: `verifyStaffToken()` shared module

**Files:**
- Create: `backend/supabase/functions/_shared/verifyStaffToken.ts`
- Create: `backend/supabase/functions/_shared/verifyStaffToken.test.ts`

**Interfaces:**
- Produces: `verifyStaffToken(authHeader: string | null): StaffClaims` — throws `Error("unauthorized")` on any failure. `StaffClaims = { actorType: string; staffId: string; platformOwner: boolean; orgRoles: { organizationId: string }[]; moduleAccess: { organizationId: string; module: string; permissions: string[] }[] }`; `staffHasPermission(claims: StaffClaims, organizationId: string, module: string, permission: string): boolean`. Used by every Edge Function handler that needs to check staff authority in application code (Tasks 16–21, 25–28). `staffId` is parsed from the token's `staff_id` claim (minted by `platform`'s `mintStaffToken()`, `tmp-partner-admin` plan Task 12) — this is the durable identifier every state-changing handler now uses for `admin_action_log.staff_id`/`applications.decided_by`/`activity_hours.verified_by`, instead of a client-supplied `staffId` field in the request body. Before this claim existed, every staff-driven Edge Function trusted whatever `staffId` a caller put in its own JSON body, letting any staff member with valid write permission forge the audit trail by attributing their action to an arbitrary `staff_id`.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/functions/_shared/verifyStaffToken.test.ts`:

```typescript
import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyStaffToken, staffHasPermission, type StaffClaims } from "./verifyStaffToken.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const secret = "test-shared-secret-32-characters!";

async function signStaffToken(claims: Record<string, unknown>): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return create({ alg: "HS256", typ: "JWT" }, { exp: getNumericDate(60), ...claims }, key);
}

Deno.test("verifyStaffToken accepts a well-formed staff token", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  const token = await signStaffToken({
    actor_type: "staff",
    staff_id: "staff-1",
    platform_owner: false,
    org_roles: [{ organization_id: "org-1" }],
    module_access: [{ organization_id: "org-1", module: "vms", permissions: ["applications:read"] }],
  });
  const claims = await verifyStaffToken(`Bearer ${token}`);
  assertEquals(claims.actorType, "staff");
  assertEquals(claims.staffId, "staff-1");
  assertEquals(claims.orgRoles[0].organizationId, "org-1");
  assertEquals(claims.moduleAccess[0].permissions, ["applications:read"]);
});

Deno.test("verifyStaffToken rejects a missing header", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  await assertThrows(() => verifyStaffToken(null), Error, "unauthorized");
});

Deno.test("verifyStaffToken rejects a token signed with the wrong secret", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  const badKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("wrong-secret-32-characters-long!"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const token = await create({ alg: "HS256", typ: "JWT" }, { exp: getNumericDate(60), actor_type: "staff" }, badKey);
  await assertThrows(() => verifyStaffToken(`Bearer ${token}`), Error, "unauthorized");
});

Deno.test("verifyStaffToken rejects a well-signed token with no staff_id claim", async () => {
  Deno.env.set("STAFF_JWT_SECRET", secret);
  const token = await signStaffToken({
    actor_type: "staff",
    platform_owner: false,
    org_roles: [{ organization_id: "org-1" }],
    module_access: [],
  });
  await assertThrows(() => verifyStaffToken(`Bearer ${token}`), Error, "unauthorized");
});

const baseClaims = (overrides: Partial<StaffClaims> = {}): StaffClaims => ({
  actorType: "staff",
  staffId: "staff-1",
  platformOwner: false,
  orgRoles: [{ organizationId: "org-1" }],
  moduleAccess: [{ organizationId: "org-1", module: "vms", permissions: ["applications:read"] }],
  ...overrides,
});

Deno.test("staffHasPermission is true when the permission is granted for that org and module", () => {
  assertEquals(staffHasPermission(baseClaims(), "org-1", "vms", "applications:read"), true);
});

Deno.test("staffHasPermission is false when the permission isn't granted", () => {
  assertEquals(staffHasPermission(baseClaims(), "org-1", "vms", "applications:write"), false);
});

Deno.test("staffHasPermission is false for a different organization", () => {
  assertEquals(staffHasPermission(baseClaims(), "org-2", "vms", "applications:read"), false);
});

Deno.test("staffHasPermission bypasses everything for platform_owner", () => {
  assertEquals(staffHasPermission(baseClaims({ platformOwner: true, moduleAccess: [] }), "org-9", "vms", "applications:write"), true);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/_shared/verifyStaffToken.test.ts`
Expected: FAIL — `verifyStaffToken.ts` does not exist yet.

- [x] **Step 3: Write the implementation**

Create `backend/supabase/functions/_shared/verifyStaffToken.ts`:

```typescript
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

export interface ModuleAccessEntry {
  organizationId: string;
  module: string;
  permissions: string[];
}

export interface StaffClaims {
  actorType: string;
  staffId: string;
  platformOwner: boolean;
  orgRoles: { organizationId: string }[];
  moduleAccess: ModuleAccessEntry[];
}

export async function verifyStaffToken(authHeader: string | null): Promise<StaffClaims> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("unauthorized");
  }
  const token = authHeader.slice("Bearer ".length);
  const secret = Deno.env.get("STAFF_JWT_SECRET");
  if (!secret) {
    throw new Error("unauthorized");
  }
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const payload = await verify(token, key);
    if (!payload.staff_id || typeof payload.staff_id !== "string") {
      // A token with no staff_id can't be attributed to anyone — reject it
      // outright rather than falling back to an empty string, which would
      // otherwise reach admin_action_log.staff_id (a uuid column) and fail
      // as an opaque DB error instead of a clean 401.
      throw new Error("unauthorized");
    }
    return {
      actorType: String(payload.actor_type ?? "staff"),
      staffId: payload.staff_id,
      platformOwner: Boolean(payload.platform_owner),
      orgRoles: Array.isArray(payload.org_roles)
        ? (payload.org_roles as Array<Record<string, unknown>>).map((r) => ({
          organizationId: String(r.organization_id),
        }))
        : [],
      moduleAccess: Array.isArray(payload.module_access)
        ? (payload.module_access as Array<Record<string, unknown>>).map((m) => ({
          organizationId: String(m.organization_id),
          module: String(m.module),
          permissions: Array.isArray(m.permissions) ? m.permissions.map(String) : [],
        }))
        : [],
    };
  } catch {
    throw new Error("unauthorized");
  }
}

export function staffHasPermission(
  claims: StaffClaims,
  organizationId: string,
  module: string,
  permission: string,
): boolean {
  if (claims.platformOwner) return true;
  return claims.moduleAccess.some(
    (m) => m.organizationId === organizationId && m.module === module && m.permissions.includes(permission),
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/_shared/verifyStaffToken.test.ts`
Expected: PASS on all 8 tests.

- [x] **Step 5: Commit**

```bash
git add backend/supabase/functions/_shared/verifyStaffToken.ts backend/supabase/functions/_shared/verifyStaffToken.test.ts
git commit -m "feat(backend): add verifyStaffToken shared JWT verification with fine-grained permission checks"
```

---

### Task 13: Rate limiting helper

**Files:**
- Create: `backend/supabase/functions/_shared/rateLimit.ts`
- Create: `backend/supabase/functions/_shared/rateLimit.test.ts`

**Interfaces:**
- Produces: `checkRateLimit(supabase: SupabaseClient, key: string, limit: number, windowSeconds: number): Promise<boolean>` — returns `false` when the caller should be rejected with a 429. Used by `register-volunteer` and `apply-to-opportunity` (Tasks 14–15), the two open public-write endpoints named in spec §6.
- Consumes: a new `rate_limit_hits` table, created in this task's migration.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/functions/_shared/rateLimit.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "./rateLimit.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.test("checkRateLimit allows requests under the limit", async () => {
  const supabase = testClient();
  const key = `test-${crypto.randomUUID()}`;
  const allowed = await checkRateLimit(supabase, key, 3, 60);
  assertEquals(allowed, true);
});

Deno.test("checkRateLimit rejects once the limit is exceeded", async () => {
  const supabase = testClient();
  const key = `test-${crypto.randomUUID()}`;
  await checkRateLimit(supabase, key, 2, 60);
  await checkRateLimit(supabase, key, 2, 60);
  const thirdAttempt = await checkRateLimit(supabase, key, 2, 60);
  assertEquals(thirdAttempt, false);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/_shared/rateLimit.test.ts`
Expected: FAIL — module and table do not exist.

- [x] **Step 3: Add the migration**

Create `backend/supabase/migrations/0011_rate_limit_hits.sql`:

```sql
create table rate_limit_hits (
  id bigint generated always as identity primary key,
  rate_key text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_key_idx on rate_limit_hits (rate_key, created_at);

alter table rate_limit_hits enable row level security;
```

No policy of any kind is defined — this is a purely internal bookkeeping table, read and written only via `checkRateLimit()` using the service-role admin client, which bypasses RLS entirely. Enabling RLS with zero policies makes it default-deny for every other role, so a caller can no longer `DELETE`/forge rows via PostgREST directly to reset or manipulate their own rate limit and bypass the abuse protection Task 13 exists to provide (this table previously shipped with RLS disabled, same class of gap as `org_volunteer_index` in Task 11).

- [x] **Step 4: Write the implementation**

Create `backend/supabase/functions/_shared/rateLimit.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count } = await supabase
    .from("rate_limit_hits")
    .select("*", { count: "exact", head: true })
    .eq("rate_key", key)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= limit) {
    return false;
  }

  await supabase.from("rate_limit_hits").insert({ rate_key: key });
  return true;
}
```

- [x] **Step 5: Apply migration and run tests**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/_shared/rateLimit.test.ts`
Expected: PASS on both tests.

- [x] **Step 6: Commit**

```bash
git add backend/supabase/migrations/0011_rate_limit_hits.sql backend/supabase/functions/_shared/rateLimit.ts backend/supabase/functions/_shared/rateLimit.test.ts
git commit -m "feat(backend): add rate limiting helper for public write endpoints"
```

---

### Task 14: `register-volunteer` Edge Function

**Files:**
- Create: `backend/supabase/functions/register-volunteer/handler.ts`
- Create: `backend/supabase/functions/register-volunteer/handler.test.ts`
- Create: `backend/supabase/functions/register-volunteer/index.ts`

**Interfaces:**
- Consumes: `getAdminClient()` (Task 1), `checkRateLimit()` (Task 13), `volunteer_is_minor()` (Task 2).
- Produces: `registerVolunteer(supabase: SupabaseClient, input: RegisterVolunteerInput): Promise<RegisterVolunteerResult>`. `RegisterVolunteerInput` includes `authUserId`, all mandatory `volunteers` fields, and optional `guardianName`/`guardianContact`/`guardianConsent: boolean`. `RegisterVolunteerResult = { volunteerId: string; volunteerCode: string }`. Throws `Error("minor_consent_required")` when DOB implies a minor and consent fields are incomplete. Runs near-duplicate detection (same `full_name` + `city`, different `email`) after a successful insert and, on a match, writes an `admin_action_log` row with `actor_type: 'system'`, `action: 'duplicate_flagged'` rather than blocking registration — this lives here, not in `applyToOpportunity()`, matching the requirements doc's own placement under registration (§5A): "On a near-duplicate match ... flag the registration for administrator review."

- [x] **Step 1: Write the failing test**

Create `backend/supabase/functions/register-volunteer/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { registerVolunteer } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

const baseInput = {
  fullName: "Test Volunteer",
  email: () => `vol-${crypto.randomUUID()}@example.com`,
  phone: () => `0300-${Math.floor(Math.random() * 10000000)}`,
  gender: "female",
  city: "Lahore",
  province: "Punjab",
  country: "Pakistan",
  institution: "Test University",
  degreeProgram: "BSCS",
};

Deno.test("registerVolunteer creates an adult volunteer without guardian fields", async () => {
  const supabase = testClient();
  const result = await registerVolunteer(supabase, {
    authUserId: crypto.randomUUID(),
    ...baseInput,
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "1999-01-01",
  });
  assertEquals(typeof result.volunteerId, "string");
});

Deno.test("registerVolunteer rejects a minor without guardian consent", async () => {
  const supabase = testClient();
  await assertRejects(
    () =>
      registerVolunteer(supabase, {
        authUserId: crypto.randomUUID(),
        ...baseInput,
        email: baseInput.email(),
        phone: baseInput.phone(),
        dob: "2015-01-01",
      }),
    Error,
    "minor_consent_required",
  );
});

Deno.test("registerVolunteer accepts a minor with complete guardian consent", async () => {
  const supabase = testClient();
  const result = await registerVolunteer(supabase, {
    authUserId: crypto.randomUUID(),
    ...baseInput,
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "2015-01-01",
    guardianName: "Parent Name",
    guardianContact: "0300-9999999",
    guardianConsent: true,
  });
  assertEquals(typeof result.volunteerId, "string");
});

Deno.test("registerVolunteer flags a near-duplicate without blocking registration", async () => {
  const supabase = testClient();
  await registerVolunteer(supabase, {
    authUserId: crypto.randomUUID(),
    ...baseInput,
    fullName: "Duplicate Person",
    city: "Multan",
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "1999-01-01",
  });

  const result = await registerVolunteer(supabase, {
    authUserId: crypto.randomUUID(),
    ...baseInput,
    fullName: "Duplicate Person",
    city: "Multan",
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "1999-01-01",
  });

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("action", "duplicate_flagged")
    .eq("target_id", result.volunteerId);

  assertEquals(logRows?.length, 1);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/register-volunteer/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [x] **Step 3: Write the implementation**

Create `backend/supabase/functions/register-volunteer/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export interface RegisterVolunteerInput {
  authUserId: string;
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  city: string;
  province: string;
  country: string;
  institution: string;
  degreeProgram: string;
  guardianName?: string;
  guardianContact?: string;
  guardianConsent?: boolean;
}

export interface RegisterVolunteerResult {
  volunteerId: string;
  volunteerCode: string;
}

async function flagNearDuplicatesIfAny(
  supabase: SupabaseClient,
  volunteerId: string,
  fullName: string,
  city: string,
  email: string,
) {
  const { data: matches } = await supabase
    .from("volunteers")
    .select("id, email")
    .eq("full_name", fullName)
    .eq("city", city)
    .neq("id", volunteerId);

  const realMatches = (matches ?? []).filter((m) => m.email !== email);
  if (realMatches.length > 0) {
    await supabase.from("admin_action_log").insert({
      actor_type: "system",
      action: "duplicate_flagged",
      target_type: "volunteer",
      target_id: volunteerId,
      metadata: { matched_volunteer_ids: realMatches.map((m) => m.id) },
    });
  }
}

export async function registerVolunteer(
  supabase: SupabaseClient,
  input: RegisterVolunteerInput,
): Promise<RegisterVolunteerResult> {
  const { data: minorCheck, error: minorCheckError } = await supabase
    .rpc("volunteer_is_minor", { v_dob: input.dob });
  if (minorCheckError) throw minorCheckError;

  if (minorCheck === true) {
    const hasConsent = Boolean(input.guardianName && input.guardianContact && input.guardianConsent);
    if (!hasConsent) {
      throw new Error("minor_consent_required");
    }
  }

  const { data, error } = await supabase
    .from("volunteers")
    .insert({
      auth_user_id: input.authUserId,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      dob: input.dob,
      gender: input.gender,
      city: input.city,
      province: input.province,
      country: input.country,
      institution: input.institution,
      degree_program: input.degreeProgram,
      guardian_name: input.guardianName ?? null,
      guardian_contact: input.guardianContact ?? null,
      guardian_consent_at: input.guardianConsent ? new Date().toISOString() : null,
    })
    .select("id, volunteer_code")
    .single();

  if (error) throw error;

  await flagNearDuplicatesIfAny(supabase, data.id, input.fullName, input.city, input.email);

  return { volunteerId: data.id, volunteerCode: data.volunteer_code };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/register-volunteer/handler.test.ts`
Expected: PASS on all 4 tests.

- [x] **Step 5: Write the HTTP wrapper**

Create `backend/supabase/functions/register-volunteer/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { registerVolunteer } from "./handler.ts";

Deno.serve(async (req) => {
  const supabase = getAdminClient();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const allowed = await checkRateLimit(supabase, `register:${ip}`, 5, 3600);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
  }

  try {
    const input = await req.json();
    const result = await registerVolunteer(supabase, input);
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "minor_consent_required" ? 422 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [x] **Step 6: Commit**

```bash
git add backend/supabase/functions/register-volunteer/
git commit -m "feat(backend): add register-volunteer Edge Function with minor consent gating and duplicate flagging"
```

---

### Task 15: `apply-to-opportunity` Edge Function

**Files:**
- Create: `backend/supabase/functions/apply-to-opportunity/handler.ts`
- Create: `backend/supabase/functions/apply-to-opportunity/handler.test.ts`
- Create: `backend/supabase/functions/apply-to-opportunity/index.ts`

**Interfaces:**
- Consumes: `getAdminClient()`, `checkRateLimit()`.
- Produces: `applyToOpportunity(supabase, input: { volunteerId: string; opportunityId: string; organizationId: string; motivationStatement?: string }): Promise<{ applicationId: string }>`. Throws `Error("cnic_required")` if the volunteer has no `cnic_number` on file — registration itself doesn't require CNIC (spec §3: "mandatory eventually; not blocking at registration"), but this is the enforcement point that makes CNIC-based duplicate uniqueness actually meaningful across the volunteers who go on to participate, without adding friction for volunteers who only browse. (Near-duplicate detection itself lives in `registerVolunteer()`, Task 14 — not here.)

- [x] **Step 1: Write the failing test**

Create `backend/supabase/functions/apply-to-opportunity/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { applyToOpportunity } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>, overrides: Record<string, unknown> = {}) {
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: crypto.randomUUID(),
    full_name: "Apply Test",
    email: `apply-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "male",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    institution: "Test Uni",
    degree_program: "BSCS",
    cnic_number: `${Math.floor(Math.random() * 100000000000)}`,
    ...overrides,
  }).select("id").single();
  return data!.id as string;
}

async function makeOpportunity(supabase: ReturnType<typeof testClient>, organizationId: string) {
  const { data } = await supabase.from("opportunities").insert({
    organization_id: organizationId,
    name: "Test Opp",
    type: "event",
  }).select("id").single();
  return data!.id as string;
}

Deno.test("applyToOpportunity creates an application", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const volunteerId = await makeVolunteer(supabase);
  const opportunityId = await makeOpportunity(supabase, orgId);

  const result = await applyToOpportunity(supabase, {
    volunteerId,
    opportunityId,
    organizationId: orgId,
  });

  assertEquals(typeof result.applicationId, "string");
});

Deno.test("applyToOpportunity rejects when the volunteer has no cnic_number on file", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const volunteerId = await makeVolunteer(supabase, { cnic_number: null });
  const opportunityId = await makeOpportunity(supabase, orgId);

  await assertRejects(
    () => applyToOpportunity(supabase, { volunteerId, opportunityId, organizationId: orgId }),
    Error,
    "cnic_required",
  );
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/apply-to-opportunity/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [x] **Step 3: Write the implementation**

Create `backend/supabase/functions/apply-to-opportunity/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export interface ApplyToOpportunityInput {
  volunteerId: string;
  opportunityId: string;
  organizationId: string;
  motivationStatement?: string;
}

export interface ApplyToOpportunityResult {
  applicationId: string;
}

export async function applyToOpportunity(
  supabase: SupabaseClient,
  input: ApplyToOpportunityInput,
): Promise<ApplyToOpportunityResult> {
  const { data: volunteer, error: volunteerError } = await supabase
    .from("volunteers")
    .select("cnic_number")
    .eq("id", input.volunteerId)
    .single();
  if (volunteerError) throw volunteerError;
  if (!volunteer.cnic_number) {
    throw new Error("cnic_required");
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({
      volunteer_id: input.volunteerId,
      opportunity_id: input.opportunityId,
      organization_id: input.organizationId,
      motivation_statement: input.motivationStatement ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.rpc("touch_org_volunteer_index", {
    p_org_id: input.organizationId,
    p_volunteer_id: input.volunteerId,
  });

  return { applicationId: data.id };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/apply-to-opportunity/handler.test.ts`
Expected: PASS on both tests.

- [x] **Step 5: Write the HTTP wrapper**

Create `backend/supabase/functions/apply-to-opportunity/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { applyToOpportunity } from "./handler.ts";

Deno.serve(async (req) => {
  const supabase = getAdminClient();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const allowed = await checkRateLimit(supabase, `apply:${ip}`, 20, 3600);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
  }

  try {
    const input = await req.json();
    const result = await applyToOpportunity(supabase, input);
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
});
```

- [x] **Step 6: Commit**

```bash
git add backend/supabase/functions/apply-to-opportunity/
git commit -m "feat(backend): add apply-to-opportunity Edge Function, requiring cnic_number on file"
```

---

### Task 16: `decide-application` Edge Function

**Files:**
- Create: `backend/supabase/functions/decide-application/handler.ts`
- Create: `backend/supabase/functions/decide-application/handler.test.ts`
- Create: `backend/supabase/functions/decide-application/index.ts`

**Interfaces:**
- Consumes: `verifyStaffToken()`, `staffHasPermission()` (Task 12) — the handler checks `applications:update` in application code, since the write itself goes through the admin client (bypassing RLS) and needs a clean 403 rather than a raw Postgres error.
- Produces: `decideApplication(supabase, staffClaims: StaffClaims, input: { applicationId: string; decision: "selected" | "waitlisted" | "rejected" | "under_review" }): Promise<{ applicationId: string; participationId: string | null }>`. Requires `applications:update` for the application's org — deciding an application is a status change on an existing row, mapping onto the `update` action per the `platform` spec's four-verb permission model (§3). Manual waitlist promotion (requirements doc §5D) is just a later call with `decision: "selected"` on a `waitlisted` application — no separate function. Throws `Error("emergency_contact_required")` if `decision === "selected"` and the volunteer has no `emergency_contact` on file, matching the requirements doc's "Required for safety once a volunteer is selected for an in-person activity" (§5A) — this is why `emergency_contact` stays nullable in the schema (Task 2) rather than `not null`: it must be collectible any time before selection, not forced at registration. Idempotent on repeated `"selected"` decisions: checks for an existing `participation` row by `application_id` before inserting, so a double-click or client retry reuses the existing `participationId` instead of creating a second one — the `participation.application_id` partial unique index (Task 6) is the DB-level backstop for the same invariant. `applications.decided_by` and `admin_action_log.staff_id` are both set from `staffClaims.staffId` (Task 12), never from `input` — `input` has no `staffId` field at all, so there is nothing for a caller to spoof.

The original version of this function took `staffId` as an `input` field, trusting whatever the client's own request body said — any staff member with `applications:update` could attribute a decision to an arbitrary `staff_id`, forging `decided_by` and the audit log. Fixed by deriving it from the verified JWT's `staffId` claim instead.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/functions/decide-application/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { decideApplication } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeApplication(
  supabase: ReturnType<typeof testClient>,
  organizationId: string,
  volunteerOverrides: Record<string, unknown> = {},
) {
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: crypto.randomUUID(),
    full_name: "Decide Test",
    email: `decide-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "male",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    institution: "Test Uni",
    degree_program: "BSCS",
    emergency_contact: { name: "Parent", phone: "0300-0000000", relation: "parent" },
    ...volunteerOverrides,
  }).select("id").single();

  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: organizationId,
    name: "Decide Test Opp",
    type: "event",
  }).select("id").single();

  const { data: application } = await supabase.from("applications").insert({
    volunteer_id: volunteer!.id,
    opportunity_id: opportunity!.id,
    organization_id: organizationId,
  }).select("id").single();

  return { applicationId: application!.id as string, volunteerId: volunteer!.id as string, opportunityId: opportunity!.id as string };
}

const staffClaims = (orgId: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["applications:update"] }],
});

Deno.test("decideApplication selecting an applicant auto-creates participation", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);

  const result = await decideApplication(supabase, staffClaims(orgId), {
    applicationId,
    decision: "selected",
  });

  assertEquals(result.participationId !== null, true);

  const { data: application } = await supabase.from("applications").select("status").eq("id", applicationId).single();
  assertEquals(application!.status, "selected");
});

Deno.test("decideApplication re-selecting an already-selected application does not create a duplicate participation row", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);

  const first = await decideApplication(supabase, staffClaims(orgId), {
    applicationId,
    decision: "selected",
  });

  const second = await decideApplication(supabase, staffClaims(orgId), {
    applicationId,
    decision: "selected",
  });

  assertEquals(second.participationId, first.participationId);

  const { data: rows } = await supabase.from("participation").select("id").eq("application_id", applicationId);
  assertEquals(rows?.length, 1);
});

Deno.test("decideApplication rejects selecting an applicant with no emergency_contact on file", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId, { emergency_contact: null });

  await assertRejects(
    () =>
      decideApplication(supabase, staffClaims(orgId), {
        applicationId,
        decision: "selected",
      }),
    Error,
    "emergency_contact_required",
  );
});

Deno.test("decideApplication accepts waitlisted as a decision without creating participation", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);

  const result = await decideApplication(supabase, staffClaims(orgId), {
    applicationId,
    decision: "waitlisted",
  });

  assertEquals(result.participationId, null);
  const { data: application } = await supabase.from("applications").select("status").eq("id", applicationId).single();
  assertEquals(application!.status, "waitlisted");
});

Deno.test("decideApplication rejects when staff lacks applications:update for the application's org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);

  await assertRejects(
    () =>
      decideApplication(supabase, staffClaims(otherOrgId), {
        applicationId,
        decision: "selected",
      }),
    Error,
    "forbidden",
  );
});

Deno.test("decideApplication writes an admin_action_log entry and applications.decided_by using the caller's own staffId from the token, never a client-supplied value", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);
  const realStaffId = crypto.randomUUID();

  // Regression test: the input object below deliberately has no `staffId` field
  // at all — DecideApplicationInput no longer has one. If a future change
  // reintroduces trusting a client-supplied staffId, TypeScript would need a
  // field here that doesn't exist on the type, and this test would need updating
  // to actually pass one through to prove the spoof — it should not compile as-is.
  await decideApplication(supabase, staffClaims(orgId, realStaffId), {
    applicationId,
    decision: "rejected",
  });

  const { data: application } = await supabase.from("applications").select("decided_by").eq("id", applicationId).single();
  assertEquals(application!.decided_by, realStaffId);

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", applicationId)
    .eq("action", "application_decided");

  assertEquals(logRows?.length, 1);
  assertEquals(logRows![0].staff_id, realStaffId);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/decide-application/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [x] **Step 3: Write the implementation**

Create `backend/supabase/functions/decide-application/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface DecideApplicationInput {
  applicationId: string;
  decision: "selected" | "waitlisted" | "rejected" | "under_review";
}

export interface DecideApplicationResult {
  applicationId: string;
  participationId: string | null;
}

export async function decideApplication(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: DecideApplicationInput,
): Promise<DecideApplicationResult> {
  const { data: application, error: fetchError } = await supabase
    .from("applications")
    .select("id, volunteer_id, opportunity_id, organization_id")
    .eq("id", input.applicationId)
    .single();
  if (fetchError) throw fetchError;

  if (!staffHasPermission(staffClaims, application.organization_id, "vms", "applications:update")) {
    throw new Error("forbidden");
  }

  if (input.decision === "selected") {
    const { data: volunteer, error: volunteerError } = await supabase
      .from("volunteers")
      .select("emergency_contact")
      .eq("id", application.volunteer_id)
      .single();
    if (volunteerError) throw volunteerError;
    if (!volunteer.emergency_contact) {
      throw new Error("emergency_contact_required");
    }
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: input.decision, decided_at: new Date().toISOString(), decided_by: staffClaims.staffId })
    .eq("id", input.applicationId);
  if (updateError) throw updateError;

  let participationId: string | null = null;

  if (input.decision === "selected") {
    const { data: existingParticipation, error: existingError } = await supabase
      .from("participation")
      .select("id")
      .eq("application_id", application.id)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingParticipation) {
      // Idempotent: re-deciding an already-selected application (double-click,
      // client retry) must not create a second participation row for it — the
      // migration's partial unique index on participation.application_id
      // (Task 6) backstops this at the DB level too.
      participationId = existingParticipation.id;
    } else {
      const { data: participation, error: participationError } = await supabase
        .from("participation")
        .insert({
          application_id: application.id,
          volunteer_id: application.volunteer_id,
          opportunity_id: application.opportunity_id,
          organization_id: application.organization_id,
        })
        .select("id")
        .single();
      if (participationError) throw participationError;
      participationId = participation.id;
    }

    await supabase.rpc("touch_org_volunteer_index", {
      p_org_id: application.organization_id,
      p_volunteer_id: application.volunteer_id,
    });
  }

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "application_decided",
    target_type: "application",
    target_id: input.applicationId,
    organization_id: application.organization_id,
    metadata: { decision: input.decision },
  });

  return { applicationId: input.applicationId, participationId };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/decide-application/handler.test.ts`
Expected: PASS on all 6 tests.

- [x] **Step 5: Write the HTTP wrapper**

Create `backend/supabase/functions/decide-application/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { decideApplication } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await decideApplication(supabase, claims, input);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [x] **Step 6: Commit**

```bash
git add backend/supabase/functions/decide-application/
git commit -m "feat(backend): add decide-application Edge Function with waitlisting and emergency-contact gating"
```

---

### Task 17: `submit-hours` and `verify-hours` Edge Functions

**Files:**
- Create: `backend/supabase/functions/submit-hours/handler.ts`
- Create: `backend/supabase/functions/submit-hours/handler.test.ts`
- Create: `backend/supabase/functions/submit-hours/index.ts`
- Create: `backend/supabase/functions/verify-hours/handler.ts`
- Create: `backend/supabase/functions/verify-hours/handler.test.ts`
- Create: `backend/supabase/functions/verify-hours/index.ts`

**Interfaces:**
- Produces: `submitHours(supabase, input: { participationId, volunteerId, opportunityId, organizationId, activityDate, hoursSubmitted, role?, location? }): Promise<{ activityHoursId: string }>` (volunteer-driven, no staff permission check) and `verifyHours(supabase, staffClaims, input: { activityHoursId, decision: "verified" | "rejected", hoursVerified?, rejectionReason? }): Promise<{ activityHoursId: string }>` — requires `hours:update` for the row's org. `activity_hours.verified_by` and `admin_action_log.staff_id` are set from `staffClaims.staffId` (Task 12), not a client-supplied `staffId` input field.

- [x] **Step 1: Write the failing tests**

Create `backend/supabase/functions/submit-hours/handler.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { submitHours } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function makeParticipation(supabase: ReturnType<typeof testClient>) {
  const orgId = crypto.randomUUID();
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: crypto.randomUUID(),
    full_name: "Hours Handler Test",
    email: `hours-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "male",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    institution: "Test Uni",
    degree_program: "BSCS",
  }).select("id").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Hours Test Opp", type: "event",
  }).select("id").single();
  const { data: participation } = await supabase.from("participation").insert({
    volunteer_id: volunteer!.id, opportunity_id: opportunity!.id, organization_id: orgId,
  }).select("id").single();

  return { participationId: participation!.id as string, volunteerId: volunteer!.id as string, opportunityId: opportunity!.id as string, orgId };
}

Deno.test("submitHours creates a recorded activity_hours row", async () => {
  const supabase = testClient();
  const { participationId, volunteerId, opportunityId, orgId } = await makeParticipation(supabase);

  const result = await submitHours(supabase, {
    participationId, volunteerId, opportunityId, organizationId: orgId,
    activityDate: "2026-08-01", hoursSubmitted: 3,
  });

  const { data: row } = await supabase.from("activity_hours").select("verification_status").eq("id", result.activityHoursId).single();
  assertEquals(row!.verification_status, "recorded");
});
```

Create `backend/supabase/functions/verify-hours/handler.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { verifyHours } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function makeActivityHours(supabase: ReturnType<typeof testClient>) {
  const orgId = crypto.randomUUID();
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: crypto.randomUUID(),
    full_name: "Verify Hours Test",
    email: `verify-hours-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "male",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    institution: "Test Uni",
    degree_program: "BSCS",
  }).select("id").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Verify Test Opp", type: "event",
  }).select("id").single();
  const { data: participation } = await supabase.from("participation").insert({
    volunteer_id: volunteer!.id, opportunity_id: opportunity!.id, organization_id: orgId,
  }).select("id").single();
  const { data: hours } = await supabase.from("activity_hours").insert({
    participation_id: participation!.id, volunteer_id: volunteer!.id, opportunity_id: opportunity!.id,
    organization_id: orgId, activity_date: "2026-08-01", hours_submitted: 5,
  }).select("id").single();

  return { activityHoursId: hours!.id as string, orgId };
}

const staffClaims = (orgId: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["hours:update"] }],
});

Deno.test("verifyHours verifying sets hours_verified and status", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase);

  await verifyHours(supabase, staffClaims(orgId), {
    activityHoursId, decision: "verified", hoursVerified: 5,
  });

  const { data: row } = await supabase.from("activity_hours").select("verification_status, hours_verified").eq("id", activityHoursId).single();
  assertEquals(row!.verification_status, "verified");
  assertEquals(row!.hours_verified, 5);
});

Deno.test("verifyHours rejecting retains the row with a reason", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase);

  await verifyHours(supabase, staffClaims(orgId), {
    activityHoursId, decision: "rejected", rejectionReason: "No proof of attendance",
  });

  const { data: row } = await supabase.from("activity_hours").select("verification_status, rejection_reason").eq("id", activityHoursId).single();
  assertEquals(row!.verification_status, "rejected");
  assertEquals(row!.rejection_reason, "No proof of attendance");
});

Deno.test("verifyHours sets verified_by and admin_action_log.staff_id from the caller's own staffId, never a client-supplied value", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase);
  const realStaffId = crypto.randomUUID();

  await verifyHours(supabase, staffClaims(orgId, realStaffId), {
    activityHoursId, decision: "verified", hoursVerified: 5,
  });

  const { data: row } = await supabase.from("activity_hours").select("verified_by").eq("id", activityHoursId).single();
  assertEquals(row!.verified_by, realStaffId);

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("staff_id")
    .eq("target_id", activityHoursId)
    .eq("action", "hours_decided");
  assertEquals(logRows![0].staff_id, realStaffId);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/submit-hours/handler.test.ts functions/verify-hours/handler.test.ts`
Expected: FAIL — handlers do not exist.

- [x] **Step 3: Write the implementations**

Create `backend/supabase/functions/submit-hours/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export interface SubmitHoursInput {
  participationId: string;
  volunteerId: string;
  opportunityId: string;
  organizationId: string;
  activityDate: string;
  hoursSubmitted: number;
  role?: string;
  location?: string;
}

export interface SubmitHoursResult {
  activityHoursId: string;
}

export async function submitHours(
  supabase: SupabaseClient,
  input: SubmitHoursInput,
): Promise<SubmitHoursResult> {
  const { data, error } = await supabase
    .from("activity_hours")
    .insert({
      participation_id: input.participationId,
      volunteer_id: input.volunteerId,
      opportunity_id: input.opportunityId,
      organization_id: input.organizationId,
      activity_date: input.activityDate,
      hours_submitted: input.hoursSubmitted,
      role: input.role ?? null,
      location: input.location ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { activityHoursId: data.id };
}
```

Create `backend/supabase/functions/verify-hours/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface VerifyHoursInput {
  activityHoursId: string;
  decision: "verified" | "rejected";
  hoursVerified?: number;
  rejectionReason?: string;
}

export interface VerifyHoursResult {
  activityHoursId: string;
}

export async function verifyHours(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: VerifyHoursInput,
): Promise<VerifyHoursResult> {
  const { data: row, error: fetchError } = await supabase
    .from("activity_hours")
    .select("id, organization_id")
    .eq("id", input.activityHoursId)
    .single();
  if (fetchError) throw fetchError;

  if (!staffHasPermission(staffClaims, row.organization_id, "vms", "hours:update")) {
    throw new Error("forbidden");
  }

  const { error: updateError } = await supabase
    .from("activity_hours")
    .update({
      verification_status: input.decision,
      hours_verified: input.decision === "verified" ? input.hoursVerified ?? null : null,
      rejection_reason: input.decision === "rejected" ? input.rejectionReason ?? null : null,
      verified_by: staffClaims.staffId,
      verified_at: new Date().toISOString(),
    })
    .eq("id", input.activityHoursId);
  if (updateError) throw updateError;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "hours_decided",
    target_type: "activity_hours",
    target_id: input.activityHoursId,
    organization_id: row.organization_id,
    metadata: { decision: input.decision },
  });

  return { activityHoursId: input.activityHoursId };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/submit-hours/handler.test.ts functions/verify-hours/handler.test.ts`
Expected: PASS on all tests.

- [x] **Step 5: Write the HTTP wrappers**

Create `backend/supabase/functions/submit-hours/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { submitHours } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await submitHours(supabase, input);
    return new Response(JSON.stringify(result), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
});
```

Create `backend/supabase/functions/verify-hours/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { verifyHours } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await verifyHours(supabase, claims, input);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [x] **Step 6: Commit**

```bash
git add backend/supabase/functions/submit-hours/ backend/supabase/functions/verify-hours/
git commit -m "feat(backend): add submit-hours and verify-hours Edge Functions"
```

---

### Task 18: `bulk-assign-hours` Edge Function

**Files:**
- Create: `backend/supabase/functions/bulk-assign-hours/handler.ts`
- Create: `backend/supabase/functions/bulk-assign-hours/handler.test.ts`
- Create: `backend/supabase/functions/bulk-assign-hours/index.ts`

**Interfaces:**
- Consumes: `submitHours()` pattern from Task 17 (reuses the same insert shape for each participant).
- Produces: `bulkAssignHours(supabase, staffClaims, input: { organizationId: string; opportunityId: string; activityDate: string; hoursSubmitted: number; participationIds: string[] }): Promise<{ createdCount: number }>`. Requires `hours:write` for the org — this creates new `activity_hours` rows (the `write` action), unlike `verifyHours()`'s `hours:update` on existing ones. `admin_action_log.staff_id` comes from `staffClaims.staffId` (Task 12), not a client-supplied `staffId` field.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/functions/bulk-assign-hours/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { bulkAssignHours } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function makeParticipants(supabase: ReturnType<typeof testClient>, orgId: string, opportunityId: string, count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const { data: volunteer } = await supabase.from("volunteers").insert({
      auth_user_id: crypto.randomUUID(),
      full_name: `Bulk Test ${i}`,
      email: `bulk-${crypto.randomUUID()}@example.com`,
      phone: `0300-${Math.floor(Math.random() * 10000000)}`,
      dob: "1999-01-01", gender: "male", city: "Lahore", province: "Punjab", country: "Pakistan",
      institution: "Test Uni", degree_program: "BSCS",
    }).select("id").single();
    const { data: participation } = await supabase.from("participation").insert({
      volunteer_id: volunteer!.id, opportunity_id: opportunityId, organization_id: orgId,
    }).select("id").single();
    ids.push(participation!.id as string);
  }
  return ids;
}

const staffClaims = (orgId: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["hours:write"] }],
});

Deno.test("bulkAssignHours creates one activity_hours row per participant", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Bulk Opp", type: "event",
  }).select("id").single();
  const participationIds = await makeParticipants(supabase, orgId, opportunity!.id, 3);

  const result = await bulkAssignHours(supabase, staffClaims(orgId), {
    organizationId: orgId, opportunityId: opportunity!.id, activityDate: "2026-08-01",
    hoursSubmitted: 4, participationIds,
  });

  assertEquals(result.createdCount, 3);
});

Deno.test("bulkAssignHours rejects staff without hours:write in the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Bulk Opp 2", type: "event",
  }).select("id").single();
  const participationIds = await makeParticipants(supabase, orgId, opportunity!.id, 1);

  await assertRejects(
    () =>
      bulkAssignHours(supabase, staffClaims(otherOrgId), {
        organizationId: orgId, opportunityId: opportunity!.id, activityDate: "2026-08-01",
        hoursSubmitted: 4, participationIds,
      }),
    Error,
    "forbidden",
  );
});

Deno.test("bulkAssignHours attributes admin_action_log to the caller's own staffId, never a client-supplied value", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const realStaffId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Bulk Opp 3", type: "event",
  }).select("id").single();
  const participationIds = await makeParticipants(supabase, orgId, opportunity!.id, 1);

  await bulkAssignHours(supabase, staffClaims(orgId, realStaffId), {
    organizationId: orgId, opportunityId: opportunity!.id, activityDate: "2026-08-01",
    hoursSubmitted: 4, participationIds,
  });

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("staff_id")
    .eq("target_id", opportunity!.id)
    .eq("action", "bulk_hours_assigned");
  assertEquals(logRows![0].staff_id, realStaffId);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/bulk-assign-hours/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [x] **Step 3: Write the implementation**

Create `backend/supabase/functions/bulk-assign-hours/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface BulkAssignHoursInput {
  organizationId: string;
  opportunityId: string;
  activityDate: string;
  hoursSubmitted: number;
  participationIds: string[];
}

export interface BulkAssignHoursResult {
  createdCount: number;
}

export async function bulkAssignHours(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: BulkAssignHoursInput,
): Promise<BulkAssignHoursResult> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "hours:write")) {
    throw new Error("forbidden");
  }

  const { data: participations, error: fetchError } = await supabase
    .from("participation")
    .select("id, volunteer_id")
    .in("id", input.participationIds);
  if (fetchError) throw fetchError;

  const rows = (participations ?? []).map((p) => ({
    participation_id: p.id,
    volunteer_id: p.volunteer_id,
    opportunity_id: input.opportunityId,
    organization_id: input.organizationId,
    activity_date: input.activityDate,
    hours_submitted: input.hoursSubmitted,
  }));

  const { error: insertError } = await supabase.from("activity_hours").insert(rows);
  if (insertError) throw insertError;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "bulk_hours_assigned",
    target_type: "opportunity",
    target_id: input.opportunityId,
    organization_id: input.organizationId,
    metadata: { participation_count: rows.length },
  });

  return { createdCount: rows.length };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/bulk-assign-hours/handler.test.ts`
Expected: PASS on all 3 tests.

- [x] **Step 5: Write the HTTP wrapper**

Create `backend/supabase/functions/bulk-assign-hours/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { bulkAssignHours } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await bulkAssignHours(supabase, claims, input);
    return new Response(JSON.stringify(result), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [x] **Step 6: Commit**

```bash
git add backend/supabase/functions/bulk-assign-hours/
git commit -m "feat(backend): add bulk-assign-hours Edge Function"
```

---

### Task 19: `upload-cnic-document` Edge Function

**Files:**
- Create: `backend/supabase/functions/upload-cnic-document/handler.ts`
- Create: `backend/supabase/functions/upload-cnic-document/handler.test.ts`
- Create: `backend/supabase/functions/upload-cnic-document/index.ts`

**Interfaces:**
- Produces: `createCnicUploadUrl(r2Client: R2Client, volunteerId: string): Promise<{ uploadUrl: string; objectKey: string }>` and `getCnicReadUrl(r2Client: R2Client, objectKey: string): Promise<{ readUrl: string }>`. `R2Client` is a small interface (`putSignedUrl`, `getSignedUrl`) so the handler is testable with a fake, without a real R2 bucket.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/functions/upload-cnic-document/handler.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createCnicUploadUrl, getCnicReadUrl, R2Client } from "./handler.ts";

class FakeR2Client implements R2Client {
  async putSignedUrl(key: string): Promise<string> {
    return `https://fake-r2/put/${key}`;
  }
  async getSignedUrl(key: string): Promise<string> {
    return `https://fake-r2/get/${key}`;
  }
}

Deno.test("createCnicUploadUrl returns a per-volunteer object key and signed URL", async () => {
  const r2 = new FakeR2Client();
  const result = await createCnicUploadUrl(r2, "volunteer-123");
  assertEquals(result.objectKey.startsWith("cnic/volunteer-123/"), true);
  assertEquals(result.uploadUrl.startsWith("https://fake-r2/put/"), true);
});

Deno.test("getCnicReadUrl returns a signed read URL for a given key", async () => {
  const r2 = new FakeR2Client();
  const result = await getCnicReadUrl(r2, "cnic/volunteer-123/abc.jpg");
  assertEquals(result.readUrl, "https://fake-r2/get/cnic/volunteer-123/abc.jpg");
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/upload-cnic-document/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [x] **Step 3: Write the implementation**

Create `backend/supabase/functions/upload-cnic-document/handler.ts`:

```typescript
export interface R2Client {
  putSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

export interface CreateCnicUploadUrlResult {
  uploadUrl: string;
  objectKey: string;
}

export interface GetCnicReadUrlResult {
  readUrl: string;
}

export async function createCnicUploadUrl(
  r2Client: R2Client,
  volunteerId: string,
): Promise<CreateCnicUploadUrlResult> {
  const objectKey = `cnic/${volunteerId}/${crypto.randomUUID()}`;
  const uploadUrl = await r2Client.putSignedUrl(objectKey, 900);
  return { uploadUrl, objectKey };
}

export async function getCnicReadUrl(
  r2Client: R2Client,
  objectKey: string,
): Promise<GetCnicReadUrlResult> {
  const readUrl = await r2Client.getSignedUrl(objectKey, 300);
  return { readUrl };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/upload-cnic-document/handler.test.ts`
Expected: PASS on both tests.

- [x] **Step 5: Write the HTTP wrapper**

Create `backend/supabase/functions/upload-cnic-document/index.ts`:

```typescript
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18";
import { createCnicUploadUrl, getCnicReadUrl, R2Client } from "./handler.ts";

function buildR2Client(): R2Client {
  const client = new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  });
  const bucketUrl = Deno.env.get("R2_BUCKET_URL")!;

  return {
    async putSignedUrl(key, expiresInSeconds = 900) {
      const url = new URL(`${bucketUrl}/${key}`);
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      const signed = await client.sign(new Request(url, { method: "PUT" }), { aws: { signQuery: true } });
      return signed.url;
    },
    async getSignedUrl(key, expiresInSeconds = 300) {
      const url = new URL(`${bucketUrl}/${key}`);
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      const signed = await client.sign(new Request(url, { method: "GET" }), { aws: { signQuery: true } });
      return signed.url;
    },
  };
}

Deno.serve(async (req) => {
  try {
    const { action, volunteerId, objectKey } = await req.json();
    const r2Client = buildR2Client();

    if (action === "upload") {
      const result = await createCnicUploadUrl(r2Client, volunteerId);
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (action === "read") {
      const result = await getCnicReadUrl(r2Client, objectKey);
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unknown_action" }), { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
});
```

- [x] **Step 6: Commit**

```bash
git add backend/supabase/functions/upload-cnic-document/
git commit -m "feat(backend): add upload-cnic-document Edge Function with R2 signed URLs"
```

---

### Task 20: `update-sensitive-field` Edge Function

**Files:**
- Create: `backend/supabase/functions/update-sensitive-field/handler.ts`
- Create: `backend/supabase/functions/update-sensitive-field/handler.test.ts`
- Create: `backend/supabase/functions/update-sensitive-field/index.ts`

**Interfaces:**
- Produces: `updateSensitiveField(supabase, input: { volunteerId: string; fieldName: "dob" | "cnic_number" | "phone" | "emergency_contact" | "guardian_name" | "guardian_contact"; newValue: string }): Promise<{ volunteerId: string }>` — this is the single write path the frontend (Task in Plan 2) calls for any edit to these fields.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/functions/update-sensitive-field/handler.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateSensitiveField } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>) {
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: crypto.randomUUID(),
    full_name: "Sensitive Field Test",
    email: `sensitive-${crypto.randomUUID()}@example.com`,
    phone: "0300-1230000",
    dob: "1999-01-01",
    gender: "male", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "Test Uni", degree_program: "BSCS",
  }).select("id, phone").single();
  return data!;
}

Deno.test("updateSensitiveField updates the volunteer row and logs the change", async () => {
  const supabase = testClient();
  const volunteer = await makeVolunteer(supabase);

  await updateSensitiveField(supabase, {
    volunteerId: volunteer.id, fieldName: "phone", newValue: "0300-9998888",
  });

  const { data: updated } = await supabase.from("volunteers").select("phone").eq("id", volunteer.id).single();
  assertEquals(updated!.phone, "0300-9998888");

  const { data: logRows } = await supabase
    .from("profile_field_changes")
    .select("old_value, new_value")
    .eq("volunteer_id", volunteer.id)
    .eq("field_name", "phone");

  assertEquals(logRows?.length, 1);
  assertEquals(logRows![0].old_value, "0300-1230000");
  assertEquals(logRows![0].new_value, "0300-9998888");
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/update-sensitive-field/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [x] **Step 3: Write the implementation**

Create `backend/supabase/functions/update-sensitive-field/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export type SensitiveFieldName = "dob" | "cnic_number" | "phone" | "emergency_contact" | "guardian_name" | "guardian_contact";

export interface UpdateSensitiveFieldInput {
  volunteerId: string;
  fieldName: SensitiveFieldName;
  newValue: string;
}

export interface UpdateSensitiveFieldResult {
  volunteerId: string;
}

export async function updateSensitiveField(
  supabase: SupabaseClient,
  input: UpdateSensitiveFieldInput,
): Promise<UpdateSensitiveFieldResult> {
  const { data: volunteer, error: fetchError } = await supabase
    .from("volunteers")
    .select(input.fieldName)
    .eq("id", input.volunteerId)
    .single();
  if (fetchError) throw fetchError;

  const oldValue = String((volunteer as Record<string, unknown>)[input.fieldName] ?? "");

  const { error: updateError } = await supabase
    .from("volunteers")
    .update({ [input.fieldName]: input.newValue })
    .eq("id", input.volunteerId);
  if (updateError) throw updateError;

  const { error: logError } = await supabase.from("profile_field_changes").insert({
    volunteer_id: input.volunteerId,
    field_name: input.fieldName,
    old_value: oldValue,
    new_value: input.newValue,
  });
  if (logError) throw logError;

  return { volunteerId: input.volunteerId };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/update-sensitive-field/handler.test.ts`
Expected: PASS.

- [x] **Step 5: Write the HTTP wrapper**

Create `backend/supabase/functions/update-sensitive-field/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { updateSensitiveField } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await updateSensitiveField(supabase, input);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
});
```

- [x] **Step 6: Commit**

```bash
git add backend/supabase/functions/update-sensitive-field/
git commit -m "feat(backend): add update-sensitive-field Edge Function with change logging"
```

---

### Task 21: `export-csv` Edge Function

**Files:**
- Create: `backend/supabase/functions/export-csv/handler.ts`
- Create: `backend/supabase/functions/export-csv/handler.test.ts`
- Create: `backend/supabase/functions/export-csv/index.ts`

**Interfaces:**
- Produces: `exportApplicationsCsv(supabase, staffClaims, organizationId: string): Promise<string>` — returns CSV text (volunteer_code, full_name, email, opportunity name, status, applied_at). Requires `applications:read` for the org. Also produces `exportVolunteersCsv(supabase, staffClaims, organizationId: string): Promise<string>` — returns CSV text (volunteer_code, full_name, email, phone, city, province, institution, status) for every volunteer with an `org_volunteer_index` link to the org. Requires `volunteers:read` for the org. Platform-design.md §6 lists volunteer-list export as needing "the same treatment" as the applications/opportunity/hours exports already scoped here — this closes that gap.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/functions/export-csv/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { exportApplicationsCsv, exportVolunteersCsv } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const staffClaims = (orgId: string): StaffClaims => ({
  actorType: "staff",
  staffId: crypto.randomUUID(),
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["applications:read"] }],
});

Deno.test("exportApplicationsCsv includes a header row and one row per application", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: crypto.randomUUID(), full_name: "CSV Test", email: `csv-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`, dob: "1999-01-01", gender: "male",
    city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Test Uni", degree_program: "BSCS",
  }).select("id, volunteer_code").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "CSV Opp", type: "event",
  }).select("id, name").single();
  await supabase.from("applications").insert({
    volunteer_id: volunteer!.id, opportunity_id: opportunity!.id, organization_id: orgId,
  });

  const csv = await exportApplicationsCsv(supabase, staffClaims(orgId), orgId);
  const lines = csv.trim().split("\n");

  assertEquals(lines[0], "volunteer_code,full_name,email,opportunity_name,status,applied_at");
  assertEquals(lines.length, 2);
  assertEquals(lines[1].includes(volunteer!.volunteer_code), true);
});

Deno.test("exportApplicationsCsv rejects staff without applications:read for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();

  await assertRejects(() => exportApplicationsCsv(supabase, staffClaims(otherOrgId), orgId), Error, "forbidden");
});

const volunteersReadClaims = (orgId: string): StaffClaims => ({
  actorType: "staff",
  staffId: crypto.randomUUID(),
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["volunteers:read"] }],
});

Deno.test("exportVolunteersCsv includes a header row and one row per volunteer linked to the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: crypto.randomUUID(), full_name: "CSV Volunteer Test", email: `csv-vol-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`, dob: "1999-01-01", gender: "male",
    city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Test Uni", degree_program: "BSCS",
  }).select("id, volunteer_code").single();
  await supabase.rpc("touch_org_volunteer_index", { p_org_id: orgId, p_volunteer_id: volunteer!.id });

  const csv = await exportVolunteersCsv(supabase, volunteersReadClaims(orgId), orgId);
  const lines = csv.trim().split("\n");

  assertEquals(lines[0], "volunteer_code,full_name,email,phone,city,province,institution,status");
  assertEquals(lines.length, 2);
  assertEquals(lines[1].includes(volunteer!.volunteer_code), true);
});

Deno.test("exportVolunteersCsv rejects staff without volunteers:read for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();

  await assertRejects(() => exportVolunteersCsv(supabase, volunteersReadClaims(otherOrgId), orgId), Error, "forbidden");
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/export-csv/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [x] **Step 3: Write the implementation**

Create `backend/supabase/functions/export-csv/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function exportApplicationsCsv(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  organizationId: string,
): Promise<string> {
  if (!staffHasPermission(staffClaims, organizationId, "vms", "applications:read")) {
    throw new Error("forbidden");
  }

  const { data: rows, error } = await supabase
    .from("applications")
    .select("status, applied_at, volunteers(volunteer_code, full_name, email), opportunities(name)")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const header = "volunteer_code,full_name,email,opportunity_name,status,applied_at";
  const lines = (rows ?? []).map((r: Record<string, unknown>) => {
    const volunteer = r.volunteers as { volunteer_code: string; full_name: string; email: string };
    const opportunity = r.opportunities as { name: string };
    return [
      csvEscape(volunteer.volunteer_code),
      csvEscape(volunteer.full_name),
      csvEscape(volunteer.email),
      csvEscape(opportunity.name),
      csvEscape(String(r.status)),
      csvEscape(String(r.applied_at)),
    ].join(",");
  });

  return [header, ...lines].join("\n") + "\n";
}

export async function exportVolunteersCsv(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  organizationId: string,
): Promise<string> {
  if (!staffHasPermission(staffClaims, organizationId, "vms", "volunteers:read")) {
    throw new Error("forbidden");
  }

  const { data: rows, error } = await supabase
    .from("org_volunteer_index")
    .select("volunteers(volunteer_code, full_name, email, phone, city, province, institution, status)")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const header = "volunteer_code,full_name,email,phone,city,province,institution,status";
  const lines = (rows ?? []).map((r: Record<string, unknown>) => {
    const v = r.volunteers as {
      volunteer_code: string; full_name: string; email: string; phone: string;
      city: string; province: string; institution: string; status: string;
    };
    return [
      csvEscape(v.volunteer_code),
      csvEscape(v.full_name),
      csvEscape(v.email),
      csvEscape(v.phone),
      csvEscape(v.city),
      csvEscape(v.province),
      csvEscape(v.institution),
      csvEscape(v.status),
    ].join(",");
  });

  return [header, ...lines].join("\n") + "\n";
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/export-csv/handler.test.ts`
Expected: PASS on all 4 tests.

- [x] **Step 5: Write the HTTP wrapper**

Create `backend/supabase/functions/export-csv/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { exportApplicationsCsv, exportVolunteersCsv } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const { organizationId, entity } = await req.json();

    const csv = entity === "volunteers"
      ? await exportVolunteersCsv(supabase, claims, organizationId)
      : await exportApplicationsCsv(supabase, claims, organizationId);

    return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

`entity` defaults to `"applications"` when omitted, matching the shape `platform`'s admin hub already expects for the applications export; `entity: "volunteers"` is the new addition covering platform-design.md §6's volunteer-list export requirement.

- [x] **Step 6: Commit**

```bash
git add backend/supabase/functions/export-csv/
git commit -m "feat(backend): add export-csv Edge Function"
```

---

### Task 22: Status-change email notifications (Resend)

**Files:**
- Create: `backend/supabase/functions/_shared/sendEmail.ts`
- Create: `backend/supabase/functions/_shared/sendEmail.test.ts`
- Modify: `backend/supabase/functions/decide-application/handler.ts`
- Modify: `backend/supabase/functions/decide-application/handler.test.ts`
- Modify: `backend/supabase/functions/decide-application/index.ts`
- Modify: `backend/supabase/functions/verify-hours/handler.ts`
- Modify: `backend/supabase/functions/verify-hours/handler.test.ts`
- Modify: `backend/supabase/functions/verify-hours/index.ts`

**Interfaces:**
- Produces: `EmailClient = { send(to: string, subject: string, html: string): Promise<void> }`, `getResendEmailClient(): EmailClient`.
- Consumes into: `decideApplication()` and `verifyHours()` gain a required `emailClient: EmailClient` parameter (spec §4: both "trigger a status-change email"; spec §6: Resend is the provider).

- [x] **Step 1: Write the failing test for the shared email module**

Create `backend/supabase/functions/_shared/sendEmail.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getResendEmailClient } from "./sendEmail.ts";

Deno.test("getResendEmailClient sends via the Resend API", async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    return Promise.resolve(new Response(JSON.stringify({ id: "test" }), { status: 200 }));
  }) as typeof fetch;

  try {
    Deno.env.set("RESEND_API_KEY", "test-key");
    Deno.env.set("EMAIL_FROM_ADDRESS", "no-reply@example.org");
    const client = getResendEmailClient();
    await client.send("volunteer@example.com", "Application update", "<p>Selected!</p>");

    assertEquals(calls.length, 1);
    assertEquals(calls[0].url, "https://api.resend.com/emails");
    assertEquals((calls[0].body as Record<string, unknown>).to, "volunteer@example.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/_shared/sendEmail.test.ts`
Expected: FAIL — `sendEmail.ts` does not exist.

- [x] **Step 3: Write the shared email module**

Create `backend/supabase/functions/_shared/sendEmail.ts`:

```typescript
export interface EmailClient {
  send(to: string, subject: string, html: string): Promise<void>;
}

export function getResendEmailClient(): EmailClient {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM_ADDRESS");
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM_ADDRESS must be set");
  }

  return {
    async send(to: string, subject: string, html: string): Promise<void> {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (!response.ok) {
        throw new Error(`resend_send_failed: ${response.status}`);
      }
    },
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/_shared/sendEmail.test.ts`
Expected: PASS.

- [x] **Step 5: Write the failing tests for email-on-decision behavior**

Modify `backend/supabase/functions/decide-application/handler.test.ts` — add a fake email client and a new test, and update every existing `decideApplication(supabase, staffClaims(...), {...})` call to pass it as a fourth argument:

```typescript
// Add near the top, after the existing imports:
import type { EmailClient } from "../_shared/sendEmail.ts";

class FakeEmailClient implements EmailClient {
  sent: Array<{ to: string; subject: string; html: string }> = [];
  async send(to: string, subject: string, html: string): Promise<void> {
    this.sent.push({ to, subject, html });
  }
}

// Update every call site in this file from:
//   decideApplication(supabase, staffClaims(orgId), { ... })
// to:
//   decideApplication(supabase, staffClaims(orgId), { ... }, new FakeEmailClient())

// Add a new test:
Deno.test("decideApplication sends a status-change email to the volunteer", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId, volunteerId } = await makeApplication(supabase, orgId);
  const { data: volunteer } = await supabase.from("volunteers").select("email").eq("id", volunteerId).single();
  const emailClient = new FakeEmailClient();

  await decideApplication(supabase, staffClaims(orgId), {
    applicationId, decision: "selected",
  }, emailClient);

  assertEquals(emailClient.sent.length, 1);
  assertEquals(emailClient.sent[0].to, volunteer!.email);
});
```

- [x] **Step 6: Run tests to verify the new one fails**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/decide-application/handler.test.ts`
Expected: FAIL — `decideApplication` does not yet accept or call an email client.

- [x] **Step 7: Update the implementation**

Modify `backend/supabase/functions/decide-application/handler.ts` — add the import and change the function signature and body:

```typescript
// Add to imports:
import type { EmailClient } from "../_shared/sendEmail.ts";

// Change the function signature from:
//   export async function decideApplication(
//     supabase: SupabaseClient,
//     staffClaims: StaffClaims,
//     input: DecideApplicationInput,
//   ): Promise<DecideApplicationResult> {
// to:
export async function decideApplication(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: DecideApplicationInput,
  emailClient: EmailClient,
): Promise<DecideApplicationResult> {
```

Add, immediately before the final `return { applicationId: input.applicationId, participationId };` line:

```typescript
  const { data: volunteer } = await supabase
    .from("volunteers")
    .select("email, full_name")
    .eq("id", application.volunteer_id)
    .single();

  if (volunteer) {
    const subject = "Your application status has been updated";
    const html = `<p>Hi ${volunteer.full_name},</p><p>Your application status is now: <strong>${input.decision}</strong>.</p>`;
    await emailClient.send(volunteer.email, subject, html);
  }
```

- [x] **Step 8: Run tests to verify they pass**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/decide-application/handler.test.ts`
Expected: PASS on all 7 tests.

- [x] **Step 9: Wire the real email client into the HTTP wrapper**

Modify `backend/supabase/functions/decide-application/index.ts` — add the import and pass the client through:

```typescript
// Add to imports:
import { getResendEmailClient } from "../_shared/sendEmail.ts";

// Change:
//   const result = await decideApplication(supabase, claims, input);
// to:
const result = await decideApplication(supabase, claims, input, getResendEmailClient());
```

- [x] **Step 10: Repeat the same pattern for `verify-hours`**

Modify `backend/supabase/functions/verify-hours/handler.test.ts` the same way: import `EmailClient` and `FakeEmailClient` (same shape as above), pass `new FakeEmailClient()` as a fourth argument to every `verifyHours(...)` call, and add:

```typescript
Deno.test("verifyHours sends a status-change email to the volunteer", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase);
  const emailClient = new FakeEmailClient();

  await verifyHours(supabase, staffClaims(orgId), {
    activityHoursId, decision: "verified", hoursVerified: 5,
  }, emailClient);

  assertEquals(emailClient.sent.length, 1);
});
```

Modify `backend/supabase/functions/verify-hours/handler.ts`: add the `EmailClient` import, add `emailClient: EmailClient` as a fourth parameter to `verifyHours`, and before its final `return`, fetch the volunteer's email via `row`'s `volunteer_id` (extend the initial `select` to `"id, organization_id, volunteer_id"`) and send:

```typescript
  const { data: volunteer } = await supabase
    .from("volunteers")
    .select("email, full_name")
    .eq("id", row.volunteer_id)
    .single();

  if (volunteer) {
    const subject = "Your volunteer hours have been reviewed";
    const html = `<p>Hi ${volunteer.full_name},</p><p>Your submitted hours were <strong>${input.decision}</strong>.</p>`;
    await emailClient.send(volunteer.email, subject, html);
  }
```

Modify `backend/supabase/functions/verify-hours/index.ts` the same way as Step 9, importing `getResendEmailClient` and passing it as the fourth argument to `verifyHours`.

- [x] **Step 11: Run all affected tests**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/decide-application/handler.test.ts functions/verify-hours/handler.test.ts functions/_shared/sendEmail.test.ts`
Expected: PASS on all tests.

- [x] **Step 12: Commit**

```bash
git add backend/supabase/functions/_shared/sendEmail.ts backend/supabase/functions/_shared/sendEmail.test.ts backend/supabase/functions/decide-application/ backend/supabase/functions/verify-hours/
git commit -m "feat(backend): send status-change emails via Resend on decision and hours verification"
```

---

### Task 23: Close volunteer-identity IDOR gaps

**Files:**
- Create: `backend/supabase/functions/_shared/verifyVolunteerAuth.ts`
- Create: `backend/supabase/functions/_shared/verifyVolunteerAuth.test.ts`
- Modify: `backend/supabase/functions/register-volunteer/index.ts`
- Modify: `backend/supabase/functions/apply-to-opportunity/index.ts`
- Modify: `backend/supabase/functions/submit-hours/index.ts`
- Modify: `backend/supabase/functions/update-sensitive-field/index.ts`
- Modify: `backend/supabase/functions/upload-cnic-document/index.ts`

**Interfaces:**
- Produces: `verifyVolunteerAuthUser(supabase, authHeader): Promise<{ authUserId: string }>` and `verifyVolunteerToken(supabase, authHeader): Promise<{ volunteerId: string; authUserId: string }>`.
- Consumed by: every wrapper listed above, plus (in Plan 2) `frontend/lib/edgeFunctions.ts` — the frontend sends the volunteer's own Supabase session token and never sends `volunteerId`/`authUserId` in the request body, because these wrappers now ignore any client-supplied value for those fields and derive identity from the verified token instead.

Tasks 14, 15, 17, 19, and 20 as originally written accept `volunteerId`/`authUserId` straight from the parsed JSON body in their `index.ts` wrappers, and Task 19's "read" action has no auth check at all. That lets any caller act as an arbitrary volunteer or fetch any CNIC document. This task closes that gap without touching any `handler.ts` or its tests — only the HTTP wrappers change, since they're the trust boundary.

- [x] **Step 1: Write the failing tests**

Create `backend/supabase/functions/_shared/verifyVolunteerAuth.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyVolunteerAuthUser, verifyVolunteerToken } from "./verifyVolunteerAuth.ts";

function fakeSupabase(options: { user?: { id: string } | null; volunteer?: { id: string } | null }) {
  return {
    auth: {
      async getUser(_token: string) {
        return options.user
          ? { data: { user: options.user }, error: null }
          : { data: { user: null }, error: new Error("invalid token") };
      },
    },
    from(_table: string) {
      return {
        select(_columns: string) {
          return {
            eq(_column: string, _value: string) {
              return {
                async single() {
                  return options.volunteer
                    ? { data: options.volunteer, error: null }
                    : { data: null, error: new Error("not found") };
                },
              };
            },
          };
        },
      };
    },
  };
}

Deno.test("verifyVolunteerAuthUser returns the auth user id for a valid token", async () => {
  const supabase = fakeSupabase({ user: { id: "user-1" } });
  const result = await verifyVolunteerAuthUser(supabase as never, "Bearer good-token");
  assertEquals(result.authUserId, "user-1");
});

Deno.test("verifyVolunteerAuthUser rejects a missing header", async () => {
  const supabase = fakeSupabase({ user: null });
  await assertRejects(() => verifyVolunteerAuthUser(supabase as never, null), Error, "unauthorized");
});

Deno.test("verifyVolunteerToken resolves the volunteer row for the authenticated user", async () => {
  const supabase = fakeSupabase({ user: { id: "user-1" }, volunteer: { id: "vol-1" } });
  const result = await verifyVolunteerToken(supabase as never, "Bearer good-token");
  assertEquals(result.volunteerId, "vol-1");
  assertEquals(result.authUserId, "user-1");
});

Deno.test("verifyVolunteerToken rejects when no volunteer row exists yet for this auth user", async () => {
  const supabase = fakeSupabase({ user: { id: "user-1" }, volunteer: null });
  await assertRejects(() => verifyVolunteerToken(supabase as never, "Bearer good-token"), Error, "unauthorized");
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/_shared/verifyVolunteerAuth.test.ts`
Expected: FAIL — module does not exist.

- [x] **Step 3: Write the implementation**

Create `backend/supabase/functions/_shared/verifyVolunteerAuth.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export async function verifyVolunteerAuthUser(
  supabase: SupabaseClient,
  authHeader: string | null,
): Promise<{ authUserId: string }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("unauthorized");
  }
  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("unauthorized");
  }
  return { authUserId: data.user.id };
}

export async function verifyVolunteerToken(
  supabase: SupabaseClient,
  authHeader: string | null,
): Promise<{ volunteerId: string; authUserId: string }> {
  const { authUserId } = await verifyVolunteerAuthUser(supabase, authHeader);
  const { data: volunteer, error } = await supabase
    .from("volunteers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();
  if (error || !volunteer) {
    throw new Error("unauthorized");
  }
  return { volunteerId: volunteer.id, authUserId };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/_shared/verifyVolunteerAuth.test.ts`
Expected: PASS on all 4 tests.

- [x] **Step 5: Fix `register-volunteer/index.ts`**

Replace the file's contents with:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { verifyVolunteerAuthUser } from "../_shared/verifyVolunteerAuth.ts";
import { registerVolunteer } from "./handler.ts";

Deno.serve(async (req) => {
  const supabase = getAdminClient();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const allowed = await checkRateLimit(supabase, `register:${ip}`, 5, 3600);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
  }

  try {
    const { authUserId } = await verifyVolunteerAuthUser(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await registerVolunteer(supabase, { ...input, authUserId });
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "minor_consent_required" ? 422 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

The caller must sign up via Supabase Auth first (creating the session) and pass that session's access token — `register-volunteer` then creates the profile row for that exact authenticated user, never for an `authUserId` the client claims.

- [x] **Step 6: Fix `apply-to-opportunity/index.ts`**

Replace the file's contents with:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { applyToOpportunity } from "./handler.ts";

Deno.serve(async (req) => {
  const supabase = getAdminClient();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const allowed = await checkRateLimit(supabase, `apply:${ip}`, 20, 3600);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
  }

  try {
    const { volunteerId } = await verifyVolunteerToken(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await applyToOpportunity(supabase, { ...input, volunteerId });
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [x] **Step 7: Fix `submit-hours/index.ts`**

Replace the file's contents with:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { submitHours } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const { volunteerId } = await verifyVolunteerToken(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await submitHours(supabase, { ...input, volunteerId });
    return new Response(JSON.stringify(result), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [x] **Step 8: Fix `update-sensitive-field/index.ts`**

Replace the file's contents with:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { updateSensitiveField } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const { volunteerId } = await verifyVolunteerToken(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await updateSensitiveField(supabase, { ...input, volunteerId });
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [x] **Step 9: Fix `upload-cnic-document/index.ts`**

Replace the file's contents with:

```typescript
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { verifyStaffToken, staffHasPermission } from "../_shared/verifyStaffToken.ts";
import { createCnicUploadUrl, getCnicReadUrl, R2Client } from "./handler.ts";

function buildR2Client(): R2Client {
  const client = new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  });
  const bucketUrl = Deno.env.get("R2_BUCKET_URL")!;

  return {
    async putSignedUrl(key, expiresInSeconds = 900) {
      const url = new URL(`${bucketUrl}/${key}`);
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      const signed = await client.sign(new Request(url, { method: "PUT" }), { aws: { signQuery: true } });
      return signed.url;
    },
    async getSignedUrl(key, expiresInSeconds = 300) {
      const url = new URL(`${bucketUrl}/${key}`);
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      const signed = await client.sign(new Request(url, { method: "GET" }), { aws: { signQuery: true } });
      return signed.url;
    },
  };
}

Deno.serve(async (req) => {
  try {
    const { action, objectKey } = await req.json();
    const supabase = getAdminClient();
    const r2Client = buildR2Client();

    if (action === "upload") {
      const { volunteerId } = await verifyVolunteerToken(supabase, req.headers.get("Authorization"));
      const result = await createCnicUploadUrl(r2Client, volunteerId);
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (action === "read") {
      const claims = await verifyStaffToken(req.headers.get("Authorization"));
      const volunteerId = objectKey.split("/")[1];
      const { data: links } = await supabase
        .from("org_volunteer_index")
        .select("organization_id")
        .eq("volunteer_id", volunteerId);
      const canRead = claims.platformOwner || (links ?? []).some(
        (link) => staffHasPermission(claims, link.organization_id, "vms", "volunteers:read"),
      );
      if (!canRead) throw new Error("forbidden");
      const result = await getCnicReadUrl(r2Client, objectKey);
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unknown_action" }), { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

`action: "upload"` now requires the calling volunteer's own session and always issues a key scoped to their own `volunteerId`; `action: "read"` now requires `volunteers:read` in at least one org the volunteer is linked to via `org_volunteer_index` — the objectKey format (`cnic/{volunteerId}/{uuid}`, set by `createCnicUploadUrl` above) is what makes extracting `volunteerId` from it safe, matching the spec's "read access is admin-only" requirement (spec §4) with the fine-grained permission model layered on top.

- [x] **Step 10: Re-run every affected test suite**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno task test`
Expected: PASS across all Edge Function tests — none of the `handler.test.ts` files changed, so they should be unaffected; this confirms the wrapper changes didn't break the pure-function contracts.

- [x] **Step 11: Commit**

```bash
git add backend/supabase/functions/_shared/verifyVolunteerAuth.ts backend/supabase/functions/_shared/verifyVolunteerAuth.test.ts backend/supabase/functions/register-volunteer/index.ts backend/supabase/functions/apply-to-opportunity/index.ts backend/supabase/functions/submit-hours/index.ts backend/supabase/functions/update-sensitive-field/index.ts backend/supabase/functions/upload-cnic-document/index.ts
git commit -m "fix(backend): derive volunteer identity from session token, not client input"
```

---

### Task 24: `organizations` mirror table and `sync-organization` Edge Function

**Files:**
- Create: `backend/supabase/migrations/0012_organizations.sql`
- Test: `backend/supabase/tests/database/organizations_test.sql`
- Create: `backend/supabase/functions/sync-organization/handler.ts`
- Create: `backend/supabase/functions/sync-organization/handler.test.ts`
- Create: `backend/supabase/functions/sync-organization/index.ts`

**Interfaces:**
- Consumes: `verifyStaffToken()` (Task 12).
- Produces: table `organizations` (id, name, slug, deactivated_at — a local mirror, not a source of truth); function `syncOrganization()`. Consumed by vms/frontend's opportunity pages to resolve `opportunities.organization_id` to a display name with no cross-project call.

`platform` (the `tmp-partner-admin` repo) owns organizations as the source of truth. Rather than vms/frontend calling out to `platform` on every page load to resolve an org name — an avoidable runtime dependency on another project being up — `platform` pushes a copy into this table whenever it creates, renames, or deactivates an organization that has the `vms` module enabled. This is a rare, admin-triggered write, not a hot path. `platform` authenticates the call with a staff token carrying `platform_owner: true`, minted the same way as any staff token (shared `STAFF_JWT_SECRET`) — no new secret is introduced.

- [x] **Step 1: Write the failing database test**

Create `backend/supabase/tests/database/organizations_test.sql`:

```sql
begin;
select plan(4);

select has_table('public', 'organizations', 'organizations exists');

insert into organizations (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Rizq', 'rizq');

select is((select name from organizations where id = '11111111-1111-1111-1111-111111111111'), 'Rizq', 'row stores the mirrored name');

insert into organizations (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Rizq Renamed', 'rizq')
on conflict (id) do update set name = excluded.name, synced_at = now();

select is((select name from organizations where id = '11111111-1111-1111-1111-111111111111'), 'Rizq Renamed', 'upsert updates name on re-sync, not a duplicate row');
select is((select count(*) from organizations), 1::bigint, 're-sync does not create a second row');

select * from finish();
rollback;
```

- [x] **Step 2: Run test to verify it fails**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — `organizations` table does not exist.

- [x] **Step 3: Write the migration**

Create `backend/supabase/migrations/0012_organizations.sql`:

```sql
create table organizations (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  deactivated_at timestamptz,
  synced_at timestamptz not null default now()
);

create index organizations_slug_idx on organizations (slug);

alter table organizations enable row level security;

create policy organizations_public_select on organizations
  for select using (deactivated_at is null);
```

No insert/update/delete policy is defined — this table is written only by the `sync-organization` Edge Function using the service-role key, same pattern as `admin_action_log`. `id` has no default: it is always the canonical organization id assigned by `platform`, never generated locally.

- [x] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS on all 4 assertions.

- [x] **Step 5: Commit the table**

```bash
git add backend/supabase/migrations/0012_organizations.sql backend/supabase/tests/database/organizations_test.sql
git commit -m "feat(backend): add organizations mirror table synced from platform"
```

- [x] **Step 6: Write the failing handler test**

Create `backend/supabase/functions/sync-organization/handler.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { syncOrganization } from "./handler.ts";

function fakeSupabase() {
  const calls: unknown[] = [];
  return {
    client: {
      from(_table: string) {
        return {
          async upsert(row: unknown) {
            calls.push(row);
            return { error: null };
          },
        };
      },
    },
    calls,
  };
}

Deno.test("syncOrganization upserts the mirrored row", async () => {
  const { client, calls } = fakeSupabase();
  const result = await syncOrganization(client as never, {
    organizationId: "org-1",
    name: "Rizq",
    slug: "rizq",
  });
  assertEquals(result.organizationId, "org-1");
  assertEquals((calls[0] as { name: string }).name, "Rizq");
});
```

- [x] **Step 7: Run test to verify it fails**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/sync-organization/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [x] **Step 8: Write the handler**

Create `backend/supabase/functions/sync-organization/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export interface SyncOrganizationInput {
  organizationId: string;
  name: string;
  slug: string;
  deactivatedAt?: string | null;
}

export async function syncOrganization(supabase: SupabaseClient, input: SyncOrganizationInput) {
  const { error } = await supabase.from("organizations").upsert({
    id: input.organizationId,
    name: input.name,
    slug: input.slug,
    deactivated_at: input.deactivatedAt ?? null,
    synced_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { organizationId: input.organizationId };
}
```

- [x] **Step 9: Run test to verify it passes**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/sync-organization/handler.test.ts`
Expected: PASS.

- [x] **Step 10: Write `index.ts`, requiring `platform_owner`**

Create `backend/supabase/functions/sync-organization/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { syncOrganization } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    if (!claims.platformOwner) {
      throw new Error("unauthorized");
    }
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await syncOrganization(supabase, input);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

Only `platform_owner` may call this — an org-scoped `org_admin` token is not sufficient, since this writes data other organizations' opportunity pages also read.

- [x] **Step 11: Commit**

```bash
git add backend/supabase/functions/sync-organization/
git commit -m "feat(backend): add sync-organization Edge Function for platform-pushed org data"
```

---

### Task 25: `update-participation-status` Edge Function

**Files:**
- Create: `backend/supabase/functions/update-participation-status/handler.ts`
- Create: `backend/supabase/functions/update-participation-status/handler.test.ts`
- Create: `backend/supabase/functions/update-participation-status/index.ts`

**Interfaces:**
- Consumes: `verifyStaffToken()`, `staffHasPermission()` (Task 12); `participation` (Task 6).
- Produces: `updateParticipationStatus(supabase, staffClaims: StaffClaims, input: { participationId: string; status: "participating" | "completed" | "no_show" | "withdrawn" }): Promise<{ participationId: string }>`. Requires `participation:update` for the row's org. `admin_action_log.staff_id` comes from `staffClaims.staffId` (Task 12).

Rows are created at `selected` (Task 6) whether auto-created by `decideApplication()` or admin-enrolled directly. This function drives the rest of the requirements doc's participation lifecycle (§5D): `selected → participating → {completed | no_show | withdrawn}`. `selected` itself is never a valid target here — a row is already `selected` the moment it exists; this function only ever moves it forward.

- [x] **Step 1: Write the failing test**

Create `backend/supabase/functions/update-participation-status/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateParticipationStatus } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeParticipation(supabase: ReturnType<typeof testClient>, organizationId: string) {
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: crypto.randomUUID(),
    full_name: "Participation Test",
    email: `participation-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "male",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    institution: "Test Uni",
    degree_program: "BSCS",
  }).select("id").single();

  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: organizationId,
    name: "Participation Test Opp",
    type: "event",
  }).select("id").single();

  const { data: participation } = await supabase.from("participation").insert({
    volunteer_id: volunteer!.id,
    opportunity_id: opportunity!.id,
    organization_id: organizationId,
  }).select("id").single();

  return participation!.id as string;
}

const staffClaims = (orgId: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: ["participation:update"] }],
});

Deno.test("updateParticipationStatus moves selected to participating", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const participationId = await makeParticipation(supabase, orgId);

  await updateParticipationStatus(supabase, staffClaims(orgId), {
    participationId,
    status: "participating",
  });

  const { data } = await supabase.from("participation").select("status").eq("id", participationId).single();
  assertEquals(data!.status, "participating");
});

Deno.test("updateParticipationStatus writes an admin_action_log entry attributed to the caller's own staffId", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const participationId = await makeParticipation(supabase, orgId);
  const realStaffId = crypto.randomUUID();

  await updateParticipationStatus(supabase, staffClaims(orgId, realStaffId), {
    participationId,
    status: "no_show",
  });

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", participationId)
    .eq("action", "participation_status_updated");

  assertEquals(logRows?.length, 1);
  assertEquals(logRows![0].staff_id, realStaffId);
});

Deno.test("updateParticipationStatus rejects when staff lacks participation:update for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();
  const participationId = await makeParticipation(supabase, orgId);

  await assertRejects(
    () =>
      updateParticipationStatus(supabase, staffClaims(otherOrgId), {
        participationId,
        status: "completed",
      }),
    Error,
    "forbidden",
  );
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/update-participation-status/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [x] **Step 3: Write the implementation**

Create `backend/supabase/functions/update-participation-status/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface UpdateParticipationStatusInput {
  participationId: string;
  status: "participating" | "completed" | "no_show" | "withdrawn";
}

export async function updateParticipationStatus(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: UpdateParticipationStatusInput,
): Promise<{ participationId: string }> {
  const { data: participation, error: fetchError } = await supabase
    .from("participation")
    .select("id, organization_id")
    .eq("id", input.participationId)
    .single();
  if (fetchError) throw fetchError;

  if (!staffHasPermission(staffClaims, participation.organization_id, "vms", "participation:update")) {
    throw new Error("forbidden");
  }

  const { error: updateError } = await supabase
    .from("participation")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.participationId);
  if (updateError) throw updateError;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "participation_status_updated",
    target_type: "participation",
    target_id: input.participationId,
    organization_id: participation.organization_id,
    metadata: { status: input.status },
  });

  return { participationId: input.participationId };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/update-participation-status/handler.test.ts`
Expected: PASS on all 3 tests.

- [x] **Step 5: Write the HTTP wrapper**

Create `backend/supabase/functions/update-participation-status/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { updateParticipationStatus } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await updateParticipationStatus(supabase, claims, input);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [x] **Step 6: Commit**

```bash
git add backend/supabase/functions/update-participation-status/
git commit -m "feat(backend): add update-participation-status Edge Function"
```

---

### Task 26: `create-opportunity` and `update-opportunity` Edge Functions

**Files:**
- Create: `backend/supabase/functions/create-opportunity/handler.ts`
- Create: `backend/supabase/functions/create-opportunity/handler.test.ts`
- Create: `backend/supabase/functions/create-opportunity/index.ts`
- Create: `backend/supabase/functions/update-opportunity/handler.ts`
- Create: `backend/supabase/functions/update-opportunity/handler.test.ts`
- Create: `backend/supabase/functions/update-opportunity/index.ts`

**Interfaces:**
- Consumes: `verifyStaffToken()`, `staffHasPermission()` (Task 12); `opportunities` (Task 4).
- Produces: `createOpportunity(supabase, staffClaims, input: { organizationId, name, type, description?, location?, isOnline?, applicationOpenAt?, applicationDeadline?, activityStartAt?, activityEndAt?, eligibilityCriteria?, capacity? }): Promise<{ opportunityId: string }>`, requiring `opportunities:write`. `updateOpportunity(supabase, staffClaims, input: { opportunityId, organizationId, ...same optional fields as create, plus statusOverride? })`, requiring `opportunities:update`. "Publish" is just `updateOpportunity()` setting `statusOverride` — no separate publish function, matching the `decideApplication()`/waitlist-promotion pattern already used elsewhere in this plan. This closes the gap where `platform` (spec §6, "Opportunities — create, edit, publish") had no Edge Function to call and the coarse Task 11 RLS write policy was the only path. `admin_action_log.staff_id` comes from `staffClaims.staffId` (Task 12), never a client-supplied field.

This task bundles both functions since they share the same shape and permission-check pattern — a reviewer needs to see them together to confirm `write` vs. `update` is applied consistently.

- [x] **Step 1: Write the failing tests**

Create `backend/supabase/functions/create-opportunity/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createOpportunity } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const staffClaims = (orgId: string, permission: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: [permission] }],
});

Deno.test("createOpportunity creates a row and logs the action under the caller's own staffId", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const realStaffId = crypto.randomUUID();

  const result = await createOpportunity(supabase, staffClaims(orgId, "opportunities:write", realStaffId), {
    organizationId: orgId, name: "Beach Cleanup", type: "event",
  });

  assertEquals(typeof result.opportunityId, "string");

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", result.opportunityId)
    .eq("action", "opportunity_created");
  assertEquals(logRows?.length, 1);
  assertEquals(logRows![0].staff_id, realStaffId);
});

Deno.test("createOpportunity rejects staff without opportunities:write for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();

  await assertRejects(
    () => createOpportunity(supabase, staffClaims(orgId, "opportunities:read"), {
      organizationId: orgId, name: "Beach Cleanup", type: "event",
    }),
    Error,
    "forbidden",
  );
});
```

Create `backend/supabase/functions/update-opportunity/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateOpportunity } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const staffClaims = (orgId: string, permission: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: [permission] }],
});

Deno.test("updateOpportunity publishes by setting status_override and logs the action", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Draft Opp", type: "event",
  }).select("id").single();

  await updateOpportunity(supabase, staffClaims(orgId, "opportunities:update"), {
    opportunityId: opportunity!.id, organizationId: orgId, statusOverride: "open",
  });

  const { data: updated } = await supabase.from("opportunities").select("status_override").eq("id", opportunity!.id).single();
  assertEquals(updated!.status_override, "open");

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", opportunity!.id)
    .eq("action", "opportunity_updated");
  assertEquals(logRows?.length, 1);
});

Deno.test("updateOpportunity rejects staff without opportunities:update for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Draft Opp", type: "event",
  }).select("id").single();

  await assertRejects(
    () => updateOpportunity(supabase, staffClaims(orgId, "opportunities:read"), {
      opportunityId: opportunity!.id, organizationId: orgId, statusOverride: "open",
    }),
    Error,
    "forbidden",
  );
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/create-opportunity/handler.test.ts functions/update-opportunity/handler.test.ts`
Expected: FAIL — `handler.ts` files do not exist.

- [x] **Step 3: Write the implementations**

Create `backend/supabase/functions/create-opportunity/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface CreateOpportunityInput {
  organizationId: string;
  name: string;
  type: string;
  description?: string;
  location?: string;
  isOnline?: boolean;
  applicationOpenAt?: string;
  applicationDeadline?: string;
  activityStartAt?: string;
  activityEndAt?: string;
  eligibilityCriteria?: string;
  capacity?: number;
}

export async function createOpportunity(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: CreateOpportunityInput,
): Promise<{ opportunityId: string }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "opportunities:write")) {
    throw new Error("forbidden");
  }

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      organization_id: input.organizationId,
      name: input.name,
      type: input.type,
      description: input.description ?? null,
      location: input.location ?? null,
      is_online: input.isOnline ?? false,
      application_open_at: input.applicationOpenAt ?? null,
      application_deadline: input.applicationDeadline ?? null,
      activity_start_at: input.activityStartAt ?? null,
      activity_end_at: input.activityEndAt ?? null,
      eligibility_criteria: input.eligibilityCriteria ?? null,
      capacity: input.capacity ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "opportunity_created",
    target_type: "opportunity",
    target_id: data.id,
    organization_id: input.organizationId,
  });

  return { opportunityId: data.id };
}
```

Create `backend/supabase/functions/update-opportunity/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface UpdateOpportunityInput {
  opportunityId: string;
  organizationId: string;
  name?: string;
  description?: string;
  location?: string;
  isOnline?: boolean;
  applicationOpenAt?: string;
  applicationDeadline?: string;
  activityStartAt?: string;
  activityEndAt?: string;
  eligibilityCriteria?: string;
  capacity?: number;
  statusOverride?: string;
}

export async function updateOpportunity(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: UpdateOpportunityInput,
): Promise<{ opportunityId: string }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "opportunities:update")) {
    throw new Error("forbidden");
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.location !== undefined) patch.location = input.location;
  if (input.isOnline !== undefined) patch.is_online = input.isOnline;
  if (input.applicationOpenAt !== undefined) patch.application_open_at = input.applicationOpenAt;
  if (input.applicationDeadline !== undefined) patch.application_deadline = input.applicationDeadline;
  if (input.activityStartAt !== undefined) patch.activity_start_at = input.activityStartAt;
  if (input.activityEndAt !== undefined) patch.activity_end_at = input.activityEndAt;
  if (input.eligibilityCriteria !== undefined) patch.eligibility_criteria = input.eligibilityCriteria;
  if (input.capacity !== undefined) patch.capacity = input.capacity;
  if (input.statusOverride !== undefined) patch.status_override = input.statusOverride;

  const { error } = await supabase.from("opportunities").update(patch).eq("id", input.opportunityId);
  if (error) throw error;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "opportunity_updated",
    target_type: "opportunity",
    target_id: input.opportunityId,
    organization_id: input.organizationId,
    metadata: patch,
  });

  return { opportunityId: input.opportunityId };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/create-opportunity/handler.test.ts functions/update-opportunity/handler.test.ts`
Expected: PASS on all 4 tests.

- [x] **Step 5: Write the HTTP wrappers**

Create `backend/supabase/functions/create-opportunity/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { createOpportunity } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await createOpportunity(supabase, claims, input);
    return new Response(JSON.stringify(result), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

Create `backend/supabase/functions/update-opportunity/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { updateOpportunity } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await updateOpportunity(supabase, claims, input);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [x] **Step 6: Commit**

```bash
git add backend/supabase/functions/create-opportunity/ backend/supabase/functions/update-opportunity/
git commit -m "feat(backend): add create-opportunity and update-opportunity Edge Functions"
```

---

### Task 27: `create-chapter` and `update-chapter` Edge Functions

**Files:**
- Create: `backend/supabase/functions/create-chapter/handler.ts`
- Create: `backend/supabase/functions/create-chapter/handler.test.ts`
- Create: `backend/supabase/functions/create-chapter/index.ts`
- Create: `backend/supabase/functions/update-chapter/handler.ts`
- Create: `backend/supabase/functions/update-chapter/handler.test.ts`
- Create: `backend/supabase/functions/update-chapter/index.ts`

**Interfaces:**
- Consumes: `verifyStaffToken()`, `staffHasPermission()` (Task 12); `chapters` (Task 8).
- Produces: `createChapter(supabase, staffClaims, input: { organizationId, name, institution?, city?, province? }): Promise<{ chapterId: string }>`, requiring `chapters:write`. `updateChapter(supabase, staffClaims, input: { chapterId, organizationId, name?, institution?, city?, province?, status? })`, requiring `chapters:update`. Same rationale as Task 26 — this was previously only reachable via the coarse Task 11 RLS policy. `admin_action_log.staff_id` comes from `staffClaims.staffId` (Task 12).

- [x] **Step 1: Write the failing tests**

Create `backend/supabase/functions/create-chapter/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createChapter } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const staffClaims = (orgId: string, permission: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: [permission] }],
});

Deno.test("createChapter creates a row and logs the action under the caller's own staffId", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const realStaffId = crypto.randomUUID();

  const result = await createChapter(supabase, staffClaims(orgId, "chapters:write", realStaffId), {
    organizationId: orgId, name: "LUMS Chapter", institution: "LUMS", city: "Lahore", province: "Punjab",
  });

  assertEquals(typeof result.chapterId, "string");

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", result.chapterId)
    .eq("action", "chapter_created");
  assertEquals(logRows?.length, 1);
  assertEquals(logRows![0].staff_id, realStaffId);
});

Deno.test("createChapter rejects staff without chapters:write for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();

  await assertRejects(
    () => createChapter(supabase, staffClaims(orgId, "chapters:read"), {
      organizationId: orgId, name: "LUMS Chapter",
    }),
    Error,
    "forbidden",
  );
});
```

Create `backend/supabase/functions/update-chapter/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateChapter } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const staffClaims = (orgId: string, permission: string): StaffClaims => ({
  actorType: "staff",
  staffId: crypto.randomUUID(),
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: [permission] }],
});

Deno.test("updateChapter renames a chapter and logs the action", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: chapter } = await supabase.from("chapters").insert({
    organization_id: orgId, name: "Old Name",
  }).select("id").single();

  await updateChapter(supabase, staffClaims(orgId, "chapters:update"), {
    chapterId: chapter!.id, organizationId: orgId, name: "New Name",
  });

  const { data: updated } = await supabase.from("chapters").select("name").eq("id", chapter!.id).single();
  assertEquals(updated!.name, "New Name");
});

Deno.test("updateChapter rejects staff without chapters:update for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: chapter } = await supabase.from("chapters").insert({
    organization_id: orgId, name: "Old Name",
  }).select("id").single();

  await assertRejects(
    () => updateChapter(supabase, staffClaims(orgId, "chapters:read"), {
      chapterId: chapter!.id, organizationId: orgId, name: "New Name",
    }),
    Error,
    "forbidden",
  );
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/create-chapter/handler.test.ts functions/update-chapter/handler.test.ts`
Expected: FAIL — `handler.ts` files do not exist.

- [x] **Step 3: Write the implementations**

Create `backend/supabase/functions/create-chapter/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface CreateChapterInput {
  organizationId: string;
  name: string;
  institution?: string;
  city?: string;
  province?: string;
}

export async function createChapter(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: CreateChapterInput,
): Promise<{ chapterId: string }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "chapters:write")) {
    throw new Error("forbidden");
  }

  const { data, error } = await supabase
    .from("chapters")
    .insert({
      organization_id: input.organizationId,
      name: input.name,
      institution: input.institution ?? null,
      city: input.city ?? null,
      province: input.province ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "chapter_created",
    target_type: "chapter",
    target_id: data.id,
    organization_id: input.organizationId,
  });

  return { chapterId: data.id };
}
```

Create `backend/supabase/functions/update-chapter/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface UpdateChapterInput {
  chapterId: string;
  organizationId: string;
  name?: string;
  institution?: string;
  city?: string;
  province?: string;
  status?: "active" | "inactive";
}

export async function updateChapter(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: UpdateChapterInput,
): Promise<{ chapterId: string }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "chapters:update")) {
    throw new Error("forbidden");
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.institution !== undefined) patch.institution = input.institution;
  if (input.city !== undefined) patch.city = input.city;
  if (input.province !== undefined) patch.province = input.province;
  if (input.status !== undefined) patch.status = input.status;

  const { error } = await supabase.from("chapters").update(patch).eq("id", input.chapterId);
  if (error) throw error;

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "chapter_updated",
    target_type: "chapter",
    target_id: input.chapterId,
    organization_id: input.organizationId,
    metadata: patch,
  });

  return { chapterId: input.chapterId };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/create-chapter/handler.test.ts functions/update-chapter/handler.test.ts`
Expected: PASS on all 4 tests.

- [x] **Step 5: Write the HTTP wrappers**

Create `backend/supabase/functions/create-chapter/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { createChapter } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await createChapter(supabase, claims, input);
    return new Response(JSON.stringify(result), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

Create `backend/supabase/functions/update-chapter/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { updateChapter } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await updateChapter(supabase, claims, input);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [x] **Step 6: Commit**

```bash
git add backend/supabase/functions/create-chapter/ backend/supabase/functions/update-chapter/
git commit -m "feat(backend): add create-chapter and update-chapter Edge Functions"
```

---

### Task 28: `enroll-participant` Edge Function

**Files:**
- Create: `backend/supabase/functions/enroll-participant/handler.ts`
- Create: `backend/supabase/functions/enroll-participant/handler.test.ts`
- Create: `backend/supabase/functions/enroll-participant/index.ts`

**Interfaces:**
- Consumes: `verifyStaffToken()`, `staffHasPermission()` (Task 12); `participation` (Task 6).
- Produces: `enrollParticipant(supabase, staffClaims, input: { organizationId: string; opportunityId: string; volunteerId: string }): Promise<{ participationId: string }>`. Requires `participation:write` — this is the admin-direct enrollment path spec §3 describes ("admin can enroll directly without a prior application"), distinct from `decideApplication()`'s auto-created participation (which uses `participation:update`'s sibling permission model but is triggered by an `applications:update` action, not this one). This was previously undocumented as an Edge Function entirely; `participation:write` is a new addition to `platform`'s permission catalog (`tmp-partner-admin` plan Task 6) alongside the pre-existing `participation:read`/`participation:update`. `admin_action_log.staff_id` comes from `staffClaims.staffId` (Task 12).

- [x] **Step 1: Write the failing test**

Create `backend/supabase/functions/enroll-participant/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { enrollParticipant } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const staffClaims = (orgId: string, permission: string, staffId = crypto.randomUUID()): StaffClaims => ({
  actorType: "staff",
  staffId,
  platformOwner: false,
  orgRoles: [{ organizationId: orgId }],
  moduleAccess: [{ organizationId: orgId, module: "vms", permissions: [permission] }],
});

Deno.test("enrollParticipant creates a participation row with no application_id and logs the action under the caller's own staffId", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const realStaffId = crypto.randomUUID();
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: crypto.randomUUID(), full_name: "Enroll Test", email: `enroll-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`, dob: "1999-01-01", gender: "male",
    city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Test Uni", degree_program: "BSCS",
  }).select("id").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Direct Enroll Opp", type: "event",
  }).select("id").single();

  const result = await enrollParticipant(supabase, staffClaims(orgId, "participation:write", realStaffId), {
    organizationId: orgId, opportunityId: opportunity!.id, volunteerId: volunteer!.id,
  });

  const { data: row } = await supabase.from("participation").select("application_id, status").eq("id", result.participationId).single();
  assertEquals(row!.application_id, null);
  assertEquals(row!.status, "selected");

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", result.participationId)
    .eq("action", "participant_enrolled");
  assertEquals(logRows?.length, 1);
  assertEquals(logRows![0].staff_id, realStaffId);
});

Deno.test("enrollParticipant rejects staff without participation:write for the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: crypto.randomUUID(), full_name: "Enroll Reject Test", email: `enroll-reject-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`, dob: "1999-01-01", gender: "male",
    city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Test Uni", degree_program: "BSCS",
  }).select("id").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Direct Enroll Opp", type: "event",
  }).select("id").single();

  await assertRejects(
    () => enrollParticipant(supabase, staffClaims(orgId, "participation:update"), {
      organizationId: orgId, opportunityId: opportunity!.id, volunteerId: volunteer!.id,
    }),
    Error,
    "forbidden",
  );
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/enroll-participant/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [x] **Step 3: Write the implementation**

Create `backend/supabase/functions/enroll-participant/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface EnrollParticipantInput {
  organizationId: string;
  opportunityId: string;
  volunteerId: string;
}

export async function enrollParticipant(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: EnrollParticipantInput,
): Promise<{ participationId: string }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "vms", "participation:write")) {
    throw new Error("forbidden");
  }

  const { data: participation, error } = await supabase
    .from("participation")
    .insert({
      volunteer_id: input.volunteerId,
      opportunity_id: input.opportunityId,
      organization_id: input.organizationId,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.rpc("touch_org_volunteer_index", {
    p_org_id: input.organizationId,
    p_volunteer_id: input.volunteerId,
  });

  await supabase.from("admin_action_log").insert({
    staff_id: staffClaims.staffId,
    actor_type: staffClaims.actorType,
    action: "participant_enrolled",
    target_type: "participation",
    target_id: participation.id,
    organization_id: input.organizationId,
  });

  return { participationId: participation.id };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `(cd backend && npx supabase db push --linked) && cd backend/supabase && deno test --allow-net --allow-env functions/enroll-participant/handler.test.ts`
Expected: PASS on both tests.

- [x] **Step 5: Write the HTTP wrapper**

Create `backend/supabase/functions/enroll-participant/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { enrollParticipant } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const input = await req.json();
    const result = await enrollParticipant(supabase, claims, input);
    return new Response(JSON.stringify(result), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [x] **Step 6: Commit**

```bash
git add backend/supabase/functions/enroll-participant/
git commit -m "feat(backend): add enroll-participant Edge Function for admin-direct enrollment"
```

---

## Post-plan checklist (not a task — verify before moving to Plan 2)

- [x] `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done` passes in full. (Verified via `npx -y supabase@2.116.0 db push --linked --dry-run` reporting "Remote database is up to date" plus the full pgTAP loop: 62/62 assertions pass, zero `not ok`, across all 12 test files.)
- [x] `cd backend/supabase && deno task test` passes in full. (57/57 tests pass, zero failed, verified independently by the controller as the final step of Task 28.)
- [x] Every table listed in spec §3 exists with RLS enabled (`select relrowsecurity from pg_class where relname = '<table>';` for each) — explicitly including `org_volunteer_index` and `rate_limit_hits`, both of which historically shipped with RLS disabled entirely; run `select relname from pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace and not relrowsecurity;` once and confirm it returns zero rows, rather than checking tables one at a time from a list that can go stale. (Ran exactly this query: zero rows returned.)
- [x] `STAFF_JWT_SECRET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_URL`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS` are documented in `backend/README.md` as required environment variables (values are set per-environment, never committed). (Confirmed present in the README's "Required environment variables" list.)
- [ ] The `organizations` table has at least one synced row (Rizq) before `frontend`'s opportunity pages rely on it for display names — otherwise opportunity org names render blank rather than erroring, since the join is a local read against a mirror, not a live check. **NOT DONE** — `select count(*) from organizations;` returns 0. This is expected at this stage: populating it requires a real call to `sync-organization` from an actual `platform_owner`-claimed staff token (minted by the `platform`/`tmp-partner-admin` repo, which this session did not touch), not something this backend-only plan can self-seed. Flagging for whoever wires up `platform` next.
- [ ] `platform`'s `permissions` catalog (`tmp-partner-admin` plan Task 6) includes `participation:write` — a mint-time dependency for Task 28's `enroll-participant` to ever be reachable by a real staff token; confirm both repos' catalogs agree before testing Task 28 end-to-end against a real `platform` instance. **NOT VERIFIABLE FROM THIS REPO** — `tmp-partner-admin` was explicitly out of scope for this session (top-level instructions: do not touch it). Flagging for whoever owns that repo.
- [ ] Every RLS write policy from Task 11 has a matching Edge Function (Tasks 14–28) that's the documented path for that write, and no table has a `for insert`/`for update`/`for delete` policy whose only gate is `staff_has_org_role()` without a paired `staff_has_permission()` check — this was the root cause behind the coarse RLS on opportunities/chapters/participation/activity_hours before this pass. **PARTIALLY VERIFIED, ONE GAP FOUND**: every write policy across all migrations uses `staff_has_permission()`, never a bare `staff_has_org_role()` gate (grepped every `for insert`/`for update`/`for delete` line — confirmed clean on that half). However, three RLS delete policies from Task 11's migration (`opportunities_staff_delete`, `chapters_staff_delete`, `volunteer_chapter_link_staff_delete`) have **no matching Edge Function** anywhere across Tasks 14–28 — no `delete-opportunity`, `delete-chapter`, or `unlink-chapter` function was ever specified by the plan. These policies are reachable only via a direct PostgREST `DELETE` call from a sufficiently-permissioned staff token, bypassing `admin_action_log` entirely and performing a real hard delete — which conflicts with this plan's own Global Constraint ("No hard deletes outside append-only logs; use `deactivated_at`"). This is a plan-authoring gap (the migration text and this checklist item both predate any delete-*, unlink-* task ever being written), not something introduced during this execution — the migration was transcribed byte-for-byte from Task 11's brief. Left unfixed and unchecked: closing it would mean either stripping delete policies from an already-committed, plan-mandated migration or inventing three new Edge Functions with no brief to transcribe from, neither of which is authorized without a ruling from whoever owns this plan next.
