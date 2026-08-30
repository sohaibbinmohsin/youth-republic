# Youth Republic backend — build status

**As of:** 2026-08-31
**Branch:** `spec/backend-api-contract` (YR) · `feat/backend-api-contract` (admin, = ancestor of Gemini's `feat/admin-ui-redesign`)
**Spec:** `docs/superpowers/specs/2026-08-30-backend-api-contract-design.md`
**Plan:** `docs/superpowers/plans/2026-08-30-backend-api-contract.md` (31 tasks)

---

## TL;DR

All 30 code tasks of the API-contract build are **written, committed, and individually reviewed**. A whole-branch review then found **6 blocking issues and ~17 follow-ups** — none in the schema or the core handler logic, all in the *seams* (registration flow doesn't close end-to-end, one IDOR in the attachment-upload path, a `verify-jwt` gap that blocks the two anonymous endpoints on deploy, a stale field in the admin client, two small logic bugs). A fix batch is being applied now. After that: deploy the edge functions + run reset/seed against the hosted projects + hand over the demo credentials.

**Not yet done:** the fix batch, the deploy, and the reset/seed run. **Nothing is deployed. The hosted DBs are untouched.**

---

## What's built (all on the branch)

### Phase A — database (7 migrations, applied to both hosted DBs)
| Migration | What |
|---|---|
| YR `0016` | `organizations` + `brand_color`/`logo_url`/`favicon_url`/`about`; `org_branding` view (anon-readable) |
| YR `0017` | `opportunities` + `about`, `duties[]`, `eligibility[]`, `what_to_bring[]`, `application_form jsonb`; dropped `eligibility_criteria` |
| YR `0018` | `applications` + `answers`/`form_snapshot` jsonb, `applicant_name/email/phone`, `consent_accepted`; dropped `motivation_statement` |
| YR `0019` | `activity_hours` + `note`; `verification_status` → `pending`/`verified`/`rejected` |
| YR `0020` | `attachments` table + 3 private Storage buckets (`identity-docs`, `application-files`, `session-photos`) |
| YR `0021` | `volunteers.cnic_number` → `id_doc_number`; + `id_doc_type` (`cnic`/`b_form`); dropped `cnic_document_url` |
| admin `0012` | `organizations` branding columns; `staff.can_verify_identity` |

### Phase B–D — edge functions (~24, new + changed)
- **Attachments:** `request-attachment-upload`, `finalize-attachment`, `get-attachment` (signed-URL upload flow; per-domain permission matrix; 3 isolated buckets)
- **Dynamic forms:** `_shared/forms.ts` (12 field types, `validateFormDefinition` / `validateAnswers` / `resolveConsent`), vendored into both frontends
- **Volunteer:** `register-volunteer` (id-doc fields), `submit-hours` (note + session photos), `apply-to-opportunity` (dynamic-form answers + attachments + `fieldErrors`)
- **Read:** `get-opportunity-detail` (new, anon), `list-opportunities` (filters, facets, public + staff variants), `get-volunteer-portfolio` (new — Impact programmes with session timelines + photos, Applications, verification status)
- **Opportunity write:** `create`/`update-opportunity` (content arrays + `applicationForm`), `update-opportunity-form` (new)
- **Staff/identity:** `verify-hours` + `bulk-assign-hours` (audit log), `verify-volunteer` + `list-pending-volunteers` (new, gated on `can_verify_identity`), `list-applications` / `get-volunteer-detail` (project the new answer/attachment/note fields)
- **Staff token:** admin `mint-staff-token` now emits `can_verify_identity`

### Phase E — typed API clients
- `frontend/lib/edgeFunctions.ts` (YR volunteer) + `tmp-partner-admin/lib/youthRepublicFunctions.ts` (admin), both re-aligned to the final contract; `_shared/forms.ts` vendored byte-identical into each

### Phase F — reset & seed
- `backend/supabase/seed/reset.sql`, `tmp-partner-admin/supabase/seed/admin_reset.sql`, `backend/supabase/seed/seed.ts` (4 orgs + 6 opportunities + 1 chapter + the worked-example volunteer "Ayesha Khan" with applications / participations / hours / photos), `backend/supabase/seed/seed.test.ts` (post-seed smoke test)
- Written and type-checked; **not yet run** — first run is against the hosted projects at the deploy step.

---

## Review status

- **Every task** passed an individual spec-compliance + code-quality review with a fix loop. Two needed a fix round (`verify-volunteer` decision-enum guard; reset/seed idempotency) — both resolved and re-reviewed clean.
- **Whole-branch review (done):** verdict *"needs fixes before merge."* Schema, migration↔handler alignment, tenant authorization, and the seed↔smoke-test coherence all came back clean. The issues are listed below.

### Blocking issues (fix in progress)
1. **Registration doesn't close end-to-end** — `register-volunteer` needs an uploaded ID doc, but `request-attachment-upload` required a `volunteers` row that doesn't exist yet during signup. *(Fix being applied — allow a bare authenticated user for the `identity_doc` domain.)*
2. **IDOR in `request-attachment-upload`** — `ownerId` was accepted verbatim in the volunteer branches, so a volunteer could attach a file to another volunteer's record. *(Fix: bind `ownerId` to the requester / verify row ownership.)*
3. **`verify-hours` wrote `hours_verified = NULL`** when staff accept the submitted number as-is → verified totals read 0 for that session. *(One-line fix.)*
4. **Admin client `OpportunitySummary` still has `capacity`** — `list-opportunities` dropped it (new `OpportunityCard` shape + `facets`); a test fixture was masking the mismatch. *(Fix the client type + fixtures.)*
5. **`forms.ts` rejects an optional checkbox left unchecked** when the client sends `false`. *(Fix: only enforce required checkboxes.)*
6. **`verify_jwt` for the two anonymous endpoints** — hosted Supabase defaults to requiring a JWT, so `get-opportunity-detail` and the public `list-opportunities` would 401 at the gateway. *(Fix: `config.toml` + a public fallback in `list-opportunities/index.ts`. Deploy-blocking.)*

### Follow-ups being folded into the same fix batch
Dead-code deletion (`upload-cnic-document` + its now-broken frontend component), `apply-to-opportunity` status/attachment checks, `get-attachment` permission tightening, a shared PostgREST-error→404 helper, admin→YR branding sync (`moduleBackends.ts`), a few 400→422 status corrections, the seeded admin-staff permission grant, and stale-doc cleanup.

### Deferred to the YR frontend sub-project (not this branch)
`frontend/app/opportunities/[id]/page.tsx` and `profile/page.tsx` still select dropped columns (`eligibility_criteria`, `cnic_number`) → runtime errors; the 3 failing frontend tests + `tsc` errors are the expected no-compat-window cutover. All captured in `docs/backend-vs-prototype-gaps.md`.

---

## Prototype gap analysis — `docs/backend-vs-prototype-gaps.md`

Checked both prototypes (`demos/youth-republic/volunteer-prototype.html`, `demos/youth-republic/prototype.html`) against the contract. The seed's 6 opportunities + org mapping match the volunteer noticeboard exactly; the 12 form field types cover the apply form; the admin prototype maps cleanly onto the built endpoints. Three backend additions were needed (identity-doc upload for pre-registration users; org logo/brand-colour on the portfolio; a `change-password` endpoint) — all being folded into the branch now.

---

## Git / branch topology

- **YR:** `spec/backend-api-contract` @ pushed. `main` (`ff6fbc4`) is a strict ancestor — a fast-forward merge is possible, no rebase needed.
- **admin:** our 4 backend commits are on `origin/feat/backend-api-contract` and are ancestors of the Gemini agent's `feat/admin-ui-redesign` (which adds the admin-UI work + a handoff doc on top). Gemini already has every backend change.
- Every commit is pushed to origin as it lands.

## For the admin-UI (Gemini) agent
- The admin→YR contract lives in `tmp-partner-admin/lib/youthRepublicFunctions.ts` (re-aligned) + `tmp-partner-admin/lib/forms.ts` (vendored).
- The candidate-review / identity-verification drawer needs the staff token to carry `can_verify_identity` — `mint-staff-token` now emits it. Verify end-to-end after deploy.
- `OpportunitySummary` in the client is mid-fix (see blocker #4) — it will gain `orgName`/`orgLogoUrl`/`city`/`online`/`description` and lose `capacity`; capacity moves to `get-opportunity-detail`.
- The admin-platform-native screens (Team / Roles / Invite / staff password) are out of the YR contract — they use the admin project's own `staff` / `roles` / `modules` tables.

## Next steps (in order)
1. Finish the in-flight fix batch + re-review.
2. Deploy the edge functions to the hosted YR project (with the `verify_jwt` config).
3. Run `admin_reset.sql` → `reset.sql` → `seed.ts` → `seed.test.ts` against the hosted projects.
4. Hand over the "Ayesha Khan" demo login + org slugs; the existing admin / super-admin logins are unchanged.
5. Fast-forward `main` and close the branch.
