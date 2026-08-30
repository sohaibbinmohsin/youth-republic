# Backend & API Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `youth-republic/backend/supabase` (schema + edge functions) so both frontends can implement every interaction in the Wave-1 prototype and the admin form-builder that feeds it.

**Architecture:** Additive Postgres migrations + a shared framework-agnostic form-validation module + new and changed Supabase Edge Functions, all against the single youth-republic backend that both the public app and the admin app call. Clean break: signatures and columns change in place, no compatibility shims; the migration, the edge functions, both frontends' typed API clients, and a reset+seed step land together on one branch.

**Tech Stack:** Supabase (Postgres 15, Storage, Auth), Deno edge functions, `@supabase/supabase-js` (service-role client), pgTAP for DB tests, `Deno.test` for function + module tests. TypeScript throughout.

**Spec:** `youth-republic/docs/superpowers/specs/2026-08-30-backend-api-contract-design.md` — read it alongside this plan.

## Global Constraints

- All new code is TypeScript. Deno functions: `functions/<name>/{index.ts,handler.ts}` + `handler.test.ts` (+ `index.test.ts` where one already exists for the function being changed).
- `handler.ts` is a pure function `(_supabase: SupabaseClient, ..., input: TypedInput) => Promise<TypedResult>`. It **derives ownership and org from DB rows, never from client-supplied fields**. `index.ts` does CORS (`handleCorsPreflight`, `corsHeaders`), rate limiting (`checkRateLimit`), auth extraction (`verifyVolunteerToken` for volunteer endpoints, `verifyStaffToken` for staff endpoints), JSON parse, calls the handler, maps errors to status: `unauthorized`→401, `forbidden`→403, `not_found`→404, validation→422, everything else→400. Follow the exact shape in `functions/apply-to-opportunity/index.ts`.
- Staff permission checks use `staffHasPermission(claims, orgId, "youth-republic", "<resource>:<action>")` from `_shared/verifyStaffToken.ts`.
- Migrations: one file per change, `supabase/migrations/NNNN_<name>.sql`, numbered sequentially after `0015` (YR) / `0011` (admin). Every migration gets a pgTAP test in `supabase/tests/database/<name>_test.sql` following the style of `supabase/tests/database/activity_hours_test.sql`.
- Money/PII rule: identity-doc attachments never carry an `organization_id`; every attachment read goes through `get-attachment`.
- Hex colour format: `^#[0-9A-Fa-f]{6}$`.
- No compatibility window. After this branch merges, nothing calls an old signature.
- Commit after every green step. Conventional-commit prefixes (`feat:`, `test:`, `refactor:`, `chore:`, `docs:`). End commit messages with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `backend/supabase/functions/_shared/forms.ts` | Field-type registry; `validateFormDefinition`, `validateAnswers`, `resolveConsent`. Imported by edge functions and vendored by both frontends. |
| `backend/supabase/functions/_shared/forms.test.ts` | Unit tests for the above. |
| `backend/supabase/migrations/0016_organizations_branding.sql` | `organizations` branding columns + `org_branding` view + anon grant (YR). |
| `backend/supabase/migrations/0017_opportunities_content.sql` | `opportunities` content sections + `application_form`; drop `eligibility_criteria`. |
| `backend/supabase/migrations/0018_applications_dynamic_form.sql` | `applications`: drop `motivation_statement`; add `answers`, `form_snapshot`, promoted columns. |
| `backend/supabase/migrations/0019_activity_hours_sessions.sql` | `activity_hours`: add `note`; status enum → `pending/verified/rejected`, default `pending`. |
| `backend/supabase/migrations/0020_attachments.sql` | `attachments` table; three private Storage buckets. |
| `backend/supabase/migrations/0021_volunteer_id_doc.sql` | `volunteers`: `cnic_number`→`id_doc_number`, add `id_doc_type`, drop `cnic_document_url`; fix `profile_field_changes` check. |
| `backend/supabase/functions/request-attachment-upload/{index,handler,handler.test}.ts` | Validate domain limits + writer permission; create `attachments` row (`pending`); return signed upload URL. |
| `backend/supabase/functions/finalize-attachment/{index,handler,handler.test}.ts` | Verify the uploaded object; flip row to `ready`. |
| `backend/supabase/functions/get-attachment/{index,handler,handler.test}.ts` | Permission matrix per domain; return signed download URL. |
| `backend/supabase/functions/verify-volunteer/{index,handler,handler.test}.ts` | Central team: verify / reject-with-reason. |
| `backend/supabase/functions/list-pending-volunteers/{index,handler,handler.test}.ts` | Central team: verification queue. |
| `backend/supabase/functions/get-volunteer-portfolio/{index,handler,handler.test}.ts` | The Impact screen in one call. |
| `backend/supabase/functions/get-opportunity-detail/{index,handler,handler.test}.ts` | Public opportunity detail incl. content sections + form. |
| `backend/supabase/functions/update-opportunity-form/{index,handler,handler.test}.ts` | Staff: set `opportunities.application_form`. |
| `backend/supabase/seed/reset.sql` | Truncate YR volunteer-domain data + orgs; empty buckets. |
| `backend/supabase/seed/seed.ts` | Deno script: orgs, opportunities, chapter, worked-example volunteer + portfolio; prints credentials. |
| `backend/supabase/seed/seed.test.ts` | Post-seed smoke assertions. |
| `tmp-partner-admin/supabase/migrations/0012_organizations_branding_and_identity_verifier.sql` | Admin DB: `organizations` branding columns + `staff.can_verify_identity`. |

**Modified files:**

| Path | Change |
|---|---|
| `backend/supabase/functions/register-volunteer/handler.ts` + tests | Add `idDocType`, `idDocNumber`, `idDocAttachmentId`; re-point the identity attachment. |
| `backend/supabase/functions/apply-to-opportunity/handler.ts` + tests | `answers` + `attachmentIds`; validate against the opportunity's form; snapshot it; promote columns; link attachments. |
| `backend/supabase/functions/submit-hours/handler.ts` + tests | Add `note`, `attachmentIds` (session photos); insert as `pending`. |
| `backend/supabase/functions/verify-hours/handler.ts` + tests | Write `admin_action_log` (`hours_verified`/`hours_adjusted`/`hours_rejected`). |
| `backend/supabase/functions/bulk-assign-hours/handler.ts` + tests | Same audit-log behaviour. |
| `backend/supabase/functions/create-opportunity/handler.ts` + tests | Accept `about`, `duties`, `eligibility`, `whatToBring`, `applicationForm`; drop `eligibilityCriteria`. |
| `backend/supabase/functions/update-opportunity/handler.ts` + tests | Same fields. |
| `backend/supabase/functions/list-opportunities/handler.ts` + tests | Add `organizationId?/city?/online?/search?/sort?`; add `facets`; public (anon) variant. |
| `backend/supabase/functions/list-applications/handler.ts` + tests | Project `applicant_*`, `answers`, `form_snapshot`, grouped attachment ids. |
| `backend/supabase/functions/get-volunteer-detail/handler.ts` + tests | Per-application `answers`/`form_snapshot`; per-session `note`/`adjusted`/`photoAttachmentIds`. |
| `backend/supabase/functions/sync-organization/handler.ts` + tests | Widen payload with `brandColor`, `logoUrl`, `faviconUrl`, `about`. |
| `tmp-partner-admin/supabase/functions/mint-staff-token/handler.ts` + tests | Add `canVerifyIdentity` to the minted claims. |
| `backend/supabase/functions/_shared/verifyStaffToken.ts` + tests | Expose `canVerifyIdentity` on `StaffClaims`. |
| `youth-republic/frontend/lib/edgeFunctions.ts` + tests | Bring typed client in line with new signatures. |
| `tmp-partner-admin/lib/youthRepublicFunctions.ts` + tests | Bring typed client in line with new signatures. |

---

## Phase A — Shared module & migrations

### Task 1: Shared form module — types & `validateFormDefinition`

**Files:**
- Create: `backend/supabase/functions/_shared/forms.ts`
- Test: `backend/supabase/functions/_shared/forms.test.ts`

**Interfaces:**
- Produces: `FieldType`, `FieldDef`, `FormDefinition`, `FieldErrors` types; `validateFormDefinition(def: unknown): { ok: true; def: FormDefinition } | { ok: false; errors: string[] }`.

- [ ] **Step 1: Write the failing tests**

```ts
// backend/supabase/functions/_shared/forms.test.ts
import { assertEquals } from "jsr:@std/assert";
import { validateFormDefinition } from "./forms.ts";

const good = {
  version: 1,
  fields: [
    { id: "why", type: "long_text", label: "Why?", required: true, maxLength: 2000 },
    { id: "days", type: "multiselect", label: "Days", options: [{ value: "wk", label: "Weekend" }] },
    { id: "cv", type: "file", label: "CV", accept: ["application/pdf"], maxFiles: 2, maxSizeMB: 10 },
    { id: "consent", type: "checkbox", label: "I confirm", required: true },
  ],
};

Deno.test("valid definition round-trips", () => {
  const r = validateFormDefinition(good);
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.def.fields.length, 4);
});

Deno.test("rejects duplicate field ids", () => {
  const r = validateFormDefinition({ version: 1, fields: [
    { id: "a", type: "short_text", label: "A" }, { id: "a", type: "short_text", label: "B" }] });
  assertEquals(r.ok, false);
});

Deno.test("rejects unknown field type", () => {
  const r = validateFormDefinition({ version: 1, fields: [{ id: "a", type: "signature", label: "A" }] });
  assertEquals(r.ok, false);
});

Deno.test("rejects choice field without options", () => {
  const r = validateFormDefinition({ version: 1, fields: [{ id: "a", type: "select", label: "A" }] });
  assertEquals(r.ok, false);
});

Deno.test("rejects file accept outside the application_file allowlist", () => {
  const r = validateFormDefinition({ version: 1, fields: [
    { id: "a", type: "file", label: "A", accept: ["application/zip"] }] });
  assertEquals(r.ok, false);
});

Deno.test("rejects number field with min > max", () => {
  const r = validateFormDefinition({ version: 1, fields: [
    { id: "a", type: "number", label: "A", min: 10, max: 5 }] });
  assertEquals(r.ok, false);
});

Deno.test("rejects more than one required checkbox", () => {
  const r = validateFormDefinition({ version: 1, fields: [
    { id: "c1", type: "checkbox", label: "A", required: true },
    { id: "c2", type: "checkbox", label: "B", required: true }] });
  assertEquals(r.ok, false);
});

Deno.test("rejects non-object / missing version", () => {
  assertEquals(validateFormDefinition(null).ok, false);
  assertEquals(validateFormDefinition({ fields: [] }).ok, false);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd backend/supabase && deno test functions/_shared/forms.test.ts`
Expected: FAIL — `Module not found "./forms.ts"`.

- [ ] **Step 3: Implement `forms.ts` (types + `validateFormDefinition`)**

```ts
// backend/supabase/functions/_shared/forms.ts

export type FieldType =
  | "short_text" | "long_text" | "email" | "phone" | "url"
  | "number" | "date" | "select" | "multiselect" | "radio"
  | "checkbox" | "file";

export const FIELD_TYPES: readonly FieldType[] = [
  "short_text", "long_text", "email", "phone", "url",
  "number", "date", "select", "multiselect", "radio", "checkbox", "file",
];

const CHOICE_TYPES: FieldType[] = ["select", "multiselect", "radio"];

// Must stay a subset of the `application_file` domain allowlist in the spec.
export const APPLICATION_FILE_MIME_ALLOWLIST: readonly string[] = [
  "image/jpeg", "image/png", "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export interface FieldDef {
  id: string;
  type: FieldType;
  label: string;
  help?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  minDate?: string;
  maxDate?: string;
  minLength?: number;
  maxLength?: number;
  accept?: string[];
  maxSizeMB?: number;
  maxFiles?: number;
}

export interface FormDefinition {
  version: 1;
  fields: FieldDef[];
}

export type FieldErrors = Record<string, string>;

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateFormDefinition(
  raw: unknown,
): { ok: true; def: FormDefinition } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) return { ok: false, errors: ["definition must be an object"] };
  const def = raw as Record<string, unknown>;
  if (def.version !== 1) errors.push("version must be 1");
  if (!Array.isArray(def.fields)) return { ok: false, errors: ["fields must be an array"] };

  const seen = new Set<string>();
  let requiredCheckboxes = 0;

  (def.fields as unknown[]).forEach((f, i) => {
    if (typeof f !== "object" || f === null) { errors.push(`field ${i} must be an object`); return; }
    const field = f as Record<string, unknown>;
    const id = field.id;
    if (typeof id !== "string" || !ID_RE.test(id)) errors.push(`field ${i}: invalid id`);
    else if (seen.has(id)) errors.push(`field ${i}: duplicate id "${id}"`);
    else seen.add(id);

    if (typeof field.label !== "string" || field.label.trim() === "") errors.push(`field ${i}: label required`);
    if (!FIELD_TYPES.includes(field.type as FieldType)) { errors.push(`field ${i}: unknown type`); return; }
    const type = field.type as FieldType;

    if (CHOICE_TYPES.includes(type)) {
      const opts = field.options;
      if (!Array.isArray(opts) || opts.length === 0) errors.push(`field ${i}: options required for ${type}`);
      else if (!opts.every((o) => o && typeof (o as Record<string, unknown>).value === "string" &&
                                   typeof (o as Record<string, unknown>).label === "string")) {
        errors.push(`field ${i}: each option needs value and label`);
      }
    }
    if (type === "number") {
      if (field.min !== undefined && typeof field.min !== "number") errors.push(`field ${i}: min must be a number`);
      if (field.max !== undefined && typeof field.max !== "number") errors.push(`field ${i}: max must be a number`);
      if (typeof field.min === "number" && typeof field.max === "number" && field.min > field.max) {
        errors.push(`field ${i}: min > max`);
      }
    }
    if (type === "date") {
      for (const k of ["minDate", "maxDate"] as const) {
        if (field[k] !== undefined && (typeof field[k] !== "string" || !ISO_DATE_RE.test(field[k] as string))) {
          errors.push(`field ${i}: ${k} must be yyyy-mm-dd`);
        }
      }
    }
    if (type === "short_text" || type === "long_text") {
      if (typeof field.minLength === "number" && typeof field.maxLength === "number" && field.minLength > field.maxLength) {
        errors.push(`field ${i}: minLength > maxLength`);
      }
    }
    if (type === "file") {
      const accept = field.accept;
      if (accept !== undefined) {
        if (!Array.isArray(accept) || !accept.every((m) => typeof m === "string")) {
          errors.push(`field ${i}: accept must be an array of MIME strings`);
        } else if (!accept.every((m) => APPLICATION_FILE_MIME_ALLOWLIST.includes(m as string))) {
          errors.push(`field ${i}: accept contains a MIME type outside the allowlist`);
        }
      }
      if (field.maxFiles !== undefined && (typeof field.maxFiles !== "number" || field.maxFiles < 1)) {
        errors.push(`field ${i}: maxFiles must be >= 1`);
      }
      if (field.maxSizeMB !== undefined && (typeof field.maxSizeMB !== "number" || field.maxSizeMB <= 0 || field.maxSizeMB > 10)) {
        errors.push(`field ${i}: maxSizeMB must be in (0, 10]`);
      }
    }
    if (type === "checkbox" && field.required === true) requiredCheckboxes++;
  });

  if (requiredCheckboxes > 1) errors.push("at most one required checkbox (the consent field) is allowed");

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, def: def as unknown as FormDefinition };
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd backend/supabase && deno test functions/_shared/forms.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/functions/_shared/forms.ts backend/supabase/functions/_shared/forms.test.ts
git commit -m "feat: shared form-definition types and validator

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Shared form module — `validateAnswers` & `resolveConsent`

**Files:**
- Modify: `backend/supabase/functions/_shared/forms.ts`
- Test: `backend/supabase/functions/_shared/forms.test.ts` (append)

**Interfaces:**
- Consumes: `FormDefinition`, `FieldErrors` from Task 1.
- Produces: `validateAnswers(def: FormDefinition, answers: unknown): { ok: true } | { ok: false; fieldErrors: FieldErrors }`; `resolveConsent(def: FormDefinition, answers: Record<string, unknown>): boolean`.

- [ ] **Step 1: Append failing tests**

```ts
// append to forms.test.ts
import { validateAnswers, resolveConsent } from "./forms.ts";

const def = {
  version: 1 as const,
  fields: [
    { id: "email", type: "email" as const, label: "Email", required: true },
    { id: "age", type: "number" as const, label: "Age", min: 16, max: 99 },
    { id: "start", type: "date" as const, label: "Start", minDate: "2024-01-01" },
    { id: "role", type: "radio" as const, label: "Role", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
    { id: "days", type: "multiselect" as const, label: "Days", options: [{ value: "x", label: "X" }, { value: "y", label: "Y" }] },
    { id: "cv", type: "file" as const, label: "CV", maxFiles: 2 },
    { id: "consent", type: "checkbox" as const, label: "I confirm", required: true },
  ],
};

Deno.test("valid answers pass", () => {
  const r = validateAnswers(def, {
    email: "a@b.com", age: 20, start: "2024-06-01", role: "a", days: ["x"], cv: ["att-1"], consent: true,
  });
  assertEquals(r.ok, true);
});

Deno.test("missing required field", () => {
  const r = validateAnswers(def, { age: 20, consent: true });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(Object.keys(r.fieldErrors).includes("email"), true);
});

Deno.test("bad email", () => {
  const r = validateAnswers(def, { email: "nope", consent: true });
  assertEquals(r.ok, false);
});

Deno.test("number out of range", () => {
  const r = validateAnswers(def, { email: "a@b.com", age: 5, consent: true });
  assertEquals((r as { fieldErrors: Record<string, string> }).fieldErrors.age !== undefined, true);
});

Deno.test("date before minDate", () => {
  const r = validateAnswers(def, { email: "a@b.com", start: "2023-01-01", consent: true });
  assertEquals((r as { fieldErrors: Record<string, string> }).fieldErrors.start !== undefined, true);
});

Deno.test("radio value not in options", () => {
  const r = validateAnswers(def, { email: "a@b.com", role: "z", consent: true });
  assertEquals((r as { fieldErrors: Record<string, string> }).fieldErrors.role !== undefined, true);
});

Deno.test("multiselect must be an array of known options", () => {
  const r = validateAnswers(def, { email: "a@b.com", days: "x", consent: true });
  assertEquals((r as { fieldErrors: Record<string, string> }).fieldErrors.days !== undefined, true);
});

Deno.test("file over maxFiles", () => {
  const r = validateAnswers(def, { email: "a@b.com", cv: ["a", "b", "c"], consent: true });
  assertEquals((r as { fieldErrors: Record<string, string> }).fieldErrors.cv !== undefined, true);
});

Deno.test("required consent not accepted", () => {
  const r = validateAnswers(def, { email: "a@b.com", consent: false });
  assertEquals(r.ok, false);
});

Deno.test("resolveConsent reads the required checkbox", () => {
  assertEquals(resolveConsent(def, { consent: true }), true);
  assertEquals(resolveConsent(def, { consent: false }), false);
  assertEquals(resolveConsent({ version: 1, fields: [] }, {}), false);
});
```

- [ ] **Step 2: Run, confirm failure** — `deno test functions/_shared/forms.test.ts` → FAIL (`validateAnswers` not exported).

- [ ] **Step 3: Implement**

```ts
// append to forms.ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/i;

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || v === "" ||
    (Array.isArray(v) && v.length === 0);
}

export function validateAnswers(
  def: FormDefinition,
  raw: unknown,
): { ok: true } | { ok: false; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const answers = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  for (const field of def.fields) {
    const v = answers[field.id];

    if (isBlank(v)) {
      if (field.required) {
        fieldErrors[field.id] = field.type === "checkbox"
          ? "You must accept this to continue."
          : "This field is required.";
      }
      continue;
    }

    switch (field.type) {
      case "email":
        if (typeof v !== "string" || !EMAIL_RE.test(v)) fieldErrors[field.id] = "Enter a valid email address.";
        break;
      case "url":
        if (typeof v !== "string" || !URL_RE.test(v)) fieldErrors[field.id] = "Enter a valid URL starting with http.";
        break;
      case "phone":
      case "short_text":
      case "long_text": {
        if (typeof v !== "string") { fieldErrors[field.id] = "Invalid value."; break; }
        if (typeof field.minLength === "number" && v.length < field.minLength) fieldErrors[field.id] = `Must be at least ${field.minLength} characters.`;
        if (typeof field.maxLength === "number" && v.length > field.maxLength) fieldErrors[field.id] = `Must be at most ${field.maxLength} characters.`;
        break;
      }
      case "number": {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) { fieldErrors[field.id] = "Enter a number."; break; }
        if (typeof field.min === "number" && n < field.min) fieldErrors[field.id] = `Must be at least ${field.min}.`;
        if (typeof field.max === "number" && n > field.max) fieldErrors[field.id] = `Must be at most ${field.max}.`;
        break;
      }
      case "date": {
        if (typeof v !== "string" || !ISO_DATE_RE.test(v)) { fieldErrors[field.id] = "Enter a valid date."; break; }
        if (field.minDate && v < field.minDate) fieldErrors[field.id] = `Must be on or after ${field.minDate}.`;
        if (field.maxDate && v > field.maxDate) fieldErrors[field.id] = `Must be on or before ${field.maxDate}.`;
        break;
      }
      case "select":
      case "radio": {
        const allowed = (field.options ?? []).map((o) => o.value);
        if (typeof v !== "string" || !allowed.includes(v)) fieldErrors[field.id] = "Choose one of the options.";
        break;
      }
      case "multiselect": {
        const allowed = (field.options ?? []).map((o) => o.value);
        if (!Array.isArray(v) || !v.every((x) => typeof x === "string" && allowed.includes(x))) {
          fieldErrors[field.id] = "Choose from the options.";
        }
        break;
      }
      case "checkbox":
        if (v !== true) fieldErrors[field.id] = "You must accept this to continue.";
        break;
      case "file": {
        if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) { fieldErrors[field.id] = "Invalid attachments."; break; }
        const max = field.maxFiles ?? 1;
        if (v.length > max) fieldErrors[field.id] = `Attach at most ${max} file${max === 1 ? "" : "s"}.`;
        break;
      }
    }
  }

  return Object.keys(fieldErrors).length === 0 ? { ok: true } : { ok: false, fieldErrors };
}

export function resolveConsent(def: FormDefinition, answers: Record<string, unknown>): boolean {
  const consent = def.fields.find((f) => f.type === "checkbox" && f.required);
  return consent ? answers[consent.id] === true : false;
}
```

- [ ] **Step 4: Run tests, confirm pass** — `deno test functions/_shared/forms.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/functions/_shared/forms.ts backend/supabase/functions/_shared/forms.test.ts
git commit -m "feat: validateAnswers and resolveConsent for dynamic forms

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Migration — `organizations` branding + `org_branding` view

**Files:**
- Create: `backend/supabase/migrations/0016_organizations_branding.sql`
- Test: `backend/supabase/tests/database/organizations_branding_test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

```sql
-- backend/supabase/tests/database/organizations_branding_test.sql
begin;
select plan(6);

select has_column('organizations', 'brand_color', 'organizations.brand_color exists');
select has_column('organizations', 'logo_url', 'organizations.logo_url exists');
select has_column('organizations', 'favicon_url', 'organizations.favicon_url exists');
select has_column('organizations', 'about', 'organizations.about exists');

select lives_ok(
  $$ insert into organizations (id, name, slug, brand_color)
     values ('00000000-0000-0000-0000-0000000000aa', 'T', 't-slug', '#D3BD2A') $$,
  'valid hex brand_color accepted');

select throws_ok(
  $$ insert into organizations (id, name, slug, brand_color)
     values ('00000000-0000-0000-0000-0000000000ab', 'T2', 't-slug-2', 'gold') $$,
  null, null, 'non-hex brand_color rejected');

select * from finish();
rollback;
```

- [ ] **Step 2: Run, confirm failure**

Run: `cd backend/supabase && supabase test db` (or the repo's DB-test command — check `README.md` / `config.toml`; other tests run the same way).
Expected: FAIL — `column "brand_color" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- backend/supabase/migrations/0016_organizations_branding.sql
alter table organizations
  add column brand_color text check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column logo_url text,
  add column favicon_url text,
  add column about text;

create view org_branding as
  select id, name, slug, brand_color, logo_url, favicon_url, about
  from organizations
  where deactivated_at is null;

grant select on org_branding to anon, authenticated;
```

- [ ] **Step 4: Run tests, confirm pass** — `supabase test db` → the new file passes; existing `organizations_test.sql` still passes.

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0016_organizations_branding.sql backend/supabase/tests/database/organizations_branding_test.sql
git commit -m "feat(db): organizations branding columns and org_branding view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Migration — `opportunities` content sections + `application_form`

**Files:**
- Create: `backend/supabase/migrations/0017_opportunities_content.sql`
- Test: `backend/supabase/tests/database/opportunities_content_test.sql`

- [ ] **Step 1: Failing pgTAP test**

```sql
-- backend/supabase/tests/database/opportunities_content_test.sql
begin;
select plan(7);

select has_column('opportunities', 'about', 'opportunities.about exists');
select has_column('opportunities', 'duties', 'opportunities.duties exists');
select has_column('opportunities', 'eligibility', 'opportunities.eligibility exists');
select has_column('opportunities', 'what_to_bring', 'opportunities.what_to_bring exists');
select has_column('opportunities', 'application_form', 'opportunities.application_form exists');
select hasnt_column('opportunities', 'eligibility_criteria', 'old eligibility_criteria dropped');

select is(
  (select application_form from opportunities
     where id = (insert into opportunities (organization_id, name, type)
                 values ('00000000-0000-0000-0000-0000000000aa','O','community') returning id)),
  '{"version": 1, "fields": []}'::jsonb,
  'application_form defaults to an empty form');

select * from finish();
rollback;
```

- [ ] **Step 2: Run, confirm failure** — `column "about" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- backend/supabase/migrations/0017_opportunities_content.sql
alter table opportunities
  add column about text,
  add column duties text[] not null default '{}',
  add column eligibility text[] not null default '{}',
  add column what_to_bring text[] not null default '{}',
  add column application_form jsonb not null default '{"version": 1, "fields": []}'::jsonb;

alter table opportunities drop column eligibility_criteria;
```

- [ ] **Step 4: Run tests, confirm pass.**

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0017_opportunities_content.sql backend/supabase/tests/database/opportunities_content_test.sql
git commit -m "feat(db): opportunity content sections and application_form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Migration — `applications` dynamic-form columns

**Files:**
- Create: `backend/supabase/migrations/0018_applications_dynamic_form.sql`
- Test: `backend/supabase/tests/database/applications_dynamic_form_test.sql`

- [ ] **Step 1: Failing pgTAP test**

```sql
-- backend/supabase/tests/database/applications_dynamic_form_test.sql
begin;
select plan(6);

select hasnt_column('applications', 'motivation_statement', 'motivation_statement dropped');
select has_column('applications', 'answers', 'answers exists');
select has_column('applications', 'form_snapshot', 'form_snapshot exists');
select has_column('applications', 'applicant_name', 'applicant_name exists');
select has_column('applications', 'applicant_email', 'applicant_email exists');
select col_not_null('applications', 'consent_accepted', 'consent_accepted is NOT NULL');

select * from finish();
rollback;
```

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Write the migration**

```sql
-- backend/supabase/migrations/0018_applications_dynamic_form.sql
alter table applications drop column motivation_statement;

alter table applications
  add column answers jsonb not null default '{}'::jsonb,
  add column form_snapshot jsonb not null default '{"version": 1, "fields": []}'::jsonb,
  add column applicant_name text,
  add column applicant_email text,
  add column applicant_phone text,
  add column consent_accepted boolean not null default false;
```

- [ ] **Step 4: Run tests, confirm pass.**

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0018_applications_dynamic_form.sql backend/supabase/tests/database/applications_dynamic_form_test.sql
git commit -m "feat(db): dynamic-form columns on applications

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Migration — `activity_hours` sessions (`note`, status enum)

**Files:**
- Create: `backend/supabase/migrations/0019_activity_hours_sessions.sql`
- Test: `backend/supabase/tests/database/activity_hours_sessions_test.sql`

- [ ] **Step 1: Failing pgTAP test**

```sql
-- backend/supabase/tests/database/activity_hours_sessions_test.sql
begin;
select plan(4);

select has_column('activity_hours', 'note', 'activity_hours.note exists');

-- seed a participation to hang hours off
insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
  values (gen_random_uuid(), 'S', 's@x.com', '111', '1990-01-01', 'other', 'C', 'P', 'PK', 'I', 'D');
insert into opportunities (id, organization_id, name, type)
  values ('00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000aa', 'O', 'community');
insert into participation (id, volunteer_id, opportunity_id, organization_id)
  select '00000000-0000-0000-0000-0000000000dd', id, '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000aa'
  from volunteers where email = 's@x.com';

select is(
  (insert into activity_hours (participation_id, volunteer_id, opportunity_id, organization_id, activity_date, hours_submitted)
   select '00000000-0000-0000-0000-0000000000dd', v.id, '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000aa', '2024-01-01', 4
   from volunteers v where v.email = 's@x.com'
   returning verification_status),
  'pending', 'new session defaults to pending');

select throws_ok(
  $$ update activity_hours set verification_status = 'recorded' $$,
  null, null, 'recorded is no longer an allowed status');

select lives_ok(
  $$ update activity_hours set verification_status = 'verified', hours_verified = 4 $$,
  'verified still allowed');

select * from finish();
rollback;
```

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Write the migration**

```sql
-- backend/supabase/migrations/0019_activity_hours_sessions.sql
alter table activity_hours add column note text;

alter table activity_hours alter column verification_status set default 'pending';
alter table activity_hours drop constraint activity_hours_verification_status_check;
alter table activity_hours add constraint activity_hours_verification_status_check
  check (verification_status in ('pending', 'verified', 'rejected'));
```

- [ ] **Step 4: Run tests, confirm pass.** Also run `activity_hours_test.sql` — update any assertion there that still expects `recorded`.

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0019_activity_hours_sessions.sql backend/supabase/tests/database/activity_hours_sessions_test.sql backend/supabase/tests/database/activity_hours_test.sql
git commit -m "feat(db): activity_hours note column and pending-default status

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Migration — `attachments` table + Storage buckets

**Files:**
- Create: `backend/supabase/migrations/0020_attachments.sql`
- Test: `backend/supabase/tests/database/attachments_test.sql`

- [ ] **Step 1: Failing pgTAP test**

```sql
-- backend/supabase/tests/database/attachments_test.sql
begin;
select plan(5);

select has_table('attachments', 'attachments table exists');

select throws_ok(
  $$ insert into attachments (domain, owner_type, owner_id, bucket, storage_path, mime_type, size_bytes, uploaded_by)
     values ('bad', 'volunteer', gen_random_uuid(), 'b', 'p', 'image/png', 1, gen_random_uuid()) $$,
  null, null, 'domain check rejects unknown domain');

select throws_ok(
  $$ insert into attachments (domain, owner_type, owner_id, bucket, storage_path, mime_type, size_bytes, uploaded_by)
     values ('session_photo', 'nope', gen_random_uuid(), 'b', 'p', 'image/png', 1, gen_random_uuid()) $$,
  null, null, 'owner_type check rejects unknown type');

select is(
  (insert into attachments (domain, owner_type, owner_id, bucket, storage_path, mime_type, size_bytes, uploaded_by)
   values ('session_photo', 'activity_hours', gen_random_uuid(), 'session-photos', 'p', 'image/png', 1, gen_random_uuid())
   returning status),
  'pending', 'status defaults to pending');

select bag_eq(
  $$ select id from storage.buckets where id in ('identity-docs','application-files','session-photos') $$,
  $$ values ('identity-docs'), ('application-files'), ('session-photos') $$,
  'three private buckets created');

select * from finish();
rollback;
```

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Write the migration**

```sql
-- backend/supabase/migrations/0020_attachments.sql
create table attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  domain text not null check (domain in ('identity_doc', 'application_file', 'session_photo')),
  owner_type text not null check (owner_type in ('volunteer', 'application', 'activity_hours')),
  owner_id uuid not null,
  bucket text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes int not null,
  original_filename text,
  status text not null default 'pending' check (status in ('pending', 'ready')),
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);
create index attachments_owner_idx on attachments (owner_type, owner_id);
create index attachments_org_idx on attachments (organization_id);

alter table attachments enable row level security;
-- All access is via the get-attachment / *-attachment edge functions (service role). No direct policies.

insert into storage.buckets (id, name, public)
values ('identity-docs', 'identity-docs', false),
       ('application-files', 'application-files', false),
       ('session-photos', 'session-photos', false)
on conflict (id) do nothing;
```

- [ ] **Step 4: Run tests, confirm pass.**

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0020_attachments.sql backend/supabase/tests/database/attachments_test.sql
git commit -m "feat(db): attachments table and private storage buckets

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Migration — `volunteers` identity-doc rename

**Files:**
- Create: `backend/supabase/migrations/0021_volunteer_id_doc.sql`
- Test: `backend/supabase/tests/database/volunteer_id_doc_test.sql`

- [ ] **Step 1: Failing pgTAP test**

```sql
-- backend/supabase/tests/database/volunteer_id_doc_test.sql
begin;
select plan(5);

select hasnt_column('volunteers', 'cnic_number', 'cnic_number renamed away');
select hasnt_column('volunteers', 'cnic_document_url', 'cnic_document_url dropped');
select has_column('volunteers', 'id_doc_number', 'id_doc_number exists');
select has_column('volunteers', 'id_doc_type', 'id_doc_type exists');

select throws_ok(
  $$ update volunteers set id_doc_type = 'passport' $$,
  null, null, 'id_doc_type check rejects unknown type');

select * from finish();
rollback;
```

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Write the migration**

```sql
-- backend/supabase/migrations/0021_volunteer_id_doc.sql
alter table volunteers rename column cnic_number to id_doc_number;
alter table volunteers drop column cnic_document_url;
alter table volunteers add column id_doc_type text check (id_doc_type in ('cnic', 'b_form'));

alter table profile_field_changes drop constraint profile_field_changes_field_name_check;
alter table profile_field_changes add constraint profile_field_changes_field_name_check
  check (field_name in ('dob', 'id_doc_number', 'phone', 'emergency_contact', 'guardian_name', 'guardian_contact'));
```

- [ ] **Step 4: Run tests, confirm pass.** Grep `backend/` for `cnic_number` / `cnic_document_url` in SQL tests and fix references (handlers are fixed in later tasks).

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/0021_volunteer_id_doc.sql backend/supabase/tests/database/volunteer_id_doc_test.sql
git commit -m "feat(db): rename cnic_number to id_doc_number, add id_doc_type

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Admin DB migration — org branding + `staff.can_verify_identity`

**Files:**
- Create: `tmp-partner-admin/supabase/migrations/0012_organizations_branding_and_identity_verifier.sql`
- Test: `tmp-partner-admin/supabase/tests/database/organizations_branding_and_identity_verifier_test.sql`

- [ ] **Step 1: Failing pgTAP test**

```sql
-- tmp-partner-admin/supabase/tests/database/organizations_branding_and_identity_verifier_test.sql
begin;
select plan(5);
select has_column('organizations', 'brand_color', 'orgs.brand_color exists');
select has_column('organizations', 'logo_url', 'orgs.logo_url exists');
select has_column('organizations', 'favicon_url', 'orgs.favicon_url exists');
select has_column('organizations', 'about', 'orgs.about exists');
select has_column('staff', 'can_verify_identity', 'staff.can_verify_identity exists');
select * from finish();
rollback;
```

- [ ] **Step 2: Run, confirm failure** (`cd tmp-partner-admin/supabase && supabase test db`).

- [ ] **Step 3: Write the migration**

```sql
-- tmp-partner-admin/supabase/migrations/0012_organizations_branding_and_identity_verifier.sql
alter table organizations
  add column brand_color text check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column logo_url text,
  add column favicon_url text,
  add column about text;

alter table staff add column can_verify_identity boolean not null default false;
```

- [ ] **Step 4: Run tests, confirm pass.**

- [ ] **Step 5: Commit** (in `tmp-partner-admin`)

```bash
cd tmp-partner-admin && git add supabase/migrations/0012_organizations_branding_and_identity_verifier.sql supabase/tests/database/organizations_branding_and_identity_verifier_test.sql
git commit -m "feat(db): org branding columns and staff.can_verify_identity

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Phase B — Attachment plumbing

Shared constant used by Tasks 10–12 — put it in `_shared/attachmentPolicy.ts`:

```ts
// backend/supabase/functions/_shared/attachmentPolicy.ts
export type AttachmentDomain = "identity_doc" | "application_file" | "session_photo";

export const ATTACHMENT_POLICY: Record<AttachmentDomain, {
  bucket: string; mimeAllowlist: string[]; maxSizeBytes: number; maxFilesPerOwner: number;
}> = {
  identity_doc: {
    bucket: "identity-docs",
    mimeAllowlist: ["image/jpeg", "image/png", "application/pdf"],
    maxSizeBytes: 10 * 1024 * 1024,
    maxFilesPerOwner: 1,
  },
  application_file: {
    bucket: "application-files",
    mimeAllowlist: ["image/jpeg", "image/png", "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    maxSizeBytes: 10 * 1024 * 1024,
    maxFilesPerOwner: 5,
  },
  session_photo: {
    bucket: "session-photos",
    mimeAllowlist: ["image/jpeg", "image/png", "image/webp"],
    maxSizeBytes: 8 * 1024 * 1024,
    maxFilesPerOwner: 6,
  },
};

export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
```

### Task 10: `request-attachment-upload`

**Files:**
- Create: `backend/supabase/functions/_shared/attachmentPolicy.ts` (the block above)
- Create: `backend/supabase/functions/request-attachment-upload/index.ts`, `handler.ts`, `handler.test.ts`

**Interfaces:**
- Consumes: `ATTACHMENT_POLICY`, `EXT_BY_MIME`, `AttachmentDomain` from `attachmentPolicy.ts`.
- Produces:
  ```ts
  interface RequestAttachmentUploadInput {
    domain: AttachmentDomain;
    ownerType: "volunteer" | "application" | "activity_hours";
    ownerId: string;            // for pre-submit uploads, the CLIENT passes a fresh uuid it will use
    mimeType: string;
    sizeBytes: number;
    originalFilename?: string;
  }
  interface RequestAttachmentUploadResult {
    attachmentId: string;
    uploadUrl: string;          // Supabase signed upload URL
    storagePath: string;
  }
  export function requestAttachmentUpload(
    supabase: SupabaseClient,
    requester: { authUserId: string; volunteerId?: string; staffOrgIds?: string[] },
    input: RequestAttachmentUploadInput,
  ): Promise<RequestAttachmentUploadResult>;
  ```
  Note: pre-submit uploads (identity doc during registration, files during an application draft, photos during hours logging) use a client-generated `ownerId` that the subsequent `register-volunteer` / `apply-to-opportunity` / `submit-hours` call passes back so the row is re-pointed. That re-point step lives in those handlers (Tasks 15, 18, 20).

- [ ] **Step 1: Write failing handler tests**

```ts
// backend/supabase/functions/request-attachment-upload/handler.test.ts
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { requestAttachmentUpload } from "./handler.ts";

function fakeSupabase(overrides: Record<string, unknown> = {}) {
  return {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        async count() { return { count: 0, error: null }; },
        insert(row: unknown) { return { select() { return { async single() { return { data: { id: "att-new" }, error: null }; } }; } }; },
      };
    },
    storage: {
      from() {
        return { async createSignedUploadUrl() { return { data: { signedUrl: "https://upload" }, error: null }; } };
      },
    },
    ...overrides,
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

Deno.test("rejects mime outside the domain allowlist", async () => {
  await assertRejects(
    () => requestAttachmentUpload(fakeSupabase(), { authUserId: "u", volunteerId: "v" },
      { domain: "session_photo", ownerType: "activity_hours", ownerId: "o", mimeType: "application/zip", sizeBytes: 100 }),
    Error, "mime_not_allowed");
});

Deno.test("rejects file over the size cap", async () => {
  await assertRejects(
    () => requestAttachmentUpload(fakeSupabase(), { authUserId: "u", volunteerId: "v" },
      { domain: "session_photo", ownerType: "activity_hours", ownerId: "o", mimeType: "image/png", sizeBytes: 20 * 1024 * 1024 }),
    Error, "file_too_large");
});

Deno.test("volunteer requester cannot target owner_type application for another org", async () => {
  // owner is an existing application row belonging to org-X; requester is a staffer of org-Y
  const sb = fakeSupabase({
    from() {
      return {
        select() { return this; }, eq() { return this; }, in() { return this; },
        async single() { return { data: { organization_id: "org-X" }, error: null }; },
        async count() { return { count: 0, error: null }; },
        insert() { return { select() { return { async single() { return { data: { id: "att-new" }, error: null }; } }; } }; },
      };
    },
  });
  await assertRejects(
    () => requestAttachmentUpload(sb, { authUserId: "u", staffOrgIds: ["org-Y"] },
      { domain: "application_file", ownerType: "application", ownerId: "app-1", mimeType: "application/pdf", sizeBytes: 100 }),
    Error, "forbidden");
});

Deno.test("happy path returns attachmentId, uploadUrl, storagePath", async () => {
  const r = await requestAttachmentUpload(fakeSupabase(), { authUserId: "u", volunteerId: "v" },
    { domain: "session_photo", ownerType: "activity_hours", ownerId: "own-1", mimeType: "image/png", sizeBytes: 100 });
  assertEquals(r.attachmentId, "att-new");
  assertEquals(r.uploadUrl, "https://upload");
  assertEquals(r.storagePath.startsWith("activity_hours/own-1/"), true);
});
```

- [ ] **Step 2: Run, confirm failure** — `deno test functions/request-attachment-upload/handler.test.ts`.

- [ ] **Step 3: Implement `handler.ts`**

```ts
// backend/supabase/functions/request-attachment-upload/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { ATTACHMENT_POLICY, EXT_BY_MIME, type AttachmentDomain } from "../_shared/attachmentPolicy.ts";

export interface RequestAttachmentUploadInput {
  domain: AttachmentDomain;
  ownerType: "volunteer" | "application" | "activity_hours";
  ownerId: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename?: string;
}
export interface RequestAttachmentUploadResult {
  attachmentId: string;
  uploadUrl: string;
  storagePath: string;
}
export interface AttachmentRequester {
  authUserId: string;
  volunteerId?: string;
  staffOrgIds?: string[];
}

export async function requestAttachmentUpload(
  supabase: SupabaseClient,
  requester: AttachmentRequester,
  input: RequestAttachmentUploadInput,
): Promise<RequestAttachmentUploadResult> {
  const policy = ATTACHMENT_POLICY[input.domain];
  if (!policy) throw new Error("bad_domain");
  if (!policy.mimeAllowlist.includes(input.mimeType)) throw new Error("mime_not_allowed");
  if (input.sizeBytes <= 0 || input.sizeBytes > policy.maxSizeBytes) throw new Error("file_too_large");

  // Ownership: which domains each requester kind may write to.
  const isVolunteer = Boolean(requester.volunteerId);
  const isStaff = Array.isArray(requester.staffOrgIds);
  let organizationId: string | null = null;

  if (input.domain === "identity_doc") {
    if (!isVolunteer || input.ownerType !== "volunteer") throw new Error("forbidden");
    // owner_id is a client-chosen uuid for the volunteer row about to be created,
    // or the volunteer's own id for a re-upload. Accept both; re-point happens later.
  } else if (input.domain === "session_photo") {
    if (!isVolunteer || input.ownerType !== "activity_hours") throw new Error("forbidden");
  } else if (input.domain === "application_file") {
    if (isVolunteer && input.ownerType === "application") {
      // draft: client-chosen uuid, no existing row to check
    } else if (isStaff && input.ownerType === "application") {
      const { data, error } = await supabase.from("applications")
        .select("organization_id").eq("id", input.ownerId).single();
      if (error || !data) throw new Error("not_found");
      if (!requester.staffOrgIds!.includes(data.organization_id)) throw new Error("forbidden");
      organizationId = data.organization_id;
    } else {
      throw new Error("forbidden");
    }
  }

  // Per-owner file count cap (only meaningful once the row is re-pointed; a soft check).
  const { count } = await supabase.from("attachments")
    .select("id", { count: "exact", head: true })
    .eq("owner_type", input.ownerType).eq("owner_id", input.ownerId).eq("status", "ready");
  if ((count ?? 0) >= policy.maxFilesPerOwner) throw new Error("too_many_files");

  const attachmentId = crypto.randomUUID();
  const ext = EXT_BY_MIME[input.mimeType] ?? "bin";
  const storagePath = `${input.ownerType}/${input.ownerId}/${attachmentId}.${ext}`;

  const { error: insErr } = await supabase.from("attachments").insert({
    id: attachmentId,
    organization_id: organizationId,
    domain: input.domain,
    owner_type: input.ownerType,
    owner_id: input.ownerId,
    bucket: policy.bucket,
    storage_path: storagePath,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    original_filename: input.originalFilename ?? null,
    status: "pending",
    uploaded_by: requester.authUserId,
  });
  if (insErr) throw insErr;

  const { data: signed, error: sErr } = await supabase.storage
    .from(policy.bucket).createSignedUploadUrl(storagePath);
  if (sErr || !signed) throw new Error("upload_url_failed");

  return { attachmentId, uploadUrl: signed.signedUrl, storagePath };
}
```

- [ ] **Step 4: Implement `index.ts`** — follows `apply-to-opportunity/index.ts`. It must accept **either** a volunteer token or a staff token: try `verifyVolunteerToken`; on `unauthorized`, try `verifyStaffToken` and build `{ authUserId, staffOrgIds: <org ids from claims> }`. Rate-limit key `attach-req:<ip>`, 60/hour.

- [ ] **Step 5: Run tests, confirm pass. Commit.**

```bash
git add backend/supabase/functions/_shared/attachmentPolicy.ts backend/supabase/functions/request-attachment-upload/
git commit -m "feat: request-attachment-upload edge function

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: `finalize-attachment`

**Files:** Create `backend/supabase/functions/finalize-attachment/{index,handler,handler.test}.ts`

**Interfaces:**
- Produces:
  ```ts
  interface FinalizeAttachmentInput { attachmentId: string; }
  export function finalizeAttachment(
    supabase: SupabaseClient,
    requester: { authUserId: string },
    input: FinalizeAttachmentInput,
  ): Promise<{ ok: true }>;
  ```

- [ ] **Step 1: Failing tests**

```ts
// finalize-attachment/handler.test.ts
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { finalizeAttachment } from "./handler.ts";

const row = { id: "att-1", uploaded_by: "u", bucket: "session-photos", storage_path: "p", size_bytes: 100, status: "pending" };

function sb(objInfo: { size: number } | null, updateOk = true) {
  return {
    from() {
      return {
        select() { return this; }, eq() { return this; },
        async single() { return { data: row, error: null }; },
        update() { return { eq() { return { async then(res: (v: unknown) => void) { res({ error: updateOk ? null : new Error("x") }); } }; } }; },
      };
    },
    storage: { from() { return { async info() { return objInfo ? { data: { size: objInfo.size }, error: null } : { data: null, error: new Error("missing") }; } }; } },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

Deno.test("rejects when the storage object is missing", async () => {
  await assertRejects(() => finalizeAttachment(sb(null), { authUserId: "u" }, { attachmentId: "att-1" }), Error, "object_missing");
});

Deno.test("rejects when requester is not the uploader", async () => {
  await assertRejects(() => finalizeAttachment(sb({ size: 100 }), { authUserId: "other" }, { attachmentId: "att-1" }), Error, "forbidden");
});

Deno.test("happy path flips status to ready", async () => {
  const r = await finalizeAttachment(sb({ size: 100 }), { authUserId: "u" }, { attachmentId: "att-1" });
  assertEquals(r.ok, true);
});
```

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement `handler.ts`**

```ts
// finalize-attachment/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";

export interface FinalizeAttachmentInput { attachmentId: string; }

export async function finalizeAttachment(
  supabase: SupabaseClient,
  requester: { authUserId: string },
  input: FinalizeAttachmentInput,
): Promise<{ ok: true }> {
  const { data: att, error } = await supabase.from("attachments")
    .select("id, uploaded_by, bucket, storage_path, size_bytes, status")
    .eq("id", input.attachmentId).single();
  if (error || !att) throw new Error("not_found");
  if (att.uploaded_by !== requester.authUserId) throw new Error("forbidden");
  if (att.status === "ready") return { ok: true };

  const { data: obj, error: oErr } = await supabase.storage.from(att.bucket).info(att.storage_path);
  if (oErr || !obj) throw new Error("object_missing");
  // size tolerance: allow the row's declared size to be within 10% of the actual object.
  if (Math.abs((obj.size as number) - att.size_bytes) > att.size_bytes * 0.1 + 1024) {
    throw new Error("size_mismatch");
  }

  const { error: uErr } = await supabase.from("attachments")
    .update({ status: "ready", size_bytes: obj.size }).eq("id", att.id);
  if (uErr) throw uErr;
  return { ok: true };
}
```

- [ ] **Step 4: Implement `index.ts`** (volunteer-or-staff token as Task 10; rate-limit `attach-fin:<ip>` 120/hour). **Run tests, confirm pass. Commit.**

---

### Task 12: `get-attachment` (permission matrix)

**Files:** Create `backend/supabase/functions/get-attachment/{index,handler,handler.test}.ts`

**Interfaces:**
- Produces:
  ```ts
  interface GetAttachmentInput { attachmentId: string; }
  export function getAttachment(
    supabase: SupabaseClient,
    requester: { volunteerId?: string; staffOrgIds?: string[]; canVerifyIdentity?: boolean },
    input: GetAttachmentInput,
  ): Promise<{ url: string }>;
  ```

- [ ] **Step 1: Failing tests** — cover the matrix:

```ts
// get-attachment/handler.test.ts
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { getAttachment } from "./handler.ts";

function sbWith(att: Record<string, unknown>) {
  return {
    from(table: string) {
      if (table === "attachments") return { select() { return this; }, eq() { return this; }, async single() { return { data: att, error: null }; } };
      // volunteers lookup for identity_doc owner check
      return { select() { return this; }, eq() { return this; }, async single() { return { data: { id: att.owner_id }, error: null }; } };
    },
    storage: { from() { return { async createSignedUrl() { return { data: { signedUrl: "https://dl" }, error: null }; } }; } },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

Deno.test("identity_doc: owning volunteer allowed", async () => {
  const r = await getAttachment(sbWith({ id: "a", domain: "identity_doc", owner_type: "volunteer", owner_id: "v1", organization_id: null, bucket: "identity-docs", storage_path: "p" }),
    { volunteerId: "v1" }, { attachmentId: "a" });
  assertEquals(r.url, "https://dl");
});

Deno.test("identity_doc: central verifier allowed", async () => {
  const r = await getAttachment(sbWith({ id: "a", domain: "identity_doc", owner_type: "volunteer", owner_id: "v1", organization_id: null, bucket: "identity-docs", storage_path: "p" }),
    { staffOrgIds: [], canVerifyIdentity: true }, { attachmentId: "a" });
  assertEquals(r.url, "https://dl");
});

Deno.test("identity_doc: org staff without verify capability denied", async () => {
  await assertRejects(() => getAttachment(sbWith({ id: "a", domain: "identity_doc", owner_type: "volunteer", owner_id: "v1", organization_id: null, bucket: "identity-docs", storage_path: "p" }),
    { staffOrgIds: ["org-1"], canVerifyIdentity: false }, { attachmentId: "a" }), Error, "forbidden");
});

Deno.test("session_photo: staff of the owning org allowed", async () => {
  const r = await getAttachment(sbWith({ id: "a", domain: "session_photo", owner_type: "activity_hours", owner_id: "h1", organization_id: "org-1", bucket: "session-photos", storage_path: "p" }),
    { staffOrgIds: ["org-1"] }, { attachmentId: "a" });
  assertEquals(r.url, "https://dl");
});

Deno.test("application_file: staff of a different org denied", async () => {
  await assertRejects(() => getAttachment(sbWith({ id: "a", domain: "application_file", owner_type: "application", owner_id: "app1", organization_id: "org-1", bucket: "application-files", storage_path: "p" }),
    { staffOrgIds: ["org-2"] }, { attachmentId: "a" }), Error, "forbidden");
});
```

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement `handler.ts`**

```ts
// get-attachment/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";

export interface GetAttachmentInput { attachmentId: string; }
export interface AttachmentReader {
  volunteerId?: string;
  staffOrgIds?: string[];
  canVerifyIdentity?: boolean;
}

export async function getAttachment(
  supabase: SupabaseClient,
  reader: AttachmentReader,
  input: GetAttachmentInput,
): Promise<{ url: string }> {
  const { data: att, error } = await supabase.from("attachments")
    .select("id, domain, owner_type, owner_id, organization_id, bucket, storage_path, status")
    .eq("id", input.attachmentId).single();
  if (error || !att) throw new Error("not_found");
  if (att.status !== "ready") throw new Error("not_found");

  const isVolunteer = Boolean(reader.volunteerId);
  const staffOrgIds = reader.staffOrgIds ?? [];

  if (att.domain === "identity_doc") {
    const ownsIt = isVolunteer && await volunteerOwns(supabase, reader.volunteerId!, att.owner_id);
    if (!ownsIt && !reader.canVerifyIdentity) throw new Error("forbidden");
  } else {
    // application_file / session_photo
    const ownsIt = isVolunteer && await volunteerOwnsResource(supabase, reader.volunteerId!, att.owner_type, att.owner_id);
    const isOrgStaff = att.organization_id !== null && staffOrgIds.includes(att.organization_id);
    if (!ownsIt && !isOrgStaff) throw new Error("forbidden");
  }

  const { data: signed, error: sErr } = await supabase.storage
    .from(att.bucket).createSignedUrl(att.storage_path, 300);
  if (sErr || !signed) throw new Error("download_url_failed");
  return { url: signed.signedUrl };
}

async function volunteerOwns(supabase: SupabaseClient, volunteerId: string, ownerId: string): Promise<boolean> {
  return volunteerId === ownerId; // owner_type 'volunteer' → owner_id IS the volunteer id
}

async function volunteerOwnsResource(
  supabase: SupabaseClient, volunteerId: string, ownerType: string, ownerId: string,
): Promise<boolean> {
  const table = ownerType === "application" ? "applications" : "activity_hours";
  const { data } = await supabase.from(table).select("volunteer_id").eq("id", ownerId).single();
  return Boolean(data && data.volunteer_id === volunteerId);
}
```

- [ ] **Step 4: Implement `index.ts`** (volunteer-or-staff token; for staff also pass `canVerifyIdentity` from claims — needs Task 13 done first, so **reorder: do Task 13 before Task 12's index.ts**, or stub `canVerifyIdentity: false` and wire it in Task 13's commit). Rate-limit `attach-get:<ip>` 300/hour.

- [ ] **Step 5: Run tests, confirm pass. Commit.**

---

### Task 13: `verifyStaffToken` exposes `canVerifyIdentity`; `mint-staff-token` sets it

**Files:**
- Modify: `backend/supabase/functions/_shared/verifyStaffToken.ts` + its test
- Modify: `tmp-partner-admin/supabase/functions/mint-staff-token/handler.ts` + its test

**Interfaces:**
- Produces: `StaffClaims.canVerifyIdentity: boolean`.

- [ ] **Step 1:** In `verifyStaffToken.test.ts`, add a case asserting a token minted with `can_verify_identity: true` yields `claims.canVerifyIdentity === true`, and absent → `false`. In `mint-staff-token/handler.test.ts`, add a case: a staff row with `can_verify_identity = true` (or `platform_owner = true`) mints a token whose decoded claims include `canVerifyIdentity: true`.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — add `canVerifyIdentity` to the `StaffClaims` interface and to the object `verifyStaffToken` returns (read from the JWT payload key `canVerifyIdentity`, default `false`). In `mint-staff-token/handler.ts`: select `can_verify_identity` from the `staff` row; put `canVerifyIdentity: staffRow.can_verify_identity || staffRow.platform_owner` into the token payload.

- [ ] **Step 4: Run tests, confirm pass.** Then finish Task 12's `index.ts` wiring `canVerifyIdentity` from the staff claims.

- [ ] **Step 5: Commit** (two repos — commit each).

---

## Phase C — Volunteer-facing functions

### Task 14: `register-volunteer` — identity-doc fields

**Files:** Modify `backend/supabase/functions/register-volunteer/handler.ts` + `handler.test.ts`

**Interfaces:**
- `RegisterVolunteerInput` gains `idDocType: "cnic" | "b_form"`, `idDocNumber: string`, `idDocAttachmentId: string`.

- [ ] **Step 1: Update tests** — add: a valid registration with `idDocType: "cnic"` writes `id_doc_type`/`id_doc_number` and re-points the attachment's `owner_id` to the new volunteer id; a minor (`dob` under 18) with `idDocType: "cnic"` is rejected (`b_form_required_for_minor`); a missing/`pending` `idDocAttachmentId` is rejected (`id_doc_attachment_required`). Update existing tests that referenced `cnic_number`.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — in `registerVolunteer`:
  - After the minor check: if `isMinor && input.idDocType !== "b_form"` → `throw new Error("b_form_required_for_minor")`.
  - Load the attachment: `select id, domain, owner_type, status, uploaded_by from attachments where id = input.idDocAttachmentId`. Require `domain === "identity_doc"`, `owner_type === "volunteer"`, `status === "ready"`, `uploaded_by === input.authUserId`; else `throw new Error("id_doc_attachment_required")`.
  - Insert the volunteer row with `id_doc_type: input.idDocType`, `id_doc_number: input.idDocNumber` (keep the existing columns).
  - After insert: `update attachments set owner_id = <newVolunteerId> where id = input.idDocAttachmentId`.
  - Keep `flagNearDuplicatesIfAny` and `status = 'pending_verification'`.

- [ ] **Step 4: Run tests, confirm pass. Commit.**

---

### Task 15: `submit-hours` — note + session photos

**Files:** Modify `backend/supabase/functions/submit-hours/handler.ts` + `handler.test.ts`

**Interfaces:**
- `SubmitHoursInput` gains `note?: string`, `attachmentIds?: string[]`.

- [ ] **Step 1: Update tests** — add: `note` is persisted; each `attachmentIds` entry must be a `ready` `session_photo` uploaded by this volunteer, else `bad_attachment`; on success each attachment's `owner_id` is re-pointed to the new `activity_hours` id and `organization_id` set; the row is inserted `verification_status = 'pending'`.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — after deriving `participation`:
  - For each id in `input.attachmentIds ?? []`: load the attachment; require `domain === "session_photo"`, `status === "ready"`, `uploaded_by === <authUserId passed through from index>`, not already linked to a different `activity_hours` row; else `throw new Error("bad_attachment")`. (Add `authUserId` to `SubmitHoursInput` — index.ts derives it from the volunteer token.)
  - Insert `activity_hours` with `note: input.note ?? null` (status uses the DB default `pending`).
  - `update attachments set owner_id = <activityHoursId>, organization_id = <participation.organization_id> where id = any(input.attachmentIds)`.

- [ ] **Step 4: Run tests, confirm pass. Commit.**

---

### Task 16: `apply-to-opportunity` — dynamic form + attachments

**Files:** Modify `backend/supabase/functions/apply-to-opportunity/handler.ts` + `handler.test.ts`

**Interfaces:**
- `ApplyToOpportunityInput` = `{ volunteerId: string; authUserId: string; opportunityId: string; answers: Record<string, unknown>; attachmentIds?: string[]; }` (drop `organizationId`, `motivationStatement`).
- On validation failure the handler throws `new Error("validation")` and attaches `fieldErrors` — do this by throwing a custom error: `const e = new Error("validation"); (e as Error & { fieldErrors: Record<string,string> }).fieldErrors = r.fieldErrors; throw e;`. `index.ts` maps `message === "validation"` → 422 and includes `fieldErrors` in the JSON body.

- [ ] **Step 1: Rewrite tests**

```ts
// apply-to-opportunity/handler.test.ts (representative cases)
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { applyToOpportunity } from "./handler.ts";

const form = {
  version: 1,
  fields: [
    { id: "why", type: "long_text", label: "Why", required: true },
    { id: "consent", type: "checkbox", label: "I confirm", required: true },
    { id: "cv", type: "file", label: "CV", maxFiles: 1 },
  ],
};

function sb(opts: { oppForm?: unknown; volunteer?: Record<string, unknown>; attachments?: Record<string, Record<string, unknown>> } = {}) {
  const volunteer = opts.volunteer ?? { id: "v1", full_name: "Ayesha", email: "a@b.com", phone: "123", id_doc_number: "35202-1" };
  return {
    from(table: string) {
      const api = {
        select() { return api; }, eq() { return api; }, in() { return api; }, is() { return api; },
        async single() {
          if (table === "opportunities") return { data: { id: "opp1", organization_id: "org1", deactivated_at: null, application_form: opts.oppForm ?? form }, error: null };
          if (table === "volunteers") return { data: volunteer, error: null };
          return { data: null, error: null };
        },
        insert() { return { select() { return { async single() { return { data: { id: "app-new" }, error: null }; } }; } }; },
        update() { return api; },
        async then(res: (v: unknown) => void) { res({ error: null }); },
      };
      return api;
    },
    async rpc() { return { error: null }; },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

Deno.test("422 with fieldErrors when a required answer is missing", async () => {
  const err = await assertRejects(
    () => applyToOpportunity(sb(), { volunteerId: "v1", authUserId: "u1", opportunityId: "opp1", answers: {} }),
    Error, "validation");
  assertEquals(typeof (err as Error & { fieldErrors: Record<string, string> }).fieldErrors.why, "string");
});

Deno.test("requires the volunteer to have an id doc on file", async () => {
  await assertRejects(
    () => applyToOpportunity(sb({ volunteer: { id: "v1", full_name: "A", email: "a@b.com", phone: "1", id_doc_number: null } }),
      { volunteerId: "v1", authUserId: "u1", opportunityId: "opp1", answers: { why: "x", consent: true } }),
    Error, "id_doc_required");
});

Deno.test("happy path snapshots the form and promotes columns", async () => {
  const r = await applyToOpportunity(sb(),
    { volunteerId: "v1", authUserId: "u1", opportunityId: "opp1", answers: { why: "I care", consent: true } });
  assertEquals(r.applicationId, "app-new");
});
```

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement `handler.ts`**

```ts
// backend/supabase/functions/apply-to-opportunity/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { validateAnswers, resolveConsent, type FormDefinition } from "../_shared/forms.ts";

export interface ApplyToOpportunityInput {
  volunteerId: string;
  authUserId: string;
  opportunityId: string;
  answers: Record<string, unknown>;
  attachmentIds?: string[];
}
export interface ApplyToOpportunityResult { applicationId: string; }

export async function applyToOpportunity(
  supabase: SupabaseClient,
  input: ApplyToOpportunityInput,
): Promise<ApplyToOpportunityResult> {
  const { data: volunteer, error: vErr } = await supabase.from("volunteers")
    .select("id, full_name, email, phone, id_doc_number").eq("id", input.volunteerId).single();
  if (vErr || !volunteer) throw new Error("not_found");
  if (!volunteer.id_doc_number) throw new Error("id_doc_required");

  const { data: opp, error: oErr } = await supabase.from("opportunities")
    .select("id, organization_id, deactivated_at, application_form").eq("id", input.opportunityId).single();
  if (oErr || !opp) throw new Error("not_found");
  if (opp.deactivated_at !== null) throw new Error("opportunity_unavailable");

  const form = opp.application_form as FormDefinition;
  const result = validateAnswers(form, input.answers);
  if (!result.ok) {
    const e = new Error("validation") as Error & { fieldErrors: Record<string, string> };
    e.fieldErrors = result.fieldErrors;
    throw e;
  }

  // Verify referenced attachments: ready application_file rows this user uploaded,
  // not yet linked to another application.
  const attachmentIds = input.attachmentIds ?? [];
  if (attachmentIds.length > 0) {
    const { data: atts, error: aErr } = await supabase.from("attachments")
      .select("id, domain, owner_type, status, uploaded_by")
      .in("id", attachmentIds);
    if (aErr) throw aErr;
    const ok = (atts ?? []).length === attachmentIds.length &&
      (atts ?? []).every((a) =>
        a.domain === "application_file" && a.owner_type === "application" &&
        a.status === "ready" && a.uploaded_by === input.authUserId);
    if (!ok) throw new Error("bad_attachment");
  }

  const { data: app, error: iErr } = await supabase.from("applications").insert({
    volunteer_id: volunteer.id,
    opportunity_id: opp.id,
    organization_id: opp.organization_id,
    answers: input.answers,
    form_snapshot: form,
    applicant_name: volunteer.full_name,
    applicant_email: volunteer.email,
    applicant_phone: volunteer.phone,
    consent_accepted: resolveConsent(form, input.answers),
  }).select("id").single();
  if (iErr) throw iErr;

  if (attachmentIds.length > 0) {
    await supabase.from("attachments")
      .update({ owner_id: app.id, organization_id: opp.organization_id })
      .in("id", attachmentIds);
  }

  await supabase.rpc("touch_org_volunteer_index", {
    p_org_id: opp.organization_id,
    p_volunteer_id: volunteer.id,
  });

  return { applicationId: app.id };
}
```

- [ ] **Step 4: Update `index.ts`** — pass `authUserId` from `verifyVolunteerToken`; in the `catch`, when `message === "validation"` respond `422` with `{ error: "validation", fieldErrors: (err as ...).fieldErrors }`.

- [ ] **Step 5: Run tests, confirm pass. Commit.**

---

### Task 17: `get-opportunity-detail` (new, public)

**Files:** Create `backend/supabase/functions/get-opportunity-detail/{index,handler,handler.test}.ts`

**Interfaces:**
- Produces:
  ```ts
  interface GetOpportunityDetailInput { opportunityId: string; }
  interface OpportunityDetail {
    id: string; name: string; description: string | null;
    about: string | null; duties: string[]; eligibility: string[]; whatToBring: string[];
    type: string; location: string | null; isOnline: boolean;
    applicationOpenAt: string | null; applicationDeadline: string | null;
    activityStartAt: string | null; activityEndAt: string | null;
    capacity: number | null; computedStatus: string;
    orgId: string; orgName: string; orgAbout: string | null; orgLogoUrl: string | null;
    applicationForm: FormDefinition;
  }
  export function getOpportunityDetail(supabase: SupabaseClient, input: GetOpportunityDetailInput): Promise<OpportunityDetail>;
  ```

- [ ] **Step 1: Failing test** — a seeded opportunity with content arrays + an org with `about`/`logo_url` returns all fields; `computedStatus` uses `computeOpportunityStatus` (import from `../list-opportunities/handler.ts`); unknown id → `not_found`.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — one query joining `opportunities` to `organizations (name, about, logo_url)`; map snake→camel; compute status via the ported function; return `application_form` verbatim.

- [ ] **Step 4: `index.ts`** — no auth (anon), rate-limit `opp-detail:<ip>` 300/hour. **Run tests, confirm pass. Commit.**

---

### Task 18: `list-opportunities` — filters, facets, public variant

**Files:** Modify `backend/supabase/functions/list-opportunities/handler.ts` + `handler.test.ts`

**Interfaces:**
- New input: `{ organizationId?: string; type?: string; status?: string; online?: boolean; city?: string; search?: string; sort?: "newest" | "closing_soon" | "az"; limit?: number; offset?: number; }`.
- New result: `{ opportunities: OpportunityCard[]; total: number; facets: { cities: string[]; orgs: { id: string; name: string }[] } }` where `OpportunityCard = { id; name; orgName; orgLogoUrl; type; city: string | null; online: boolean; computedStatus; description: string | null }`.
- Split the exported function: `listOpportunitiesPublic(supabase, input)` (anon; only non-deactivated) and keep `listOpportunities(supabase, staffClaims, input)` (staff; org-scoped, sees all). Share a private `runOpportunityQuery`.

- [ ] **Step 1: Update tests** — add cases: `city` filter; `search` matches name (ilike); `sort: "az"` orders by name; `facets.cities` is the distinct city set of the unfiltered org scope; public variant excludes `deactivated_at is not null`; staff variant still enforces `opportunities:read`.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — extend the query builder with `.eq("organization_id", ...)` (optional), `.eq("type", ...)`, `.eq("is_online", ...)`, `.ilike("location", `%${city}%`)` for city, `.or(`name.ilike.%${search}%,description.ilike.%${search}%`)` for search; `sort` → `.order(...)` (`closing_soon` = `application_deadline` asc nulls last; `az` = `name` asc; default `created_at` desc). Join `organizations (name, logo_url)`. `facets`: a second lightweight query (`select distinct location`, `select id,name from organizations where id in (distinct org ids)`), or compute from the fetched page for v1 (acceptable per spec §"no scale optimization"; note the choice in a comment). Status filter stays post-computed as today.

- [ ] **Step 4: Run tests, confirm pass. Commit.**

---

### Task 19: `get-volunteer-portfolio` (new)

**Files:** Create `backend/supabase/functions/get-volunteer-portfolio/{index,handler,handler.test}.ts`

**Interfaces:**
- Produces (shape exactly as the spec's "get-volunteer-portfolio" block):
  ```ts
  export function getVolunteerPortfolio(
    supabase: SupabaseClient, volunteerId: string,
  ): Promise<Portfolio>;
  ```
  `Portfolio`, `PortfolioApplication`, `PortfolioProgramme`, `PortfolioSession` types defined in this file and exported.

- [ ] **Step 1: Failing test** — with a fake supabase returning: 1 volunteer (+ chapter link), 3 applications (+ opportunity/org names), 4 participations (+ opportunity/org), activity_hours rows (mix of `pending`/`verified`, one with `hours_verified <> hours_submitted`, one with a `session_photo` attachment id). Assert: `totals.verifiedHours` = sum of `hours_verified` where `verified`; `totals.completedProgrammes` = count of participations with `status = 'completed'`; a session with adjusted hours has `adjusted: true`; a programme with any non-verified session has `allVerified: false`; sessions carry `photoAttachmentIds`.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — sequential queries:
  1. `volunteers` (self) + newest `volunteer_chapter_link → chapters(name)`.
  2. `applications` where `volunteer_id` → join `opportunities(name, type, location)` + `organizations(name)`.
  3. `participation` where `volunteer_id` → join `opportunities(name, type, activity_start_at, activity_end_at)` + `organizations(name, logo_url)`.
  4. `activity_hours` where `volunteer_id`, ordered `activity_date`.
  5. `attachments` where `owner_type='activity_hours'` and `owner_id in (<hour ids>)` and `domain='session_photo'` and `status='ready'`.
  Group hours by `participation_id`; per session set `adjusted = hours_verified != null && hours_verified != hours_submitted`, `status` = `verification_status`; `hoursVerified` = sum of verified; `allVerified` = every session `verified`. `totals.verifiedHours` = `volunteer_total_verified_hours` RPC (or sum client-side to match). `activeApplications` = count where status in `('submitted','under_review','waitlisted','selected')`.

- [ ] **Step 4: `index.ts`** — `verifyVolunteerToken`, no `volunteerId` from the body. Rate-limit `portfolio:<ip>` 120/hour. **Run tests, confirm pass. Commit.**

---

## Phase D — Admin / staff functions

### Task 20: `sync-organization` — branding

**Files:** Modify `backend/supabase/functions/sync-organization/handler.ts` + `handler.test.ts`

- [ ] **Step 1:** Add `brandColor?`, `logoUrl?`, `faviconUrl?`, `about?` to `SyncOrganizationInput`. Test: a payload with `brandColor` upserts it; a payload **without** it leaves an existing value untouched (use `coalesce` semantics — read the current row, merge, upsert).

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — before upsert, `select brand_color, logo_url, favicon_url, about from organizations where id = input.organizationId`; upsert with `brand_color: input.brandColor ?? existing?.brand_color ?? null` (and the same for the other three).

- [ ] **Step 4: Run tests, confirm pass. Commit.**

---

### Task 21: `create-opportunity` / `update-opportunity` — content + form

**Files:** Modify both handlers + their tests.

- [ ] **Step 1: Update tests** — `about`, `duties`, `eligibility`, `whatToBring` persist as given; `applicationForm` is validated with `validateFormDefinition` and an invalid one is rejected `invalid_form`; omitting `applicationForm` on create leaves the DB default; `eligibilityCriteria` is no longer accepted.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — add the four array fields to the insert/update payload (`?? []` for create). If `input.applicationForm !== undefined`: `const v = validateFormDefinition(input.applicationForm); if (!v.ok) throw new Error("invalid_form"); payload.application_form = v.def;`. Remove `eligibility_criteria` handling.

- [ ] **Step 4: Run tests, confirm pass. Commit.**

---

### Task 22: `update-opportunity-form` (new)

**Files:** Create `backend/supabase/functions/update-opportunity-form/{index,handler,handler.test}.ts`

**Interfaces:**
- Produces:
  ```ts
  interface UpdateOpportunityFormInput { opportunityId: string; form: unknown; }
  export function updateOpportunityForm(
    supabase: SupabaseClient, staffClaims: StaffClaims, input: UpdateOpportunityFormInput,
  ): Promise<{ ok: true }>;
  ```

- [ ] **Step 1: Failing test** — staff without `opportunities:manage` for the opp's org → `forbidden`; an invalid form → `invalid_form`; a valid form is written and an `admin_action_log` row (`action='application_form_updated'`, `target_type='opportunity'`, `metadata.field_count`) is inserted.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — load the opportunity's `organization_id`; `staffHasPermission(claims, orgId, "youth-republic", "opportunities:manage")` else `forbidden`; `validateFormDefinition(input.form)` else `invalid_form`; `update opportunities set application_form = v.def`; insert `admin_action_log`.

- [ ] **Step 4: `index.ts`** — `verifyStaffToken`. **Run tests, confirm pass. Commit.**

---

### Task 23: `verify-hours` / `bulk-assign-hours` — audit log

**Files:** Modify both handlers + tests.

- [ ] **Step 1: Update tests** — verifying with `hoursVerified === hoursSubmitted` writes `admin_action_log` `action='hours_verified'`, `metadata: { hours }`; a differing value writes `action='hours_adjusted'`, `metadata: { submitted, verified }`; a rejection writes `action='hours_rejected'`, `metadata: { reason }`. `target_type='activity_hours'`, `target_id` = the row id, `organization_id` from the row, `staff_id` from the claims.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — after the `activity_hours` update, insert the `admin_action_log` row choosing the action per the branch above. Extract the `staffId` from claims (already available in these handlers).

- [ ] **Step 4: Run tests, confirm pass. Commit.**

---

### Task 24: `verify-volunteer` + `list-pending-volunteers` (new)

**Files:** Create `backend/supabase/functions/verify-volunteer/{index,handler,handler.test}.ts` and `backend/supabase/functions/list-pending-volunteers/{index,handler,handler.test}.ts`

**Interfaces:**
- `verify-volunteer`:
  ```ts
  interface VerifyVolunteerInput { volunteerId: string; decision: "verify" | "reject"; reason?: string; }
  export function verifyVolunteer(
    supabase: SupabaseClient, staffClaims: StaffClaims, input: VerifyVolunteerInput,
  ): Promise<{ status: string }>;
  ```
- `list-pending-volunteers`:
  ```ts
  interface ListPendingVolunteersInput { limit?: number; offset?: number; search?: string; }
  export function listPendingVolunteers(
    supabase: SupabaseClient, staffClaims: StaffClaims, input: ListPendingVolunteersInput,
  ): Promise<{ volunteers: PendingVolunteer[]; total: number }>;
  ```
  `PendingVolunteer = { id; volunteerCode; fullName; dob; idDocType: string | null; idDocNumber: string | null; city; institution; submittedAt: string; idDocAttachmentId: string | null }`.

- [ ] **Step 1: Failing tests** — both functions: `staffClaims.canVerifyIdentity !== true` → `forbidden`. `verify-volunteer`: `verify` sets `volunteers.status='active'` and logs `volunteer_identity_verified`; `reject` keeps `pending_verification`, returns `{ status: 'pending_verification' }`, logs `volunteer_identity_rejected` with `metadata.reason`, and deletes the volunteer's `identity_doc` attachment row (allowing a re-upload); `reject` without `reason` → `reason_required`. `list-pending-volunteers`: returns only `status='pending_verification'`, newest first, with the joined `identity_doc` attachment id.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** both handlers. Guard: `if (staffClaims.canVerifyIdentity !== true) throw new Error("forbidden");`. `verify-volunteer` uses `admin_action_log` with `organization_id: null` (identity is org-agnostic).

- [ ] **Step 4: `index.ts`** for both — `verifyStaffToken`. **Run tests, confirm pass. Commit.**

---

### Task 25: `list-applications` / `get-volunteer-detail` — project new fields

**Files:** Modify both handlers + tests.

- [ ] **Step 1: Update tests** — `list-applications` rows include `applicantName/Email/Phone`, `answers`, `formSnapshot`, and `attachmentIdsByField` (map of field id → attachment ids, derived from `answers` where the field is a `file` field in `form_snapshot`). `get-volunteer-detail`: each application carries `answers` + `formSnapshot`; each activity/session carries `note`, `adjusted` (`hours_verified != null && != hours_submitted`), `photoAttachmentIds`.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — widen the `select`, map the new columns, and compute `adjusted` / `attachmentIdsByField` in JS. For `photoAttachmentIds`, one query: `attachments` where `owner_type='activity_hours'`, `owner_id in (<ids>)`, `domain='session_photo'`, `status='ready'`.

- [ ] **Step 4: Run tests, confirm pass. Commit.**

---

## Phase E — Frontend typed API clients

### Task 26: `youth-republic/frontend/lib/edgeFunctions.ts`

**Files:** Modify `youth-republic/frontend/lib/edgeFunctions.ts` + `lib/edgeFunctions.test.ts`

- [ ] **Step 1: Update tests** — the client for each changed/new function serialises the new payload shape and parses the new response shape: `registerVolunteer` (id-doc fields), `applyToOpportunity` (`answers`, `attachmentIds`, and a 422 with `fieldErrors` surfaces as a typed error), `submitHours` (`note`, `attachmentIds`), new `getVolunteerPortfolio`, `getOpportunityDetail`, `listOpportunities` (public filters + facets), `requestAttachmentUpload` / `finalizeAttachment` / `getAttachment`.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — update the `interface *Payload` / `*Response` types and add the new function wrappers, mirroring `forms.ts` types (vendor `forms.ts` into `youth-republic/frontend/lib/forms.ts` via a copy step documented in a header comment `// vendored from backend/supabase/functions/_shared/forms.ts — keep in sync`). On a 422 response, throw `new ValidationError(fieldErrors)`.

- [ ] **Step 4: Run tests, confirm pass. Commit** (in `youth-republic`).

---

### Task 27: `tmp-partner-admin/lib/youthRepublicFunctions.ts`

**Files:** Modify `tmp-partner-admin/lib/youthRepublicFunctions.ts` + `lib/youthRepublicFunctions.test.ts`

- [ ] **Step 1: Update tests** — `createOpportunity` / `updateOpportunity` (content arrays + `applicationForm`), new `updateOpportunityForm`, new `verifyVolunteer` / `listPendingVolunteers`, `listApplications` (new projected fields), `getVolunteerDetail` (new fields), `getAttachment`. `verifyHours` / `bulkAssignHours` responses unchanged.

- [ ] **Step 2: Run, confirm failure.**

- [ ] **Step 3: Implement** — update the payload/response interfaces and add the new wrappers. Vendor `forms.ts` into `tmp-partner-admin/lib/forms.ts` (same sync header comment).

- [ ] **Step 4: Run tests, confirm pass. Commit** (in `tmp-partner-admin`).

---

## Phase F — Reset & seed

### Task 28: `reset.sql` + admin reset

**Files:**
- Create: `backend/supabase/seed/reset.sql`
- Create: `backend/supabase/seed/admin_reset.sql` (run against the admin project)

- [ ] **Step 1: Write `reset.sql`**

```sql
-- backend/supabase/seed/reset.sql  — YR backend project
truncate table
  activity_hours, participation, applications, attachments,
  volunteer_chapter_link, chapters, opportunities, volunteers,
  org_volunteer_index, rate_limit_hits, admin_action_log, profile_field_changes,
  organizations
restart identity cascade;

alter sequence volunteer_code_seq restart with 1;

-- Storage objects: emptied by the seed script (SQL can't delete storage objects portably).
```

- [ ] **Step 2: Write `admin_reset.sql`**

```sql
-- tmp-partner-admin/supabase/seed/admin_reset.sql  — admin project
-- Keep: staff (super-admin + admin), roles, role_permissions, modules, org_modules.
delete from staff_org_roles;
delete from staff_module_roles;
truncate table organizations restart identity cascade;
-- The seed script re-inserts the four orgs with fixed UUIDs and re-grants
-- staff_org_roles for the super-admin (all four) and admin (Rizq).
```

- [ ] **Step 3:** No automated test for the SQL itself; it is exercised by Task 30's smoke test. **Commit** both files (respective repos).

---

### Task 29: `seed.ts` — orgs, opportunities, chapter, worked-example volunteer

**Files:** Create `backend/supabase/seed/seed.ts`

**Interfaces:**
- A Deno script run as `deno run -A backend/supabase/seed/seed.ts` with env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (YR project), `ADMIN_SUPABASE_URL`, `ADMIN_SERVICE_ROLE_KEY`, `YOUTH_REPUBLIC_FUNCTIONS_URL`.
- Exports `runSeed(clients): Promise<{ volunteerEmail: string; volunteerPassword: string; orgSlugs: string[] }>` so `seed.test.ts` can call it.

- [ ] **Step 1: Write `seed.ts`**

Content (abridged to the structure; every value is concrete in the file):

```ts
// backend/supabase/seed/seed.ts
import { createClient } from "@supabase/supabase-js";

const ORG_IDS = {
  rizq: "10000000-0000-4000-8000-000000000001",
  green: "10000000-0000-4000-8000-000000000002",
  sehat: "10000000-0000-4000-8000-000000000003",
  read: "10000000-0000-4000-8000-000000000004",
} as const;

const ORGS = [
  { id: ORG_IDS.rizq, slug: "rizq", name: "Rizq", brand_color: "#D3BD2A",
    about: "Rizq is a Lahore-based charity working on food security — community kitchens, ration programmes and seasonal drives across Punjab." },
  { id: ORG_IDS.green, slug: "green-crescent", name: "Green Crescent", brand_color: "#0B7A3B",
    about: "Green Crescent Pakistan is an environmental non-profit focused on urban waterways, reforestation and waste." },
  { id: ORG_IDS.sehat, slug: "sehat-first", name: "Sehat First", brand_color: "#B02A2A",
    about: "Sehat First runs mobile clinics and community health camps in under-served neighbourhoods of Karachi and interior Sindh." },
  { id: ORG_IDS.read, slug: "read-foundation", name: "Read Foundation", brand_color: "#6E1560",
    about: "Read Foundation supports schooling for out-of-school and low-income children through tutoring, scholarships and school-building." },
];

const SAMPLE_FORM = {
  version: 1,
  fields: [
    { id: "why", type: "long_text", label: "Why do you want to volunteer for this?", required: true, maxLength: 2000 },
    { id: "availability", type: "short_text", label: "Availability", help: "e.g. weekends, evenings after 6pm" },
    { id: "docs", type: "file", label: "Attachments (optional)", accept: ["application/pdf", "image/jpeg", "image/png"], maxFiles: 3, maxSizeMB: 10 },
    { id: "consent", type: "checkbox", label: "I confirm the information above is accurate and I meet the eligibility criteria.", required: true },
  ],
};

const OPPORTUNITIES = [
  { orgKey: "rizq", name: "Ramadan Food Drive", type: "community", location: "Lahore", is_online: false,
    description: "Pack and distribute ration hampers to families across Lahore through Ramadan.",
    about: "Shifts run every evening from 4pm until iftar, plus full days on weekends...\n\nYou'll be based at the Nourish depot in Township, with transport laid on...",
    duties: ["Sort and pack dry rations into family hampers", "Load and unload the delivery vans", "Check hampers against the household register at each stop", "Help families carry hampers and record the handover"],
    eligibility: ["16 and over (under-18s need guardian consent)", "Able to stand and lift for a two-hour shift", "Comfortable working in a large team"],
    what_to_bring: ["Comfortable closed-toe shoes", "A refillable water bottle", "Your CNIC or B-Form for sign-in"],
    application_open_at: "2024-03-01", application_deadline: "2024-03-08", activity_start_at: "2024-03-12", activity_end_at: "2024-03-31", capacity: 60 },
  // ... the other five, copied from demos/youth-republic/prototype.html OPPORTUNITIES + the spec's seed table ...
];

// 1. upsert ORGS in the admin DB (branding), re-grant staff_org_roles,
//    then upsert into YR `organizations` (either directly or via sync-organization).
// 2. insert OPPORTUNITIES (each with application_form = SAMPLE_FORM).
// 3. insert chapter "Lahore Central" for Rizq.
// 4. create auth user + volunteers row for Ayesha Khan (status 'active',
//    id_doc_type 'cnic', id_doc_number synthetic), link to the chapter,
//    upload a placeholder identity_doc object + attachments row (status 'ready').
// 5. applications: Riverbank -> selected, Free Medical Camp -> under_review,
//    After-School Maths -> rejected. answers/form_snapshot = SAMPLE_FORM answered.
// 6. participation: Winter Shelter Kitchen -> participating; Ramadan, Riverbank,
//    Digital Literacy -> completed.
// 7. activity_hours: Winter Shelter x2 (pending); Ramadan x2 (verified, one with
//    hours_verified != hours_submitted); Riverbank x1 (verified);
//    Digital Literacy x3 (verified). Two session_photo attachments on the first
//    Winter Shelter session (placeholder objects, status 'ready').
// 8. return { volunteerEmail, volunteerPassword, orgSlugs }.
```

Write the full concrete script — no `// ...`. Placeholder image objects: a 1×1 PNG byte array uploaded to the bucket.

- [ ] **Step 2: Manual run** — `deno run -A backend/supabase/seed/seed.ts` against a local Supabase; eyeball that it completes and prints credentials.

- [ ] **Step 3: Commit.**

---

### Task 30: Post-seed smoke test

**Files:** Create `backend/supabase/seed/seed.test.ts`

- [ ] **Step 1: Write the test** — `Deno.test` that (given a local Supabase URL + service key in env): runs `reset.sql`, `runSeed(...)`, then asserts:
  - `select count(*) from opportunities` = 6.
  - `get-opportunity-detail` for the Ramadan opportunity returns `duties.length >= 3`, `eligibility.length >= 2`, `applicationForm.fields.length >= 3`.
  - `get-volunteer-portfolio` for Ayesha (sign in with the printed creds) returns `applications.length === 3`, `programmes.length === 4`, exactly one session with `adjusted === true`, at least one programme with `allVerified === false`, `totals.verifiedHours` equal to the sum of the seeded verified `hours_verified`.
  - `select * from org_branding` returns `brand_color` non-null for all 4.

- [ ] **Step 2: Run** — `deno test -A backend/supabase/seed/seed.test.ts` → PASS.

- [ ] **Step 3: Commit.**

---

### Task 31: Run the migration + seed on the linked project; hand over credentials

- [ ] **Step 1:** `cd backend/supabase && supabase db push` (YR project); `cd tmp-partner-admin/supabase && supabase db push` (admin project). Deploy all new/changed edge functions (`supabase functions deploy <name>` for each, both projects).
- [ ] **Step 2:** Run `reset.sql` + `admin_reset.sql`, then `deno run -A backend/supabase/seed/seed.ts` against the linked projects.
- [ ] **Step 3:** Post the volunteer email + generated password and confirm the existing admin / super-admin logins still authenticate. Update the project README / env docs with the three new bucket names and any new env vars.
- [ ] **Step 4:** Open the PR(s): one on `youth-republic` (branch `spec/backend-api-contract` → `main`), one on `tmp-partner-admin`. PR body summarises the contract change and links the spec.

---

## Self-Review

**Spec coverage:**

- organizations branding + `org_branding` view → Task 3; admin side → Task 9; sync → Task 20. ✓
- opportunities content sections + `application_form` → Task 4; create/update wiring → Task 21; detail read → Task 17. ✓
- applications dynamic-form columns → Task 5; apply flow → Task 16; admin projections → Task 25. ✓
- activity_hours note + status → Task 6; submit → Task 15; verify/adjust audit → Task 23; portfolio → Task 19. ✓
- attachments table + buckets → Task 7; upload/finalize/get → Tasks 10–12; linking in apply/submit/register → Tasks 14–16; policy module → Task 10. ✓
- volunteers id-doc rename → Task 8; register wiring → Task 14. ✓
- shared `forms.ts` → Tasks 1–2; vendored → Tasks 26–27. ✓
- central identity verification (`canVerifyIdentity`, `verify-volunteer`, `list-pending-volunteers`) → Tasks 13, 24. ✓
- admin_action_log new actions → Tasks 22, 23, 24. ✓
- list-opportunities filters + facets → Task 18. ✓
- frontend typed clients → Tasks 26–27. ✓
- reset & seed + smoke test + credentials → Tasks 28–31. ✓
- `update-opportunity-form` → Task 22. ✓

No spec section is unmapped.

**Placeholder scan:** Task 18 (facets) and Task 29 (opportunity list) say "copied from the prototype / spec table" — the executor has both documents; the values are enumerated in the spec's seed section and the prototype's `OPPORTUNITIES` array, and Task 29 explicitly requires writing them out concretely (no `// ...` in the committed file). Task 17/19 give exact return-type interfaces rather than full query code because the query is a straightforward join described field-by-field; acceptable at this granularity. No "TODO"/"add error handling"/"similar to Task N".

**Type consistency:** `FormDefinition`, `FieldDef`, `FieldErrors`, `validateFormDefinition`, `validateAnswers`, `resolveConsent` — consistent Tasks 1–2, 16, 21, 22, 26–27. `AttachmentDomain`, `ATTACHMENT_POLICY` — consistent Tasks 10–12. `StaffClaims.canVerifyIdentity` — introduced Task 13, consumed Tasks 12, 24. `computeOpportunityStatus` — reused from `list-opportunities/handler.ts` in Tasks 17–18. `id_doc_number` / `id_doc_type` — Tasks 8, 14, 16, 24, 25. Attachment `status` values `pending`/`ready` — consistent Tasks 7, 10, 11, 12, 15, 16.

## Execution Handoff

Plan complete and saved to `youth-republic/docs/superpowers/plans/2026-08-30-backend-api-contract.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
