# Backend & API Contract — Design

**Date:** 2026-08-30
**Status:** Approved (brainstorming)
**Sub-project:** 1 of 4 (Backend & API contract → Per-org theming infra → Public YR frontend → Admin YR-module frontend)

## Purpose

The Wave-1 prototype (`demos/youth-republic/prototype.html`, in the frontend
repo) settled the volunteer-facing product. Several interactions it depends on
are not modelled by the current backend: org-designed application forms, file
attachments, structured opportunity content, per-org branding, and session
photos. This sub-project upgrades `youth-republic/backend/supabase` so that
**every interaction in the prototype — and the admin form-builder that feeds
it — is supported by schema and edge functions.** Both frontends (public
Youth Republic and the admin Youth-Republic module in `tmp-partner-admin`)
consume this one API + one Postgres database.

## Constraints & context

- Both apps are pre-launch. There is little or no real data. We take a **clean
  break**: change columns and edge-function signatures in place, no
  compatibility shims. The migration and both frontend adapter layers land
  together.
- The admin app calls the youth-republic backend edge functions
  (`NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL`) with a minted staff JWT. The
  admin app's own Supabase is the platform layer only (staff, roles, modules,
  organizations-as-platform-records). Organizations flow admin → YR via
  `sync-organization`.
- House patterns to follow: one migration file per change
  (`supabase/migrations/NNNN_*.sql`), pgTAP tests in
  `supabase/tests/database/*`, edge functions as `functions/<name>/{index.ts,
  handler.ts}` with matching `*.test.ts`, service-role client that derives
  ownership from DB rows never from client input, shared helpers in
  `functions/_shared/`.

## Decisions (from brainstorming)

| Ref | Decision |
|---|---|
| Q1 | **Hybrid form storage** — jsonb form definition + jsonb answers + a fixed set of promoted columns on `applications`. |
| Q2 | **Flat fields + validation rules**, no conditional/branching logic. |
| Q3 | **Domain-isolated private Storage buckets** (identity docs / application files / session photos) + a single `get-attachment` access function; an `attachments` table makes files first-class. |
| Q4 | **Four fixed opportunity content sections** (About, What you'll do, Who can apply, What to bring). |
| Q5 | **Admin owns branding**; `organizations` widened in both DBs; `sync-organization` payload widened. |
| Q6a | **Identity verification** is done by a central Youth Republic team; **hours verification** is done by org staff holding the verify-hours permission. |
| Q6b | Identity: verify / reject-with-reason / re-upload, logged. Hours: accept the submitted number or set a different one; "adjusted by admin" surfaced when they differ; every action audited. |
| Q7 | **Clean break**, migration + both frontend adapters land together. |
| Reset | Keep the super-admin and admin staff users; drop all other data in both DBs; re-seed from the prototype; create the first volunteer login and hand over credentials. |
| Shared | One canonical `functions/_shared/forms.ts` (field registry + `validateFormDefinition` + `validateAnswers`), vendored into both frontends via a path alias. |

### Independent calls confirmed with the user

1. **Form snapshot:** store a full copy of the form definition on each application at submit time (`applications.form_snapshot`).
2. **Portfolio:** one composite `get-volunteer-portfolio` endpoint returns the whole Impact screen.
3. **Promoted columns:** `applicant_name / applicant_email / applicant_phone / consent_accepted` on `applications`, populated server-side (name/email/phone from the volunteer record, consent from the form).
4. **ID-doc collection:** folded into `register-volunteer` (number + attachment), replacing the current two-step.
5. **`activity_hours` status:** the legacy `recorded` state is dropped; a submitted session goes straight to `pending`.
6. **Verification gate:** an unverified volunteer may browse and apply, but cannot be selected into participation until verified.
7. **Admin DB reset:** keep `staff`, `roles`, `role_permissions`, `modules`, `org_modules`; drop volunteer-domain data and test orgs; re-point the super-admin/admin org-role rows to the four re-seeded orgs.
8. **`forms.ts` sharing:** path-alias vendor (no package registry) for now.

## Out of scope (explicit)

- Conditional / branching form logic.
- A rich-text or block editor for opportunity content (the four sections are plain text / text arrays).
- The theming middleware and shared token package (sub-project 3). This spec only adds the *data* it will read.
- Email/notification *delivery* mechanics. Status changes may enqueue; sending is later.
- Virus scanning of uploads. v1 enforces a MIME + extension allowlist and a size cap; scanning is a noted follow-up.
- Any frontend implementation (sub-projects 2–4).

---

## Data model

All changes are additive migrations on `youth-republic/backend/supabase`
unless noted. "Drop" means the column/table is removed in this migration set
(clean break, no data to migrate).

### `organizations` (YR backend)

Add:

| Column | Type | Notes |
|---|---|---|
| `brand_color` | `text` | `#RRGGBB`, checked by regex. Nullable → falls back to the platform-neutral theme. |
| `logo_url` | `text` | Absolute URL to the org logo asset (hosted by the admin platform). |
| `favicon_url` | `text` | Absolute URL. |
| `about` | `text` | Org blurb shown on the opportunity detail page. |

Public exposure: a view `org_branding` selecting only
`id, name, slug, brand_color, logo_url, favicon_url, about` from non-deactivated
orgs, with an anon-select RLS grant. The theming middleware (sub-project 3)
reads this by `slug`. The full `organizations` row keeps its existing
`organizations_public_select` policy.

### `organizations` (admin platform DB — `tmp-partner-admin/supabase`)

Add the same four columns (`brand_color`, `logo_url`, `favicon_url`, `about`).
Editable via the admin org screens (that UI is sub-project 4; the columns land
now so the API is complete).

### `sync-organization` (edge function + `SyncOrganizationInput`)

Widen the payload with `brandColor?`, `logoUrl?`, `faviconUrl?`, `about?`;
upsert them alongside `name`/`slug`/`deactivated_at`. Missing fields on an
older caller are treated as "no change" (COALESCE on upsert), so the admin
app can be updated independently within this sub-project's landing.

### `opportunities`

Add:

| Column | Type | Notes |
|---|---|---|
| `about` | `text` | Multi-paragraph intro (paragraphs split on `\n\n` by the renderer). |
| `duties` | `text[]` | "What you'll do" bullet list. |
| `eligibility` | `text[]` | "Who can apply" bullet list. |
| `what_to_bring` | `text[]` | "What to bring" bullet list. Empty array → section hidden. |
| `application_form` | `jsonb NOT NULL DEFAULT '{"version":1,"fields":[]}'` | The org-designed form definition. Shape validated by `validateFormDefinition` on write. |

Drop: `eligibility_criteria` (superseded by `eligibility text[]`).
Keep: `description` (now explicitly the short lead / card blurb),
`type`, `location`, `is_online`, the four `*_at` timestamps, `capacity`,
`status_override`, `opportunity_status(o)` function unchanged.

### `applications`

Drop: `motivation_statement`.

Add:

| Column | Type | Notes |
|---|---|---|
| `answers` | `jsonb NOT NULL DEFAULT '{}'` | Submitted values keyed by field `id`. Files are stored as arrays of attachment ids. |
| `form_snapshot` | `jsonb NOT NULL` | Copy of the opportunity's `application_form` at submit time. |
| `applicant_name` | `text` | Promoted from the volunteer at submit. |
| `applicant_email` | `text` | Promoted from the volunteer at submit. |
| `applicant_phone` | `text` | Promoted from the volunteer at submit. |
| `consent_accepted` | `boolean NOT NULL DEFAULT false` | From the form's consent field (a `checkbox` field marked `required`). |

Keep: `volunteer_id`, `opportunity_id`, `organization_id`, `status` enum,
`applied_at`, `decided_at`, `decided_by`, `unique (volunteer_id, opportunity_id)`.

### `activity_hours` (sessions)

Add: `note text` — free-text "what you did", distinct from `role`.

Change: `verification_status` check becomes
`in ('pending', 'verified', 'rejected')`; **default `'pending'`**. `recorded`
is dropped. `submit-hours` inserts rows as `pending`.

Keep: `hours_submitted`, `hours_verified`, `verified_by`, `verified_at`,
`admin_notes`, `rejection_reason`, `role`, `location`, `activity_date`,
`participation_id`, `volunteer_total_verified_hours()` unchanged.

Derived (no column): a session is "adjusted by admin" when
`hours_verified IS NOT NULL AND hours_verified <> hours_submitted`. Projections
in `list-activity-hours`, `get-volunteer-detail`, and `get-volunteer-portfolio`
expose an `adjusted: boolean` field computed this way.

### `attachments` (new table)

```sql
create table attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,                     -- null for identity docs (platform-owned)
  domain text not null
    check (domain in ('identity_doc', 'application_file', 'session_photo')),
  owner_type text not null
    check (owner_type in ('volunteer', 'application', 'activity_hours')),
  owner_id uuid not null,
  bucket text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes int not null,
  original_filename text,
  status text not null default 'pending'
    check (status in ('pending', 'ready')),  -- 'pending' between request-upload and finalize
  uploaded_by uuid not null,                 -- auth.users id
  created_at timestamptz not null default now()
);
create index attachments_owner_idx on attachments (owner_type, owner_id);
create index attachments_org_idx on attachments (organization_id);
```

**Storage buckets** (all private, created in the migration or via the Supabase
config): `identity-docs`, `application-files`, `session-photos`. No direct RLS
read policies — all reads go through `get-attachment`. Uploads go through a
signed-URL flow (below).

**Per-domain limits** (enforced in `request-attachment-upload`):

| Domain | Buckets | MIME allowlist | Max size | Max files per owner |
|---|---|---|---|---|
| `identity_doc` | `identity-docs` | `image/jpeg`, `image/png`, `application/pdf` | 10 MB | 1 |
| `application_file` | `application-files` | `image/jpeg`, `image/png`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 10 MB | 5 |
| `session_photo` | `session-photos` | `image/jpeg`, `image/png`, `image/webp` | 8 MB | 6 |

`storage_path` convention: `{owner_type}/{owner_id}/{attachment_id}.{ext}`.

### `volunteers`

- Rename `cnic_number` → `id_doc_number text` (unique preserved).
- Add `id_doc_type text check (id_doc_type in ('cnic', 'b_form'))`.
- Drop `cnic_document_url` — the identity document is now an `attachments`
  row (`domain='identity_doc'`, `owner_type='volunteer'`, `owner_id=volunteer.id`).
- `status` enum unchanged (`pending_verification`, `active`, `inactive`).
  Registration leaves the volunteer `pending_verification`.

`profile_field_changes.field_name` check: replace `'cnic_number'` with
`'id_doc_number'`.

### `admin_action_log`

No schema change (generic `staff_id / actor_type / action / target_type /
target_id / organization_id / metadata`). New `action` values:

| action | target_type | metadata |
|---|---|---|
| `volunteer_identity_verified` | `volunteer` | `{}` |
| `volunteer_identity_rejected` | `volunteer` | `{ reason }` |
| `hours_verified` | `activity_hours` | `{ hours: <verified> }` |
| `hours_adjusted` | `activity_hours` | `{ submitted, verified, note? }` |
| `hours_rejected` | `activity_hours` | `{ reason }` |
| `application_form_updated` | `opportunity` | `{ field_count }` |

---

## Shared form module — `functions/_shared/forms.ts`

Canonical, framework-agnostic TypeScript. Imported by the Deno edge functions
directly and vendored into `youth-republic/frontend` and
`tmp-partner-admin` via a path alias / copy step (documented in each frontend's
sub-project). No package registry.

### Types

```ts
type FieldType =
  | "short_text" | "long_text" | "email" | "phone" | "url"
  | "number" | "date" | "select" | "multiselect" | "radio"
  | "checkbox" | "file";

interface FieldDef {
  id: string;               // stable, unique within the form; used as the answers key
  type: FieldType;
  label: string;
  help?: string;
  required?: boolean;
  // select / multiselect / radio
  options?: { value: string; label: string }[];
  // number
  min?: number; max?: number;
  // date  (ISO yyyy-mm-dd)
  minDate?: string; maxDate?: string;
  // short_text / long_text
  minLength?: number; maxLength?: number;
  // file
  accept?: string[];        // MIME types; must be a subset of the domain allowlist
  maxSizeMB?: number;
  maxFiles?: number;
}

interface FormDefinition {
  version: 1;
  fields: FieldDef[];
}

type FieldErrors = Record<string /* field id */, string /* message */>;
```

### Functions

- `validateFormDefinition(def: unknown): { ok: true; def: FormDefinition } | { ok: false; errors: string[] }`
  — used by `update-opportunity-form`, `create-opportunity`, `update-opportunity`.
  Checks: unique non-empty ids, known types, options present for
  choice types, `accept` ⊆ the `application_file` domain allowlist, coherent
  min/max, at most one required `checkbox` treated as the consent field.
- `validateAnswers(def: FormDefinition, answers: unknown): { ok: true } | { ok: false; fieldErrors: FieldErrors }`
  — used by `apply-to-opportunity`. Per field: required-ness, type coercion,
  constraint checks. For `file` fields the answer is an array of attachment
  ids; the caller separately verifies each id exists, is `ready`, has
  `owner_type='application'` pending-link, and belongs to the requester.
- `resolveConsent(def, answers): boolean` — value of the required consent
  `checkbox`, or `false` if none.

Unit tests: `forms.test.ts` — a valid definition round-trips; each
`validateFormDefinition` rejection path; `validateAnswers` happy path plus one
failing case per constraint kind.

---

## Edge functions

### New

#### `request-attachment-upload`
- **Auth:** volunteer (own uploads) or staff token.
- **In:** `{ domain, ownerType, ownerId, mimeType, sizeBytes, originalFilename? }`.
- **Checks:** domain limits (MIME allowlist, size cap, per-owner file count),
  requester may write to that owner (volunteer owns the volunteer/application/
  session row; staff belongs to the org).
- **Out:** `{ attachmentId, uploadUrl, storagePath }`. Inserts the
  `attachments` row `status='pending'`. Signed upload URL TTL 10 min.

#### `finalize-attachment`
- **Auth:** same requester as the request.
- **In:** `{ attachmentId }`.
- **Checks:** the storage object exists; its size/mime match the row within
  tolerance.
- **Out:** `{ ok: true }`. Flips `status='ready'`. A never-finalized `pending`
  row is swept by a scheduled cleanup (drop rows + objects older than 24 h).

#### `get-attachment`
- **Auth:** volunteer or staff token.
- **In:** `{ attachmentId }`.
- **Checks:**
  - `identity_doc` → the owning volunteer, **or** a member of the central
    Youth Republic verification team.
  - `application_file` / `session_photo` → the owning volunteer, **or** staff
    of `attachments.organization_id` with the relevant read permission.
- **Out:** `{ url }` — signed download URL, TTL 5 min.

#### `verify-volunteer`
- **Auth:** central Youth Republic verification team (a platform capability;
  see "Central team" below).
- **In:** `{ volunteerId, decision: 'verify' | 'reject', reason? }`.
- **Effect:** `verify` → `volunteers.status = 'active'`. `reject` → status stays
  `pending_verification`, `reason` returned to the volunteer, their
  `identity_doc` attachment is marked for re-upload (delete + allow a new one).
  Writes `admin_action_log`.
- **Out:** `{ status }`.

#### `list-pending-volunteers`
- **Auth:** central Youth Republic verification team.
- **In:** `{ limit?, offset?, search? }`.
- **Out:** `{ volunteers: [{ id, volunteerCode, fullName, dob, idDocType,
  idDocNumber, city, institution, submittedAt, idDocAttachmentId }], total }`.

#### `get-volunteer-portfolio`
- **Auth:** volunteer (own portfolio only; `volunteerId` derived from the token).
- **Out:**
  ```
  {
    volunteer: { fullName, volunteerCode, city, institution, chapterName?,
                 memberSince, status /* pending_verification | active */ },
    totals: { verifiedHours, activeApplications, completedProgrammes },
    applications: [{ id, opportunityName, orgName, type, location, status }],
    programmes: [{
      participationId, opportunityName, orgName, orgLogoUrl, type, status,
      role, startDate, endDate,
      hoursTotal, hoursVerified, allVerified: boolean,
      sessions: [{ id, date, hours, note, status /* pending | verified | rejected */,
                   adjusted: boolean, photoAttachmentIds: [] }]
    }]
  }
  ```

#### `update-opportunity-form`
- **Auth:** staff with the manage-opportunities permission for the opportunity's org.
- **In:** `{ opportunityId, form }`.
- **Effect:** `validateFormDefinition(form)`; on success sets
  `opportunities.application_form`. Writes `admin_action_log`
  (`application_form_updated`).
- **Out:** `{ ok: true }`.

### Changed

#### `apply-to-opportunity`
- **In:** `{ opportunityId, answers, attachmentIds? }` (drop `motivationStatement`,
  drop client `organizationId`).
- **Effect:**
  1. Load the opportunity (must be non-deactivated, status `open`) and its
     `application_form`.
  2. `validateAnswers(form, answers)` → 422 `{ fieldErrors }` on failure.
  3. Verify every attachment id referenced by a `file` answer: exists,
     `status='ready'`, `owner_type='application'`, `uploaded_by` = requester,
     not yet linked to another application.
  4. Require the volunteer to have an `identity_doc` attachment on file
     (verified status **not** required — Q6 gate is at selection).
  5. Insert `applications` with `answers`, `form_snapshot = form`,
     `applicant_name/email/phone` from the volunteer, `consent_accepted` from
     `resolveConsent`. Re-point the referenced attachments' `owner_id` to the
     new application id.
  6. `touch_org_volunteer_index` as today.
- **Out:** `{ applicationId }`.

#### `submit-hours`
- **In:** add `note?`, `attachmentIds?` (session photos). Keep
  `participationId`, `activityDate`, `hoursSubmitted`, `role?`, `location?`.
- **Effect:** insert `activity_hours` with `verification_status='pending'`,
  `note`. Verify + re-point photo attachments
  (`owner_type='activity_hours'`).
- **Out:** `{ activityHoursId }`.

#### `verify-hours` / `bulk-assign-hours`
- Signatures unchanged. Ensure they set `hours_verified`, `verified_by`,
  `verified_at`, optional `admin_notes` / `rejection_reason`, and write
  `admin_action_log` — `hours_verified` when `hours_verified == hours_submitted`,
  `hours_adjusted` when they differ, `hours_rejected` on rejection.

#### `register-volunteer`
- **In:** add `idDocType: 'cnic' | 'b_form'`, `idDocNumber: string`,
  `idDocAttachmentId: string` (a `ready` `identity_doc` attachment the client
  uploaded during step 2). Guardian fields as today (required when
  `volunteer_is_minor(dob)`; a minor must use `b_form`).
- **Effect:** insert the volunteer with `id_doc_type`, `id_doc_number`,
  `status='pending_verification'`; re-point the identity attachment's
  `owner_id` to the new volunteer id. Near-duplicate flagging as today.
- **Out:** `{ volunteerId, volunteerCode }`.

#### `create-opportunity` / `update-opportunity`
- **In:** add `about?`, `duties?: string[]`, `eligibility?: string[]`,
  `whatToBring?: string[]`, `applicationForm?` (validated via
  `validateFormDefinition`; defaults to an empty form on create).
- Drop `eligibilityCriteria`.

#### `list-opportunities`
- **In:** `{ organizationId?, city?, type?, status?, online?, search?,
  sort? ('newest'|'closing_soon'|'az'), limit?, offset? }`.
  Public callers (anon) see only non-deactivated opportunities and a reduced
  projection; staff callers (staff token) may scope to their org and see all.
- **Out:** `{ opportunities: [{ id, name, orgName, orgLogoUrl, type, city,
  online, computedStatus, description }], total, facets: { cities: [],
  orgs: [{ id, name }] } }`.

#### `get-opportunity-detail` (new function)
- **In:** `{ opportunityId }` (public / anon).
- **Out:** the opportunity with `about`, `duties`, `eligibility`,
  `what_to_bring`, dates, capacity, `computedStatus`, `orgName`,
  `orgAbout`, `orgLogoUrl`, and `applicationForm` (so the apply screen can
  render the form without a second call).

#### `list-applications` (admin)
- Project `applicant_name/email/phone`, `status`, `applied_at`, plus
  `answers` and `form_snapshot` so the review screen renders arbitrary
  answers, and `attachmentIds` grouped by field.

#### `get-volunteer-detail` (admin)
- Per application: `answers` + `form_snapshot`. Per session: `note`,
  `adjusted`, `photoAttachmentIds`, `verification_status`.

### Central Youth Republic verification team

`verify-volunteer` and `list-pending-volunteers` are gated by a **platform
capability**, not an org role (identity is org-agnostic).

**Contract (fixed):** the minted staff token carries a boolean
`canVerifyIdentity`; `verifyStaffToken` in `_shared` exposes it; the two
functions reject any token where it is false. `platform_owner` always has it.

**Mechanism (decided in the implementation plan):** a
`staff.can_verify_identity boolean not null default false` column on the admin
platform DB, set for the central team, folded into `mint-staff-token`. This is
a small, self-contained piece and does not change the contract above.

---

## Reset & seed

Location: `youth-republic/backend/supabase/seed/`.

### `reset.sql` (YR backend DB)

`truncate ... restart identity cascade` on: `activity_hours`, `participation`,
`applications`, `attachments`, `volunteer_chapter_link`, `chapters`,
`opportunities`, `volunteers`, `org_volunteer_index`, `rate_limit_hits`,
`admin_action_log`, `profile_field_changes`, `organizations`. Reset
`volunteer_code_seq`. Delete `auth.users` rows that are not linked to a kept
staff account (there are none on the YR project; staff auth lives on the admin
project). Empty the three Storage buckets.

### Admin platform DB reset

Keep: `staff` (super-admin + admin), `roles`, `role_permissions`, `modules`,
`org_modules`. Truncate `organizations` and re-insert the four seed orgs with
fixed UUIDs. Re-point `staff_org_roles` for the super-admin/admin to those org
UUIDs (super-admin → all four; admin → Rizq). `staff_module_roles` likewise if
present.

### `seed` (a Deno script — it needs the Auth admin API to create the volunteer)

1. Upsert the four organizations with fixed UUIDs and branding:

   | slug | name | brand_color | about (short) |
   |---|---|---|---|
   | `rizq` | Rizq | `#D3BD2A` | food-security charity, Punjab |
   | `green-crescent` | Green Crescent | `#0B7A3B` | urban waterways & reforestation |
   | `sehat-first` | Sehat First | `#B02A2A` | mobile clinics & health camps, Sindh |
   | `read-foundation` | Read Foundation | `#6E1560` | schooling for out-of-school children |

   Placeholder `logo_url` / `favicon_url` (data-URI or a committed asset).
   Run `sync-organization` so the YR `organizations` rows match.

2. Insert the six opportunities (content copied from the prototype's
   `OPPORTUNITIES` array — lead → `description`, `about`, `duties`,
   `eligibility`, `what_to_bring`, dates, `capacity`, `type`, `is_online`,
   `location`). Give each a small representative `application_form`
   (2–4 fields exercising a few types + a required consent checkbox + an
   optional file field).

3. One chapter: "Lahore Central" for Rizq.

4. One worked-example volunteer, **Ayesha Khan**:
   - Create `auth.users` (email + generated strong password).
   - `volunteers` row: `status='active'`, `id_doc_type='cnic'`,
     `id_doc_number` a synthetic value, Lahore / Punjab University, linked to
     the Lahore Central chapter.
   - One `identity_doc` attachment (`status='ready'`, placeholder object).
   - Applications: Riverbank Cleanup → `selected`; Free Medical Camp →
     `under_review`; After-School Maths Tutor → `rejected`. Each with
     `answers` + `form_snapshot` matching that opportunity's seeded form.
   - Participations: Winter Shelter Kitchen → `participating`; Ramadan Food
     Drive, Riverbank Cleanup, Digital Literacy Workshop → `completed`.
   - `activity_hours` sessions matching the prototype:
     Winter Shelter Kitchen ×2 (`pending`); Ramadan Food Drive ×2
     (`verified`, one `hours_verified <> hours_submitted` to exercise
     "adjusted"); Riverbank Cleanup ×1 (`verified`); Digital Literacy Workshop
     ×3 (`verified`). A couple of `session_photo` attachments on the first
     Winter Shelter session.

5. Print at the end: the Ayesha Khan email + password; a note that the
   existing admin / super-admin logins are unchanged; the four org slugs.

### Post-seed smoke test

A Deno test (or a `just`/npm script) that, after `reset` + `seed`:

- `list-opportunities` returns 6 with `facets.cities` and `facets.orgs`
  populated, `orgLogoUrl` present.
- `get-opportunity-detail` for one returns all four content arrays and a
  non-empty `applicationForm`.
- `get-volunteer-portfolio` (as Ayesha) returns 3 applications, 4 programmes,
  `totals.verifiedHours` matching the seeded verified sessions, one session
  with `adjusted: true`, one programme with `allVerified: false`.
- `org_branding` view returns `brand_color` for all four orgs.

---

## Testing strategy

| Layer | Tool | Coverage |
|---|---|---|
| Migrations | pgTAP (`supabase/tests/database/*`) | new columns/constraints exist; `attachments` checks; `activity_hours` status enum; `org_branding` view + anon grant; `profile_field_changes` check updated; `opportunities.application_form` default. |
| Shared module | Deno test (`_shared/forms.test.ts`) | `validateFormDefinition` accept + every reject path; `validateAnswers` accept + one reject per constraint; `resolveConsent`. |
| Edge functions | Deno test (`functions/*/handler.test.ts`) | new functions (upload flow, get-attachment permission matrix, verify-volunteer, portfolio, update-opportunity-form); changed functions (apply with valid/invalid answers + attachment linking, submit-hours with photos, register with id-doc, list-opportunities filters, sync-organization branding). |
| Seed | Deno test | the post-seed smoke assertions above. |

Existing tests for unchanged behaviour must keep passing; tests for changed
signatures are updated in the same change.

## Rollout

Single coordinated change on a feature branch:

1. Migrations + `_shared/forms.ts` + all edge-function changes + seed scripts,
   with tests.
2. `youth-republic/frontend` and `tmp-partner-admin` API adapter layers
   updated to the new signatures (their screen work is sub-projects 3–4, but
   the typed clients — `lib/edgeFunctions.ts`, `lib/vmsFunctions.ts` /
   `lib/youthRepublicFunctions.ts` — are brought in line here so nothing is
   left calling a dead signature).
3. Run `reset` + `seed` against the linked Supabase project; hand over
   credentials.

No compatibility window; nothing consumes the old signatures after this lands.
