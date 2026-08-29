# VMS Design Spec — `vms` monorepo (Youth Republic)

Status: approved for implementation planning
Date: 2026-08-26

## 1. Purpose & Scope

The Volunteer Management System (VMS) is a shared, multi-tenant volunteer CRM.
Youth Republic is the first real organization onboarded onto it. This spec
covers the `vms` monorepo only: `vms/backend` (Supabase project — schema,
RLS, Edge Functions) and `vms/frontend` (the single public volunteer-facing
site). Staff identity, organization/module registry, and the admin hub shell
(including the VMS-admin UI section) belong to the separate `platform` repo
and are specified independently (see the `tmp-partner-admin` spec).

This is one deployable unit: `vms/backend` and `vms/frontend` live in one
repo, different directories, because they change together constantly and
share no meaningful boundary with `platform`.

## 2. Foundational Decisions

These decisions were made deliberately and should not be revisited without
new information — they resolve tensions that are easy to re-litigate
accidentally while building individual features:

- **Volunteers are a global, platform-wide pool.** The `volunteers` table
  carries no `organization_id`. A volunteer registers once and can apply to
  opportunities across any organization on the platform. This is the core
  product thesis (uniting volunteers across organizations, not silo-ing
  them) and must not be undone for convenience later.
- **Org-scoped visibility is a join, not a column.** An organization's "our
  volunteers" view is derived via the `org_volunteer_index` junction table
  (see §3), populated by insert-on-first-contact and never overwritten. A
  volunteer accumulates rows across orgs; she never "moves" from one org to
  another.
- **`vms/frontend` is one central deployment**, not one site per
  organization. Opportunities are tagged with their owning org; a
  volunteer's portfolio spans every org she's worked with.
- **New-organization onboarding is manual/internal for MVP.** No self-serve
  org creation UI. Org rows are created by the platform owner (in
  `platform`), out of scope for this repo.
- **The system is AI-integrable by construction, not by feature.** Every
  meaningful write (apply, decide, verify hours, publish opportunity) goes
  through a defined RPC/Edge Function — never a direct frontend-to-DB
  write. `actor_type` is an open string (not a fixed enum) so an
  `'ai_agent'` actor can be introduced later without a claims-schema
  migration. When that lands, an AI agent acts *as* a specific staff member
  using that member's existing permissions — it does not get its own
  standing authority.
- **Minors are supported, not blocked.** Registrants under 18 (computed
  from DOB, not stored) must provide guardian name + contact and give
  consent before the registration write succeeds.

## 3. Data Model (`vms/backend`)

All tables use UUID primary keys and soft-delete (`deactivated_at`) rather
than hard deletes, except append-only logs.

### `volunteers` (global — no `organization_id`)

| Column | Notes |
|---|---|
| id | UUID PK |
| auth_user_id | FK to this project's own `auth.users` |
| volunteer_code | generated, e.g. `YR-2026-00142` |
| full_name, email (unique), phone (unique), dob, gender | mandatory |
| city, province, country | mandatory |
| institution, degree_program | mandatory |
| cnic_number (unique, nullable) | not required at registration; required before `applyToOpportunity()` succeeds (§4) — this is what makes the uniqueness constraint meaningful for volunteers who actually go on to participate, without adding registration friction for those who only browse |
| cnic_document_url | nullable, R2 object reference, signed-URL access only |
| graduation_year, skills, interests, availability | optional |
| emergency_contact | structured: name, phone, relation; nullable — not required at registration, but required before `decideApplication()` can set an application to `selected` (§4) |
| profile_picture_url | optional, R2 |
| guardian_name, guardian_contact | nullable; required together when registrant is a minor |
| guardian_consent_at | nullable timestamp; must be set before a minor's registration write succeeds |
| status | pending_verification / active / inactive |
| created_at, deactivated_at | soft-delete only |

`is_minor` is **not** a stored column — it's computed from `dob` at read/
write time, so it never goes stale as a volunteer ages past 18.

### `organizations` (local read-only mirror)

`platform` (the `tmp-partner-admin` repo) owns organizations as the source
of truth. `vms/backend` keeps a local mirror — `id, name, slug,
deactivated_at, synced_at` — so `vms/frontend` can resolve an opportunity's
owning org name with a local read, never a live call into `platform`. The
mirror is written only by `syncOrganization()` (§4), pushed by `platform`
whenever it creates, renames, or deactivates an organization with the `vms`
module enabled — an infrequent, admin-triggered write, not a request-time
dependency. `id` has no default: it is always the canonical id assigned by
`platform`.

### `org_volunteer_index` (org-visibility junction)

- `organization_id, volunteer_id` — unique composite
- `first_activity_at`, `last_activity_at`
- Upserted (insert-if-missing, update `last_activity_at`) whenever a new
  `application` or `participation` is created for that org+volunteer pair.
  Never reassigned to a different org.

### `opportunities`

id, organization_id, name, type, description, location, is_online,
application_open/deadline, activity_start/end, eligibility_criteria,
capacity, status (computed from dates) + status_override (manual),
deactivated_at.

### `applications`

id, volunteer_id, opportunity_id, organization_id (denormalized for
RLS/query convenience), motivation_statement, status (`submitted |
under_review | selected | waitlisted | rejected | withdrawn`), applied_at,
decided_at, decided_by (opaque staff_id reference — no cross-DB FK into
`platform`). `waitlisted` supports manual admin promotion to `selected`
when a spot opens (requirements doc §5D) — promotion is just another
`decideApplication()` call, not a separate mechanism.

### `participation`

id, application_id (nullable — admin can enroll directly without a prior
application), volunteer_id, opportunity_id, organization_id, status
(`selected | participating | completed | no_show | withdrawn`),
timestamps. Rows default to `selected` — auto-created when an
application's status becomes "Selected," or created directly by an admin
without a prior application. `selected → participating →
{completed|no_show|withdrawn}` are admin-driven transitions via
`updateParticipationStatus()` (§4), matching the requirements doc's own
two-phase participation lifecycle (§5D).

### `activity_hours`

id, participation_id, volunteer_id, opportunity_id, organization_id, role,
dates, location, hours_submitted, hours_verified, verification_status
(Recorded → Pending → Verified/Rejected), rejection_reason, admin_notes
(internal only), verified_by, verified_at.

### `chapters` / `volunteer_chapter_link`

`chapters`: id, organization_id, name, institution, city, province, status.
`volunteer_chapter_link`: volunteer_id, chapter_id, organization_id,
linked_at — a join table, not a column on `volunteers`, for the same reason
as `org_volunteer_index`: chapter membership is org-relative.

### `admin_action_log`

id, staff_id, actor_type, action, target_type, target_id, organization_id,
metadata (jsonb), created_at. Append-only. Written by every state-changing
Edge Function. `platform`'s admin UI reads this via a read-only API call —
`vms/backend` never calls into `platform` to write.

### `profile_field_changes`

id, volunteer_id, field_name (one of: dob, cnic_number, phone,
emergency_contact, guardian_name, guardian_contact), old_value, new_value,
changed_at. Append-only. Written only by `updateSensitiveField()` (§4) —
never a general-purpose audit log, scoped narrowly to safeguarding-relevant
fields.

## 4. Auth, RLS & Business Logic (`vms/backend`)

**Auth:** `vms/backend` runs its own Supabase Auth for volunteers, separate
from `platform`'s staff Auth project. Staff requests arrive carrying a
shared-secret JWT (HS256) issued by `platform`, verified through a single
`verifyStaffToken()` module — isolated so a later swap to asymmetric keys
touches one file, not every call site.

**RLS:**
- Volunteers may read their own row only (`auth.uid()` from this project's
  own Auth). There is no direct-write RLS policy on `volunteers` — a
  volunteer's own row is written only by `registerVolunteer()` (create) and
  `updateSensitiveField()` (update), both service-role Edge Functions. RLS
  update policies filter which rows an update can touch, not which columns,
  so a self-write policy scoped to "own row" would let a volunteer bypass
  `updateSensitiveField()`'s `profile_field_changes` audit log for the exact
  safeguarding-relevant fields (§3) that log exists to cover.
- Staff may read a volunteer's row only if an `EXISTS` check against
  `org_volunteer_index` (or `applications`/`participation`) finds a link to
  an organization present in their `org_roles` claim, or they carry
  `platform_owner`. This is a join-based policy, not a flat column match —
  `volunteers` has no `organization_id` to match against.
- Writes to org-scoped tables require a matching `org_roles` entry for
  visibility, plus the specific fine-grained permission for that action
  (e.g. `applications:write`), resolved into the JWT's `module_access`
  claim by `platform`'s `mintStaffToken()` — see the `platform`
  (`tmp-partner-admin`) spec §3–4 for the full permission model. This
  supersedes an earlier, coarser "destructive actions require
  `org_super_admin`" role-name check that was never actually implemented
  (every existing RLS test calls `staff_has_org_role(org_id, null)`,
  never filtering by role name).
- **Post-implementation finding (2026-08-29):** this hosted project's
  PostgREST does not currently verify a staff JWT signed with
  `STAFF_JWT_SECRET` at all. Confirmed empirically — a real, correctly-shaped
  staff JWT was minted with `STAFF_JWT_SECRET` and sent as `Authorization:
  Bearer` directly to this project's PostgREST (`/rest/v1/opportunities`);
  it was rejected with `PGRST301` ("No suitable key or wrong key type"), a
  signature-verification failure that happens before RLS is ever evaluated.
  The same call with the project's own anon key succeeded normally,
  confirming the probe was sound. So every RLS policy in this schema gated
  on `staff_has_permission()`/`staff_has_org_role()`/`is_platform_owner()` is
  currently unreachable via a direct PostgREST call carrying a staff JWT —
  not a live vulnerability today, since every real staff-driven write
  already goes through an Edge Function using the service-role client (the
  paragraph above, "verified through a single `verifyStaffToken()` module",
  is the path actually in effect), but it means this project's PostgREST
  does not yet implement the "admin hub calls PostgREST directly with the
  staff JWT" architecture the `vms-backend` plan's Task 11 notes assume is
  already wired up. Closing that gap would require configuring this
  project's custom JWT secret to match `STAFF_JWT_SECRET`, which is a live
  security-setting change outside the scope of this repo's own migrations —
  left as a documented decision point, not fixed here. One concrete
  consequence already acted on: three RLS delete policies
  (`opportunities_staff_delete`, `chapters_staff_delete`,
  `volunteer_chapter_link_staff_delete`) had no matching Edge Function and
  were reachable only via this (currently inert) direct-PostgREST path;
  since Edge-Function-only is the architecture actually in effect, they were
  dropped in `0014_drop_orphaned_delete_policies.sql` as defense-in-depth
  rather than paired with new delete Edge Functions — hard deletes on these
  tables are not a supported path (`deactivated_at` is).

**Key functions / Edge Functions** (every meaningful write goes through
one of these — never a direct frontend-to-DB write):

- `registerVolunteer()` — creates the volunteer row. If DOB implies a
  minor, requires `guardian_name` + `guardian_contact` + a consent flag in
  the same request, and sets `guardian_consent_at`; rejects the write
  otherwise. Runs platform-wide near-duplicate detection (same name+city,
  different email) after a successful insert and flags matches for admin
  review rather than silently allowing or blocking — this lives at
  registration, matching the requirements doc's own placement (§5A), not
  at application time.
- `applyToOpportunity()` — creates an application. Requires the volunteer
  to already have a `cnic_number` on file, rejecting the write otherwise
  — CNIC isn't required at registration (§3), but is required to move
  past it, which is what makes CNIC-based duplicate uniqueness meaningful
  for anyone who actually engages with an opportunity.
- `decideApplication()` — updates application status (including manual
  `waitlisted` → `selected` promotion); requires the volunteer to have an
  `emergency_contact` on file before a decision of `selected` succeeds,
  rejecting otherwise; auto-creates `participation` (status `selected`)
  on "Selected"; writes `admin_action_log`; triggers a status-change
  email.
- `updateParticipationStatus()` — drives `selected → participating →
  {completed | no_show | withdrawn}`; writes `admin_action_log`.
- `submitHours()` / `verifyHours()` — drives the Recorded → Pending →
  Verified/Rejected workflow; auto-rolls up to the volunteer's total
  verified hours; rejected entries are retained with a reason, never
  deleted.
- `bulkAssignHours()` — assigns hours in bulk for fixed-duration
  activities.
- `uploadCnicDocument()` — issues an R2 signed URL for upload; read access
  is admin-only, never a public bucket.
- `computeOpportunityStatus()` — derives status from dates, respecting a
  manual override.
- `exportCSV()` — admin-triggered export (opportunity/application/hours
  data), most likely an Edge Function given expected data volume.
- `updateSensitiveField()` — the single write path for edits to
  dob/cnic_number/phone/emergency_contact/guardian_name/guardian_contact;
  writes an entry to `profile_field_changes` as a side effect of every
  successful edit.
- `syncOrganization()` — upserts the local `organizations` mirror (§3).
  Callable only with a `platform_owner` staff token, since it writes data
  every organization's opportunity pages read, not just the calling org's
  own.

## 5. Frontend (`vms/frontend`)

One central deployment serving all organizations on the platform.

- **Register/login** — mandatory + optional fields per the requirements
  doc; Volunteer ID generated on success. If DOB indicates the registrant
  is a minor, a guardian name/contact sub-form and a consent checkbox
  appear and block submission until completed.
- **Profile view/edit** — self-service, own data only. Edits to
  dob/cnic/phone/emergency_contact/guardian fields route through
  `updateSensitiveField()`.
- **Opportunities list + detail** — filterable by type; each opportunity
  displayed with its owning organization.
- **Apply flow** — pre-filled from the volunteer's profile; only
  opportunity-specific fields are asked fresh.
- **My Applications** — status tracking across all applications,
  regardless of owning org.
- **Portfolio/dashboard** — chronological activity history, grouped/
  labeled by organization, total verified hours across all orgs,
  member-since date.
- **Mobile-responsive throughout** — the requirements doc states the
  primary audience accesses the system from phones; this is a stated
  requirement, not optional polish.

## 6. Cross-Cutting Concerns (scoped to this repo)

- **Transactional email** — Resend or an equivalent free tier, used for
  both Supabase Auth's verification/reset emails and the status-change
  notifications triggered by `decideApplication()` / `verifyHours()`.
  Supabase's default SMTP is rate-capped and not production-viable.
- **File storage** — Cloudflare R2 for CNIC documents and profile
  pictures. Signed URLs only; the bucket is never public, given some
  volunteers are minors and CNIC is a government ID document.
- **Rate limiting / bot protection** — applied to `registerVolunteer()`
  and `applyToOpportunity()`, the two open public-write endpoints most
  exposed to automated abuse.
- **Pagination + indexing** — required on every searchable/filterable
  field (city, institution, status, organization) per the requirements
  doc's explicit non-functional requirement.
- **Backups** — Supabase's free tier has no automated backup/PITR.
  Acceptable to leave unresolved during internal testing; must be resolved
  (scheduled export at minimum, or the Pro upgrade) before real volunteer
  PII enters the system at MVP launch. This is tied to the Pro-upgrade
  timing decision, not a separate open item.
- **Cross-repo contract stability with `platform`** — `platform`'s admin
  hub is a separately deployed consumer of this repo's Edge Functions and
  PostgREST-exposed columns (§4). An Edge Function's request/response
  shape, or an existing table's RLS-visible columns, must never change in
  place if `platform` depends on it — ship an additively-versioned
  replacement instead, verified by `platform`'s own contract/integration
  test suite before the old shape is removed. See the `platform`
  (`tmp-partner-admin`) spec for the verification mechanism.
- **Testing** — unit tests on the three state-machine transitions
  (application → participation → hours) and on near-duplicate detection.
  RLS policies get an explicit test pass: a staff member from one
  organization must never read another organization's exclusive data, and
  must never read a volunteer's PII without an `org_volunteer_index` (or
  application/participation) link — this is the failure mode most likely
  to pass code review silently and fail in production.

## 7. Explicitly Out of Scope (for this repo/spec)

- Staff identity, org/module registry, admin hub UI — `platform` repo.
  This repo's own `organizations` table (§3) is a read-only mirror for
  display purposes only, never the source of truth, and is never written
  to except by `syncOrganization()` (§4).
- Self-serve organization onboarding — deferred past MVP.
- A general-purpose volunteer-side action log — the state machines
  themselves already provide this; only sensitive-field edits get a
  dedicated log (§3, `profile_field_changes`).
- Building an AI agent — only the write-path constraints that make one
  possible later without rework (§2) are in scope now.
