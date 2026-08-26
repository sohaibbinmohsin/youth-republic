# VMS Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `backend/` — the Supabase project (schema, RLS, Edge Functions) that owns all VMS data — as a fully working, independently testable service, with no dependency on `frontend/` or `platform`.

**Architecture:** Postgres schema with the global volunteer pool and org-scoped join tables, enforced by RLS using JWT claims shared with the `platform` project. All state-changing operations go through Edge Functions (never direct table writes from clients), each backed by a pure, dependency-injected handler function so it can be unit-tested against a local Supabase instance without HTTP.

**Tech Stack:** Supabase (Postgres 15, Auth, Edge Functions), Supabase CLI for local dev and migrations, Deno + TypeScript for Edge Functions, pgTAP for database/RLS tests, Deno's built-in test runner for Edge Function tests.

**Spec:** [docs/superpowers/specs/2026-08-26-vms-design.md](../specs/2026-08-26-vms-design.md)

## Global Constraints

- `volunteers` has no `organization_id` column — org visibility is always via `org_volunteer_index`, never a flat column match (spec §2, §4).
- Every state-changing operation goes through an Edge Function; no table is ever written to directly by a frontend client (spec §2).
- `actor_type` is an open string, not a fixed enum (spec §2).
- Minors (computed from `dob`, under 18) cannot complete registration without `guardian_name`, `guardian_contact`, and `guardian_consent_at` all set (spec §2, §3).
- CNIC documents are stored via signed URLs only; the storage bucket is never public (spec §3, §4).
- `profile_field_changes` logs only these fields: `dob`, `cnic_number`, `phone`, `emergency_contact`, `guardian_name`, `guardian_contact` (spec §3).
- No hard deletes outside append-only logs; use `deactivated_at` (spec §3).
- Rejected `activity_hours` rows are retained with a reason, never deleted (spec §4).

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

**Interfaces:**
- Produces: `getAdminClient(): SupabaseClient` — every Edge Function handler test and `index.ts` wrapper uses this to get a service-role client against the local instance.

- [ ] **Step 1: Install the Supabase CLI and initialize the project**

```bash
mkdir -p backend
cd backend
npx supabase init
```

This creates `supabase/config.toml` and an empty `supabase/migrations/` directory.

- [ ] **Step 2: Start the local stack and confirm it's healthy**

Run: `npx supabase start`
Expected: output lists API URL, DB URL, Studio URL, and a `service_role` key. Copy the `service_role` key and DB URL for the next step — local dev only, never commit them.

- [ ] **Step 3: Add the Deno config for Edge Functions**

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

- [ ] **Step 4: Write the shared admin client module**

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

- [ ] **Step 5: Document local dev in the backend README**

Create `backend/README.md`:

```markdown
# vms backend

Local dev:

    npx supabase start
    npx supabase db reset      # applies all migrations fresh
    deno task test             # runs Edge Function unit tests (from supabase/)
    npx supabase test db       # runs pgTAP database/RLS tests
```

- [ ] **Step 6: Commit**

```bash
git add backend/supabase/config.toml backend/supabase/deno.jsonc backend/supabase/functions/_shared/supabaseAdmin.ts backend/README.md backend/.gitignore
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

- [ ] **Step 1: Write the pgTAP test setup file**

Create `backend/supabase/tests/database/000_setup.sql`:

```sql
create extension if not exists pgtap with schema extensions;
```

- [ ] **Step 2: Write the failing test**

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

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx supabase test db`
Expected: FAIL — `volunteers` table does not exist.

- [ ] **Step 4: Write the migration**

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

- [ ] **Step 5: Apply the migration and run tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS on all 9 assertions.

- [ ] **Step 6: Commit**

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

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx supabase test db`
Expected: FAIL — table does not exist.

- [ ] **Step 3: Write the migration**

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

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx supabase test db`
Expected: FAIL — table does not exist.

- [ ] **Step 3: Write the migration**

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

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

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
- Produces: table `applications` with statuses `submitted | under_review | selected | rejected | withdrawn`. Consumed by Task 6 (`participation`) and `apply-to-opportunity`/`decide-application` handlers.

- [ ] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/applications_test.sql`:

```sql
begin;
select plan(4);

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

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx supabase test db`
Expected: FAIL — table does not exist.

- [ ] **Step 3: Write the migration**

Create `backend/supabase/migrations/0004_applications.sql`:

```sql
create table applications (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  organization_id uuid not null,
  motivation_statement text,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'selected', 'rejected', 'withdrawn')),
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  unique (volunteer_id, opportunity_id)
);

create index applications_org_idx on applications (organization_id);
create index applications_status_idx on applications (status);
create index applications_volunteer_idx on applications (volunteer_id);
```

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

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
- Produces: table `participation`, statuses `active | completed | withdrawn`. Consumed by Task 7 (`activity_hours`) and `decide-application`/`submit-hours` handlers.

- [ ] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/participation_test.sql`:

```sql
begin;
select plan(3);

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

select is((select status from participation where volunteer_id = :'vol_id'), 'active', 'defaults to active, admin-enrolled without an application');

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx supabase test db`
Expected: FAIL — table does not exist.

- [ ] **Step 3: Write the migration**

Create `backend/supabase/migrations/0005_participation.sql`:

```sql
create table participation (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete set null,
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  organization_id uuid not null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index participation_org_idx on participation (organization_id);
create index participation_volunteer_idx on participation (volunteer_id);
```

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx supabase test db`
Expected: FAIL — table does not exist.

- [ ] **Step 3: Write the migration**

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

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx supabase test db`
Expected: FAIL — tables do not exist.

- [ ] **Step 3: Write the migration**

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

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx supabase test db`
Expected: FAIL — tables do not exist.

- [ ] **Step 3: Write the migration**

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

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

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
- Produces: functions `is_platform_owner() returns boolean`, `staff_org_ids() returns uuid[]`, `staff_has_org_role(p_org_id uuid, p_roles text[]) returns boolean` — used by every RLS policy in Task 11 and by Edge Function handlers that need to check staff authority server-side.

The staff JWT (issued by `platform`, verified here because both Supabase projects share the same JWT secret) carries this claim shape:

```json
{
  "actor_type": "staff",
  "platform_owner": false,
  "org_roles": [{ "organization_id": "uuid", "role": "org_admin" }],
  "modules": ["vms"]
}
```

- [ ] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/rls_volunteers_test.sql`:

```sql
begin;
select plan(5);

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'RLS Test', 'rls-test@example.com', '0300-7777777', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

select touch_org_volunteer_index('22222222-2222-2222-2222-222222222222', :'vol_id');

select set_config('request.jwt.claims', '{"platform_owner": true}', true);
select is(is_platform_owner(), true, 'platform_owner claim recognized');

select set_config('request.jwt.claims', '{"org_roles": [{"organization_id": "22222222-2222-2222-2222-222222222222", "role": "org_admin"}]}', true);
select ok('22222222-2222-2222-2222-222222222222'::uuid = any(staff_org_ids()), 'staff_org_ids extracts org uuids from claim');
select is(staff_has_org_role('22222222-2222-2222-2222-222222222222'::uuid, null), true, 'staff_has_org_role true for a matching org');
select is(staff_has_org_role('33333333-3333-3333-3333-333333333333'::uuid, null), false, 'staff_has_org_role false for a non-matching org');

select set_config('request.jwt.claims', '{}', true);
select is(staff_has_org_role('22222222-2222-2222-2222-222222222222'::uuid, null), false, 'no claim means no access');

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx supabase test db`
Expected: FAIL — functions do not exist.

- [ ] **Step 3: Write the migration**

Create `backend/supabase/migrations/0009_rls_volunteers.sql`:

```sql
create or replace function is_platform_owner() returns boolean as $$
  select coalesce((auth.jwt() ->> 'platform_owner')::boolean, false);
$$ language sql stable;

create or replace function staff_org_ids() returns uuid[] as $$
  select coalesce(array_agg((r ->> 'organization_id')::uuid), '{}')
  from jsonb_array_elements(coalesce(auth.jwt() -> 'org_roles', '[]'::jsonb)) r;
$$ language sql stable;

create or replace function staff_has_org_role(p_org_id uuid, p_roles text[]) returns boolean as $$
  select is_platform_owner() or exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'org_roles', '[]'::jsonb)) r
    where (r ->> 'organization_id')::uuid = p_org_id
      and (p_roles is null or (r ->> 'role') = any(p_roles))
  );
$$ language sql stable;

alter table volunteers enable row level security;

create policy volunteers_self_select on volunteers
  for select using (auth_user_id = auth.uid());

create policy volunteers_self_update on volunteers
  for update using (auth_user_id = auth.uid());

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

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

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
- Consumes: `staff_has_org_role()`, `is_platform_owner()` (Task 10); all org-scoped tables (Tasks 4–9).

- [ ] **Step 1: Write the failing test**

Create `backend/supabase/tests/database/rls_org_scoped_test.sql`:

```sql
begin;
select plan(4);

insert into opportunities (organization_id, name, type)
values ('22222222-2222-2222-2222-222222222222', 'Public Op', 'event')
returning id as opp_id \gset

select set_config('request.jwt.claims', '{}', true);
select set_config('role', 'authenticated', true);
select is((select count(*) from opportunities where id = :'opp_id'), 1::bigint, 'anyone can read a non-deactivated opportunity');

select set_config('request.jwt.claims', '{"org_roles": [{"organization_id": "33333333-3333-3333-3333-333333333333", "role": "org_admin"}]}', true);
select throws_ok(
  format($$ update opportunities set name = 'hijacked' where id = '%s' $$, :'opp_id'),
  null,
  null,
  'staff from a different org cannot write to this opportunity'
);

select set_config('request.jwt.claims', '{"org_roles": [{"organization_id": "22222222-2222-2222-2222-222222222222", "role": "org_admin"}]}', true);
update opportunities set name = 'updated by owning org staff' where id = :'opp_id';
select is((select name from opportunities where id = :'opp_id'), 'updated by owning org staff', 'staff from the owning org can write');

select set_config('request.jwt.claims', '{}', true);
select is((select count(*) from applications), 0::bigint, 'no applications visible with no volunteer session and no staff claim');

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx supabase test db`
Expected: FAIL — RLS not yet enabled, so the "different org cannot write" assertion fails (write succeeds when it shouldn't).

- [ ] **Step 3: Write the migration**

Create `backend/supabase/migrations/0010_rls_org_scoped.sql`:

```sql
alter table opportunities enable row level security;

create policy opportunities_public_select on opportunities
  for select using (deactivated_at is null);

create policy opportunities_staff_all on opportunities
  for all using (staff_has_org_role(organization_id, null))
  with check (staff_has_org_role(organization_id, null));

alter table applications enable row level security;

create policy applications_self_select on applications
  for select using (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

create policy applications_self_insert on applications
  for insert with check (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

create policy applications_staff_select on applications
  for select using (staff_has_org_role(organization_id, null));

create policy applications_staff_update on applications
  for update using (staff_has_org_role(organization_id, null));

alter table participation enable row level security;

create policy participation_self_select on participation
  for select using (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

create policy participation_staff_all on participation
  for all using (staff_has_org_role(organization_id, null))
  with check (staff_has_org_role(organization_id, null));

alter table activity_hours enable row level security;

create policy activity_hours_self_select on activity_hours
  for select using (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

create policy activity_hours_self_insert on activity_hours
  for insert with check (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

create policy activity_hours_staff_all on activity_hours
  for all using (staff_has_org_role(organization_id, null))
  with check (staff_has_org_role(organization_id, null));

alter table chapters enable row level security;

create policy chapters_public_select on chapters
  for select using (status = 'active');

create policy chapters_staff_all on chapters
  for all using (staff_has_org_role(organization_id, null))
  with check (staff_has_org_role(organization_id, null));

alter table volunteer_chapter_link enable row level security;

create policy volunteer_chapter_link_self_select on volunteer_chapter_link
  for select using (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

create policy volunteer_chapter_link_staff_all on volunteer_chapter_link
  for all using (staff_has_org_role(organization_id, null))
  with check (staff_has_org_role(organization_id, null));

alter table admin_action_log enable row level security;

create policy admin_action_log_staff_select on admin_action_log
  for select using (organization_id is null or staff_has_org_role(organization_id, null));

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
```

No insert/delete policies are defined for `admin_action_log` or `profile_field_changes` — both are written only by Edge Functions using the service-role key, which bypasses RLS entirely, matching the spec's "never a direct frontend-to-DB write" constraint.

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0010_rls_org_scoped.sql backend/supabase/tests/database/rls_org_scoped_test.sql
git commit -m "feat(backend): add RLS on all org-scoped tables"
```

---

### Task 12: `verifyStaffToken()` shared module

**Files:**
- Create: `backend/supabase/functions/_shared/verifyStaffToken.ts`
- Create: `backend/supabase/functions/_shared/verifyStaffToken.test.ts`

**Interfaces:**
- Produces: `verifyStaffToken(authHeader: string | null): StaffClaims` — throws `Error("unauthorized")` on any failure. `StaffClaims = { actorType: string; platformOwner: boolean; orgRoles: { organizationId: string; role: string }[]; modules: string[] }`. Used by every Edge Function handler that needs to check staff authority in application code (Tasks 13–20).

- [ ] **Step 1: Write the failing test**

Create `backend/supabase/functions/_shared/verifyStaffToken.test.ts`:

```typescript
import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyStaffToken } from "./verifyStaffToken.ts";
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
    platform_owner: false,
    org_roles: [{ organization_id: "org-1", role: "org_admin" }],
    modules: ["vms"],
  });
  const claims = await verifyStaffToken(`Bearer ${token}`);
  assertEquals(claims.actorType, "staff");
  assertEquals(claims.orgRoles[0].organizationId, "org-1");
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/_shared/verifyStaffToken.test.ts`
Expected: FAIL — `verifyStaffToken.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `backend/supabase/functions/_shared/verifyStaffToken.ts`:

```typescript
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

export interface StaffClaims {
  actorType: string;
  platformOwner: boolean;
  orgRoles: { organizationId: string; role: string }[];
  modules: string[];
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
    return {
      actorType: String(payload.actor_type ?? "staff"),
      platformOwner: Boolean(payload.platform_owner),
      orgRoles: Array.isArray(payload.org_roles)
        ? (payload.org_roles as Array<Record<string, unknown>>).map((r) => ({
          organizationId: String(r.organization_id),
          role: String(r.role),
        }))
        : [],
      modules: Array.isArray(payload.modules) ? payload.modules.map(String) : [],
    };
  } catch {
    throw new Error("unauthorized");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/_shared/verifyStaffToken.test.ts`
Expected: PASS on all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/functions/_shared/verifyStaffToken.ts backend/supabase/functions/_shared/verifyStaffToken.test.ts
git commit -m "feat(backend): add verifyStaffToken shared JWT verification module"
```

---

### Task 13: Rate limiting helper

**Files:**
- Create: `backend/supabase/functions/_shared/rateLimit.ts`
- Create: `backend/supabase/functions/_shared/rateLimit.test.ts`

**Interfaces:**
- Produces: `checkRateLimit(supabase: SupabaseClient, key: string, limit: number, windowSeconds: number): Promise<boolean>` — returns `false` when the caller should be rejected with a 429. Used by `register-volunteer` and `apply-to-opportunity` (Tasks 14–15), the two open public-write endpoints named in spec §6.
- Consumes: a new `rate_limit_hits` table, created in this task's migration.

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/_shared/rateLimit.test.ts`
Expected: FAIL — module and table do not exist.

- [ ] **Step 3: Add the migration**

Create `backend/supabase/migrations/0011_rate_limit_hits.sql`:

```sql
create table rate_limit_hits (
  id bigint generated always as identity primary key,
  rate_key text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_key_idx on rate_limit_hits (rate_key, created_at);
```

- [ ] **Step 4: Write the implementation**

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

- [ ] **Step 5: Apply migration and run tests**

Run: `npx supabase db reset && cd backend/supabase && deno test --allow-net --allow-env functions/_shared/rateLimit.test.ts`
Expected: PASS on both tests.

- [ ] **Step 6: Commit**

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
- Produces: `registerVolunteer(supabase: SupabaseClient, input: RegisterVolunteerInput): Promise<RegisterVolunteerResult>`. `RegisterVolunteerInput` includes `authUserId`, all mandatory `volunteers` fields, and optional `guardianName`/`guardianContact`/`guardianConsent: boolean`. `RegisterVolunteerResult = { volunteerId: string; volunteerCode: string }`. Throws `Error("minor_consent_required")` when DOB implies a minor and consent fields are incomplete.

- [ ] **Step 1: Write the failing test**

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/register-volunteer/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

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

  return { volunteerId: data.id, volunteerCode: data.volunteer_code };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db reset && cd backend/supabase && deno test --allow-net --allow-env functions/register-volunteer/handler.test.ts`
Expected: PASS on all 3 tests.

- [ ] **Step 5: Write the HTTP wrapper**

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

- [ ] **Step 6: Commit**

```bash
git add backend/supabase/functions/register-volunteer/
git commit -m "feat(backend): add register-volunteer Edge Function with minor consent gating"
```

---

### Task 15: `apply-to-opportunity` Edge Function

**Files:**
- Create: `backend/supabase/functions/apply-to-opportunity/handler.ts`
- Create: `backend/supabase/functions/apply-to-opportunity/handler.test.ts`
- Create: `backend/supabase/functions/apply-to-opportunity/index.ts`

**Interfaces:**
- Consumes: `getAdminClient()`, `checkRateLimit()`.
- Produces: `applyToOpportunity(supabase, input: { volunteerId: string; opportunityId: string; organizationId: string; motivationStatement?: string }): Promise<{ applicationId: string }>`. Runs near-duplicate detection (same `full_name` + `city`, different `email`) and, on a match, writes an `admin_action_log` row with `actor_type: 'system'`, `action: 'duplicate_flagged'` rather than blocking the application.

- [ ] **Step 1: Write the failing test**

Create `backend/supabase/functions/apply-to-opportunity/handler.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
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

Deno.test("applyToOpportunity flags a near-duplicate without blocking the application", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  await makeVolunteer(supabase, { full_name: "Duplicate Person", city: "Multan" });
  const secondVolunteerId = await makeVolunteer(supabase, { full_name: "Duplicate Person", city: "Multan" });
  const opportunityId = await makeOpportunity(supabase, orgId);

  const result = await applyToOpportunity(supabase, {
    volunteerId: secondVolunteerId,
    opportunityId,
    organizationId: orgId,
  });

  assertEquals(typeof result.applicationId, "string");

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("action", "duplicate_flagged")
    .eq("target_id", secondVolunteerId);

  assertEquals(logRows?.length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/apply-to-opportunity/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

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

async function flagNearDuplicatesIfAny(supabase: SupabaseClient, volunteerId: string) {
  const { data: volunteer, error } = await supabase
    .from("volunteers")
    .select("full_name, city, email")
    .eq("id", volunteerId)
    .single();
  if (error) throw error;

  const { data: matches } = await supabase
    .from("volunteers")
    .select("id, email")
    .eq("full_name", volunteer.full_name)
    .eq("city", volunteer.city)
    .neq("id", volunteerId);

  const realMatches = (matches ?? []).filter((m) => m.email !== volunteer.email);
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

export async function applyToOpportunity(
  supabase: SupabaseClient,
  input: ApplyToOpportunityInput,
): Promise<ApplyToOpportunityResult> {
  await flagNearDuplicatesIfAny(supabase, input.volunteerId);

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db reset && cd backend/supabase && deno test --allow-net --allow-env functions/apply-to-opportunity/handler.test.ts`
Expected: PASS on both tests.

- [ ] **Step 5: Write the HTTP wrapper**

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

- [ ] **Step 6: Commit**

```bash
git add backend/supabase/functions/apply-to-opportunity/
git commit -m "feat(backend): add apply-to-opportunity Edge Function with duplicate flagging"
```

---

### Task 16: `decide-application` Edge Function

**Files:**
- Create: `backend/supabase/functions/decide-application/handler.ts`
- Create: `backend/supabase/functions/decide-application/handler.test.ts`
- Create: `backend/supabase/functions/decide-application/index.ts`

**Interfaces:**
- Consumes: `verifyStaffToken()` (Task 12), `staff_has_org_role` via RLS (staff writes go through the admin client but the handler still checks the claim to return a clean 403 rather than a raw Postgres error).
- Produces: `decideApplication(supabase, staffClaims: StaffClaims, input: { applicationId: string; decision: "selected" | "rejected" | "under_review"; staffId: string }): Promise<{ applicationId: string; participationId: string | null }>`.

- [ ] **Step 1: Write the failing test**

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

async function makeApplication(supabase: ReturnType<typeof testClient>, organizationId: string) {
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

const staffClaims = (orgId: string): StaffClaims => ({
  actorType: "staff",
  platformOwner: false,
  orgRoles: [{ organizationId: orgId, role: "org_admin" }],
  modules: ["vms"],
});

Deno.test("decideApplication selecting an applicant auto-creates participation", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);

  const result = await decideApplication(supabase, staffClaims(orgId), {
    applicationId,
    decision: "selected",
    staffId: crypto.randomUUID(),
  });

  assertEquals(result.participationId !== null, true);

  const { data: application } = await supabase.from("applications").select("status").eq("id", applicationId).single();
  assertEquals(application!.status, "selected");
});

Deno.test("decideApplication rejects when staff lacks a role in the application's org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);

  await assertRejects(
    () =>
      decideApplication(supabase, staffClaims(otherOrgId), {
        applicationId,
        decision: "selected",
        staffId: crypto.randomUUID(),
      }),
    Error,
    "forbidden",
  );
});

Deno.test("decideApplication writes an admin_action_log entry", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const { applicationId } = await makeApplication(supabase, orgId);
  const staffId = crypto.randomUUID();

  await decideApplication(supabase, staffClaims(orgId), {
    applicationId,
    decision: "rejected",
    staffId,
  });

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("target_id", applicationId)
    .eq("action", "application_decided");

  assertEquals(logRows?.length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/decide-application/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `backend/supabase/functions/decide-application/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface DecideApplicationInput {
  applicationId: string;
  decision: "selected" | "rejected" | "under_review";
  staffId: string;
}

export interface DecideApplicationResult {
  applicationId: string;
  participationId: string | null;
}

function staffCanActOnOrg(claims: StaffClaims, organizationId: string): boolean {
  return claims.platformOwner || claims.orgRoles.some((r) => r.organizationId === organizationId);
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

  if (!staffCanActOnOrg(staffClaims, application.organization_id)) {
    throw new Error("forbidden");
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: input.decision, decided_at: new Date().toISOString(), decided_by: input.staffId })
    .eq("id", input.applicationId);
  if (updateError) throw updateError;

  let participationId: string | null = null;

  if (input.decision === "selected") {
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

    await supabase.rpc("touch_org_volunteer_index", {
      p_org_id: application.organization_id,
      p_volunteer_id: application.volunteer_id,
    });
  }

  await supabase.from("admin_action_log").insert({
    staff_id: input.staffId,
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db reset && cd backend/supabase && deno test --allow-net --allow-env functions/decide-application/handler.test.ts`
Expected: PASS on all 3 tests.

- [ ] **Step 5: Write the HTTP wrapper**

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
    const result = await decideApplication(supabase, claims, { ...input, staffId: input.staffId });
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

- [ ] **Step 6: Commit**

```bash
git add backend/supabase/functions/decide-application/
git commit -m "feat(backend): add decide-application Edge Function"
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
- Produces: `submitHours(supabase, input: { participationId, volunteerId, opportunityId, organizationId, activityDate, hoursSubmitted, role?, location? }): Promise<{ activityHoursId: string }>` and `verifyHours(supabase, staffClaims, input: { activityHoursId, decision: "verified" | "rejected", hoursVerified?, rejectionReason?, staffId }): Promise<{ activityHoursId: string }>`.

- [ ] **Step 1: Write the failing tests**

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

const staffClaims = (orgId: string): StaffClaims => ({
  actorType: "staff", platformOwner: false, orgRoles: [{ organizationId: orgId, role: "org_admin" }], modules: ["vms"],
});

Deno.test("verifyHours verifying sets hours_verified and status", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase);

  await verifyHours(supabase, staffClaims(orgId), {
    activityHoursId, decision: "verified", hoursVerified: 5, staffId: crypto.randomUUID(),
  });

  const { data: row } = await supabase.from("activity_hours").select("verification_status, hours_verified").eq("id", activityHoursId).single();
  assertEquals(row!.verification_status, "verified");
  assertEquals(row!.hours_verified, 5);
});

Deno.test("verifyHours rejecting retains the row with a reason", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase);

  await verifyHours(supabase, staffClaims(orgId), {
    activityHoursId, decision: "rejected", rejectionReason: "No proof of attendance", staffId: crypto.randomUUID(),
  });

  const { data: row } = await supabase.from("activity_hours").select("verification_status, rejection_reason").eq("id", activityHoursId).single();
  assertEquals(row!.verification_status, "rejected");
  assertEquals(row!.rejection_reason, "No proof of attendance");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/submit-hours/handler.test.ts functions/verify-hours/handler.test.ts`
Expected: FAIL — handlers do not exist.

- [ ] **Step 3: Write the implementations**

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
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface VerifyHoursInput {
  activityHoursId: string;
  decision: "verified" | "rejected";
  hoursVerified?: number;
  rejectionReason?: string;
  staffId: string;
}

export interface VerifyHoursResult {
  activityHoursId: string;
}

function staffCanActOnOrg(claims: StaffClaims, organizationId: string): boolean {
  return claims.platformOwner || claims.orgRoles.some((r) => r.organizationId === organizationId);
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

  if (!staffCanActOnOrg(staffClaims, row.organization_id)) {
    throw new Error("forbidden");
  }

  const { error: updateError } = await supabase
    .from("activity_hours")
    .update({
      verification_status: input.decision,
      hours_verified: input.decision === "verified" ? input.hoursVerified ?? null : null,
      rejection_reason: input.decision === "rejected" ? input.rejectionReason ?? null : null,
      verified_by: input.staffId,
      verified_at: new Date().toISOString(),
    })
    .eq("id", input.activityHoursId);
  if (updateError) throw updateError;

  await supabase.from("admin_action_log").insert({
    staff_id: input.staffId,
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db reset && cd backend/supabase && deno test --allow-net --allow-env functions/submit-hours/handler.test.ts functions/verify-hours/handler.test.ts`
Expected: PASS on all tests.

- [ ] **Step 5: Write the HTTP wrappers**

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

- [ ] **Step 6: Commit**

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
- Produces: `bulkAssignHours(supabase, staffClaims, input: { organizationId: string; opportunityId: string; activityDate: string; hoursSubmitted: number; participationIds: string[]; staffId: string }): Promise<{ createdCount: number }>`.

- [ ] **Step 1: Write the failing test**

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

const staffClaims = (orgId: string): StaffClaims => ({
  actorType: "staff", platformOwner: false, orgRoles: [{ organizationId: orgId, role: "org_admin" }], modules: ["vms"],
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
    hoursSubmitted: 4, participationIds, staffId: crypto.randomUUID(),
  });

  assertEquals(result.createdCount, 3);
});

Deno.test("bulkAssignHours rejects staff without a role in the org", async () => {
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
        hoursSubmitted: 4, participationIds, staffId: crypto.randomUUID(),
      }),
    Error,
    "forbidden",
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/bulk-assign-hours/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `backend/supabase/functions/bulk-assign-hours/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface BulkAssignHoursInput {
  organizationId: string;
  opportunityId: string;
  activityDate: string;
  hoursSubmitted: number;
  participationIds: string[];
  staffId: string;
}

export interface BulkAssignHoursResult {
  createdCount: number;
}

function staffCanActOnOrg(claims: StaffClaims, organizationId: string): boolean {
  return claims.platformOwner || claims.orgRoles.some((r) => r.organizationId === organizationId);
}

export async function bulkAssignHours(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: BulkAssignHoursInput,
): Promise<BulkAssignHoursResult> {
  if (!staffCanActOnOrg(staffClaims, input.organizationId)) {
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
    staff_id: input.staffId,
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db reset && cd backend/supabase && deno test --allow-net --allow-env functions/bulk-assign-hours/handler.test.ts`
Expected: PASS on both tests.

- [ ] **Step 5: Write the HTTP wrapper**

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

- [ ] **Step 6: Commit**

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

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/upload-cnic-document/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/upload-cnic-document/handler.test.ts`
Expected: PASS on both tests.

- [ ] **Step 5: Write the HTTP wrapper**

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

- [ ] **Step 6: Commit**

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

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/update-sensitive-field/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase db reset && cd backend/supabase && deno test --allow-net --allow-env functions/update-sensitive-field/handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the HTTP wrapper**

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

- [ ] **Step 6: Commit**

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
- Produces: `exportApplicationsCsv(supabase, staffClaims, organizationId: string): Promise<string>` — returns CSV text (volunteer_code, full_name, email, opportunity name, status, applied_at).

- [ ] **Step 1: Write the failing test**

Create `backend/supabase/functions/export-csv/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { exportApplicationsCsv } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const staffClaims = (orgId: string): StaffClaims => ({
  actorType: "staff", platformOwner: false, orgRoles: [{ organizationId: orgId, role: "org_admin" }], modules: ["vms"],
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

Deno.test("exportApplicationsCsv rejects staff without a role in the org", async () => {
  const supabase = testClient();
  const orgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();

  await assertRejects(() => exportApplicationsCsv(supabase, staffClaims(otherOrgId), orgId), Error, "forbidden");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/export-csv/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `backend/supabase/functions/export-csv/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function staffCanActOnOrg(claims: StaffClaims, organizationId: string): boolean {
  return claims.platformOwner || claims.orgRoles.some((r) => r.organizationId === organizationId);
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function exportApplicationsCsv(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  organizationId: string,
): Promise<string> {
  if (!staffCanActOnOrg(staffClaims, organizationId)) {
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db reset && cd backend/supabase && deno test --allow-net --allow-env functions/export-csv/handler.test.ts`
Expected: PASS on both tests.

- [ ] **Step 5: Write the HTTP wrapper**

Create `backend/supabase/functions/export-csv/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyStaffToken } from "../_shared/verifyStaffToken.ts";
import { exportApplicationsCsv } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const claims = await verifyStaffToken(req.headers.get("Authorization"));
    const supabase = getAdminClient();
    const { organizationId } = await req.json();
    const csv = await exportApplicationsCsv(supabase, claims, organizationId);
    return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [ ] **Step 6: Commit**

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

- [ ] **Step 1: Write the failing test for the shared email module**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/_shared/sendEmail.test.ts`
Expected: FAIL — `sendEmail.ts` does not exist.

- [ ] **Step 3: Write the shared email module**

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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/_shared/sendEmail.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for email-on-decision behavior**

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
    applicationId, decision: "selected", staffId: crypto.randomUUID(),
  }, emailClient);

  assertEquals(emailClient.sent.length, 1);
  assertEquals(emailClient.sent[0].to, volunteer!.email);
});
```

- [ ] **Step 6: Run tests to verify the new one fails**

Run: `cd backend/supabase && deno test --allow-net --allow-env functions/decide-application/handler.test.ts`
Expected: FAIL — `decideApplication` does not yet accept or call an email client.

- [ ] **Step 7: Update the implementation**

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

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx supabase db reset && cd backend/supabase && deno test --allow-net --allow-env functions/decide-application/handler.test.ts`
Expected: PASS on all 4 tests.

- [ ] **Step 9: Wire the real email client into the HTTP wrapper**

Modify `backend/supabase/functions/decide-application/index.ts` — add the import and pass the client through:

```typescript
// Add to imports:
import { getResendEmailClient } from "../_shared/sendEmail.ts";

// Change:
//   const result = await decideApplication(supabase, claims, { ...input, staffId: input.staffId });
// to:
const result = await decideApplication(supabase, claims, { ...input, staffId: input.staffId }, getResendEmailClient());
```

- [ ] **Step 10: Repeat the same pattern for `verify-hours`**

Modify `backend/supabase/functions/verify-hours/handler.test.ts` the same way: import `EmailClient` and `FakeEmailClient` (same shape as above), pass `new FakeEmailClient()` as a fourth argument to every `verifyHours(...)` call, and add:

```typescript
Deno.test("verifyHours sends a status-change email to the volunteer", async () => {
  const supabase = testClient();
  const { activityHoursId, orgId } = await makeActivityHours(supabase);
  const emailClient = new FakeEmailClient();

  await verifyHours(supabase, staffClaims(orgId), {
    activityHoursId, decision: "verified", hoursVerified: 5, staffId: crypto.randomUUID(),
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

- [ ] **Step 11: Run all affected tests**

Run: `npx supabase db reset && cd backend/supabase && deno test --allow-net --allow-env functions/decide-application/handler.test.ts functions/verify-hours/handler.test.ts functions/_shared/sendEmail.test.ts`
Expected: PASS on all tests.

- [ ] **Step 12: Commit**

```bash
git add backend/supabase/functions/_shared/sendEmail.ts backend/supabase/functions/_shared/sendEmail.test.ts backend/supabase/functions/decide-application/ backend/supabase/functions/verify-hours/
git commit -m "feat(backend): send status-change emails via Resend on decision and hours verification"
```

---

## Post-plan checklist (not a task — verify before moving to Plan 2)

- [ ] `npx supabase db reset && npx supabase test db` passes in full.
- [ ] `cd backend/supabase && deno task test` passes in full.
- [ ] Every table listed in spec §3 exists with RLS enabled (`select relrowsecurity from pg_class where relname = '<table>';` for each).
- [ ] `STAFF_JWT_SECRET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_URL`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS` are documented in `backend/README.md` as required environment variables (values are set per-environment, never committed).
