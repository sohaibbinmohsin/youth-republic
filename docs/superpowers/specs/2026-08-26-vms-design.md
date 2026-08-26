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
| cnic_number (unique, nullable) | mandatory eventually; not blocking at registration |
| cnic_document_url | nullable, R2 object reference, signed-URL access only |
| graduation_year, skills, interests, availability | optional |
| emergency_contact | structured: name, phone, relation |
| profile_picture_url | optional, R2 |
| guardian_name, guardian_contact | nullable; required together when registrant is a minor |
| guardian_consent_at | nullable timestamp; must be set before a minor's registration write succeeds |
| status | pending_verification / active / inactive |
| created_at, deactivated_at | soft-delete only |

`is_minor` is **not** a stored column — it's computed from `dob` at read/
write time, so it never goes stale as a volunteer ages past 18.

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
RLS/query convenience), motivation_statement, status, applied_at,
decided_at, decided_by (opaque staff_id reference — no cross-DB FK into
`platform`).

### `participation`

id, application_id (nullable — admin can enroll directly without a prior
application), volunteer_id, opportunity_id, organization_id, status,
timestamps. Auto-created when an application's status becomes "Selected."

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
- Volunteers may read/write their own row only (`auth.uid()` from this
  project's own Auth).
- Staff may read a volunteer's row only if an `EXISTS` check against
  `org_volunteer_index` (or `applications`/`participation`) finds a link to
  an organization present in their `org_roles` claim, or they carry
  `platform_owner`. This is a join-based policy, not a flat column match —
  `volunteers` has no `organization_id` to match against.
- Writes to org-scoped tables require a matching `org_roles` entry;
  destructive actions require `org_super_admin`.

**Key functions / Edge Functions** (every meaningful write goes through
one of these — never a direct frontend-to-DB write):

- `registerVolunteer()` — creates the volunteer row. If DOB implies a
  minor, requires `guardian_name` + `guardian_contact` + a consent flag in
  the same request, and sets `guardian_consent_at`; rejects the write
  otherwise.
- `applyToOpportunity()` — creates an application; runs platform-wide
  near-duplicate detection (same name+city, different email) and flags
  matches for admin review rather than silently allowing or blocking.
- `decideApplication()` — updates application status; auto-creates
  `participation` on "Selected"; writes `admin_action_log`; triggers a
  status-change email.
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
- **Testing** — unit tests on the three state-machine transitions
  (application → participation → hours) and on near-duplicate detection.
  RLS policies get an explicit test pass: a staff member from one
  organization must never read another organization's exclusive data, and
  must never read a volunteer's PII without an `org_volunteer_index` (or
  application/participation) link — this is the failure mode most likely
  to pass code review silently and fail in production.

## 7. Explicitly Out of Scope (for this repo/spec)

- Staff identity, org/module registry, admin hub UI — `platform` repo.
- Self-serve organization onboarding — deferred past MVP.
- A general-purpose volunteer-side action log — the state machines
  themselves already provide this; only sensitive-field edits get a
  dedicated log (§3, `profile_field_changes`).
- Building an AI agent — only the write-path constraints that make one
  possible later without rework (§2) are in scope now.
