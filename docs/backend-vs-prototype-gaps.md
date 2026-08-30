# Backend ↔ prototype gap analysis

**Date:** 2026-08-31
**Backend reviewed:** `spec/backend-api-contract` branch (all 30 code tasks of the API-contract build, per-task reviewed).
**Prototypes reviewed:**
- `demos/youth-republic/volunteer-prototype.html` — Youth Republic volunteer app
- `demos/youth-republic/prototype.html` — partner-admin app (built by the Gemini agent on `tmp-partner-admin@feat/admin-ui-redesign`)

Legend: **[HIGH]** blocks a prototype flow · **[MED]** prototype renders something the API can't supply · **[NOTE]** frontend/design decision, no backend change.

---

## A. Backend changes needed (volunteer side)

### A1 · [HIGH] `request-attachment-upload` can't auth a pre-registration user uploading their ID doc
**Flow:** register step 2 chooses the CNIC/B-Form file, then "Create account" → the client must upload the doc **before** `register-volunteer` runs (it needs `idDocAttachmentId`). At that moment the user has a Supabase Auth account (from step 1) but **no `volunteers` row**.
**Problem:** `request-attachment-upload/index.ts` resolves the caller with `verifyVolunteerToken` (requires a `volunteers` row) → falls back to `verifyStaffToken`. A fresh signed-up user is neither → 401. This was flagged as a deferred concern during the build (B6 ledger); the prototype confirms it's a real blocker.
**Fix:** in `request-attachment-upload/index.ts`, when `domain === "identity_doc"` and `ownerType === "volunteer"`, accept a bare authenticated Supabase user: verify the JWT with `supabase.auth.getUser(jwt)`, set `uploaded_by` = that auth user id, and allow `ownerId` to be that auth user id as a placeholder. `register-volunteer` (Task 14) already (a) checks `uploaded_by === input.authUserId` and (b) re-points `attachments.owner_id` to the new volunteer id after insert — so no other change is needed. Keep the existing volunteer/staff paths for the other domains untouched.
**Files:** `backend/supabase/functions/request-attachment-upload/index.ts` (+ handler if the ownership branch lives there) + its `handler.test.ts`.

### A2 · [MED] `get-volunteer-portfolio` omits org branding on applications and programmes
**Prototype:** every Applications row and every Impact programme card shows the org logo **and** a per-org brand-colour keyline (`style="--lb:#8A7A10"` etc.).
**Current handler** (`get-volunteer-portfolio/handler.ts`):
- applications join = `organizations(name)` — no `logo_url`, no `brand_color`
- participation join = `organizations(name, logo_url)` — no `brand_color`
**Fix:** add `logo_url, brand_color` to both embedded selects; add `orgLogoUrl: string | null` + `orgBrandColor: string | null` to `PortfolioApplication`, and `orgBrandColor: string | null` to `PortfolioProgramme`. Mirror the type changes in `youth-republic/frontend/lib/edgeFunctions.ts`.
**Files:** `backend/supabase/functions/get-volunteer-portfolio/{handler,handler.test}.ts`, `frontend/lib/edgeFunctions.ts`.

### A3 · [MED] No "change password" endpoint
**Prototype:** portfolio has a "Change password" modal with **current password**, new, confirm.
**Problem:** Supabase client `auth.updateUser({ password })` updates the password using the active session but **does not verify the current password**. Nothing in the contract covers this.
**Decision needed — pick one:**
- **(a) simplest:** drop the "current password" field; the frontend calls `supabase.auth.updateUser({ password })` directly. No backend work.
- **(b) enforce current password:** add a `change-password` edge function — re-verify via `signInWithPassword(email, currentPassword)`, then `auth.admin.updateUserById(id, { password: newPassword })`. ~1 small function.
**Recommendation:** (a) unless product wants the current-password check for security theatre parity with the admin side.

---

## B. Frontend / design decisions (no backend change — flag to the YR frontend sub-project)

### B1 · Apply form: name / phone / email are display-only
`apply-to-opportunity` promotes `applicant_name / applicant_email / applicant_phone` **from the volunteer row**, not from `answers`. The apply form's editable name/phone/email inputs have no backend effect. Pre-fill them read-only, or add "these come from your profile" copy with a link to profile editing (`update-profile-field` / `update-sensitive-field`).

### B2 · Apply form: "Emergency contact name / phone"
`emergency_contact` is a `SensitiveFieldName` on the **volunteer profile**, not an application field. Decide:
- capture it as a dynamic-form field so it lands in `applications.answers` (per-application, visible to the org in triage) — **recommended**, or
- write it to the volunteer profile via `update-sensitive-field` on submit (one value, not per-application).

### B3 · Log-hours modal has no photo upload
The modal collects programme / date / hours / "what you did" only, but the portfolio **displays** session photos. `submit-hours` already accepts `attachmentIds` (domain `session_photo`). Add a file input → `request-attachment-upload`(session_photo) → PUT → `finalize-attachment` → `submit-hours({ …, attachmentIds })`. Backend is ready; frontend needs the control.

### B4 · Dynamic-form field types — fully covered
The apply form exercises: short text, long text, email, phone, url, number, date, select (dropdown), radio (single choice), multiselect (day checkboxes), file, consent checkbox. All 12 are in `_shared/forms.ts` `FieldType`. The admin form builder advertises "short text, long essays, checkboxes, dropdowns, file uploads" — a strict subset. No new field types required.

### B5 · Sample-data mismatches (cosmetic)
- Portfolio prototype shows a programme "Digital Literacy Workshop"; the seed substitutes "Tree Plantation Weekend" (the noticeboard has 6 opportunities and no "Digital Literacy"). The smoke test asserts counts, not names. If the portfolio's exact copy matters, rename the 6th opportunity consistently across both prototypes and the seed.
- Portfolio tiles show "6 Completed programmes" while only 3 completed cards render — prototype copy inconsistency; `totals.completedProgrammes` is a real count. No action.

---

## C. Admin prototype ↔ contract (partner-admin, for the Gemini agent)

The admin prototype maps cleanly onto the built contract. No missing endpoints found in this pass:

| Admin screen | Backend |
|---|---|
| Operations Command Center (KPIs) | `get-kpi-summary` (YR, existing) |
| Opportunities Noticeboard | `list-opportunities` (staff variant — org-scoped, sees deactivated) |
| Create Opportunity + Custom Application Questions builder | `create-opportunity` / `update-opportunity` (+ `about`/`duties`/`eligibility`/`whatToBring`/`applicationForm`), `update-opportunity-form` |
| Applications Triage (answers + uploaded IDs + decision) | `list-applications` (+ `answers`, `formSnapshot`, `attachmentIdsByField`, `applicant*`), `get-attachment`, `decide-application` (existing) |
| Hours Verification Queue + Verify & Adjust drawer | `list-activity-hours`, `verify-hours` / `bulk-assign-hours` (now write `admin_action_log`) |
| Volunteers Directory + candidate review drawer | `list-volunteers`, `get-volunteer-detail` (+ `answers`/`formSnapshot`/`note`/`adjusted`/`photoAttachmentIds`), `list-pending-volunteers`, `verify-volunteer` (gated on `canVerifyIdentity`), `get-attachment` (identity_doc) |
| Team Members / Invite / Edit Access / Create Custom Role | **admin-platform native** — `staff` / `roles` / `role_permissions` / `modules` / `org_modules` on the admin project; not part of the YR contract |
| Change Account Password (staff) | admin-platform auth — separate from the volunteer A3 above |

**Caveats for the admin agent:**
- The staff token must carry `can_verify_identity` for the candidate-review drawer to work — `mint-staff-token` now emits it (`can_verify_identity || platform_owner`). Its behaviour test wasn't run during the build; verify end-to-end after deploy.
- `get-attachment` lets org staff read `session_photo` and `application_file` attachments scoped to `attachments.organization_id`; `identity_doc` requires `canVerifyIdentity`. Cross-org staff are denied.
- A deeper field-by-field pass of the admin drawers (Verify & Adjust, candidate review) against `youthRepublicFunctions.ts` response shapes is still worth doing once Gemini's screens stabilise.

---

## D. Priority order

1. **A1** — without it, registration can't attach an ID doc. Do this before the deploy/seed step or the register flow is dead.
2. **A2** — small, and the portfolio looks broken (no logos/colours) without it.
3. **A3** — decide (a) vs (b); (a) is zero backend work.
4. **B1–B3** — hand to the YR frontend sub-project as build notes.
