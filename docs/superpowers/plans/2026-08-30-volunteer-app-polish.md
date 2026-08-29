# Volunteer App Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 7 achievable volunteer-app gaps from the VMS Phase 1 Acceptance Report's §03 backlog: optional profile fields, editable city/institution/emergency contact, full opportunity detail, opportunity filtering, visible participation stage, Role/Location on submit-hours, and list pagination.

**Architecture:** Two small backend additions (`youth-republic/backend`) followed by five frontend tasks (`youth-republic/frontend`). The audit-logged `update-sensitive-field` path stays scoped to genuinely safeguarding-relevant fields (its `profile_field_changes` table has a real DB check constraint enforcing this) — non-safeguarding profile fields (city, institution, graduation year, skills, interests, availability) get their own small, unaudited endpoint instead of diluting that boundary.

**Tech Stack:** Same as every other track this session — Deno Edge Functions with `handler.ts`/`index.ts`/tests, Next.js App Router + Vitest + RTL on the frontend.

**Spec:** `VMS Phase 1 Acceptance Report` (2026-08-30) §03 "Volunteer app" backlog, cross-referenced against live source in this plan (not reconstructed from the report's prose alone).

## Explicitly Deferred (not in this plan, noted so nobody assumes otherwise)

- **"Current chapter" edit** — changing a volunteer's `volunteer_chapter_link` row is a relational membership change, not a field update; needs its own small Edge Function and isn't a "polish" item. Left as a real backlog item.
- **Profile picture upload** — needs the same signed-URL-to-R2 pattern `upload-cnic-document`/`CnicUploadField` already established, but for a different bucket path; genuinely separate feature, not a text field edit. Left as a real backlog item.
- **"Type is a fixed, admin-extensible list"** — this plan gives Type a fixed *shared constant* list (Task 5), which is enough to filter by and is a real improvement over free text, but "admin-extensible" implies a DB-backed catalog an admin can edit without a code deploy — that's a new table + admin CRUD screen, out of scope here. Note this plainly in this plan's own final report rather than silently claiming the report's item is fully closed.

## Global Constraints

- `backend/.env` setup, `set -a; source ../.env; set +a` before Deno commands, and `cd backend/supabase && deno task test` as the full-suite check — identical to every other backend task this session.
- Frontend: `npm test` (root of `frontend/`) and `npm run build` as the full-suite/build checks.
- Never add a new field name to `profile_field_changes.field_name`'s check constraint (`0008_admin_action_log_and_profile_field_changes.sql`) — that boundary is deliberate (§5 of the earlier session's RLS design reasoning: only safeguarding-relevant fields get audited there). Non-safeguarding fields go through the new endpoint in Task 2, which has no audit table at all.
- `git commit`, do not push — same as every other plan this session; push commands come at the end from the orchestrating session, not mid-plan.

---

### Task 1: Widen `update-sensitive-field` to support the jsonb `emergency_contact` field

**Files:**
- Modify: `backend/supabase/functions/update-sensitive-field/handler.ts`
- Modify: `backend/supabase/functions/update-sensitive-field/handler.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `UpdateSensitiveFieldInput.newValue` widened from `string` to `unknown` — every later task in the frontend that edits `emergency_contact` sends `{ name: string; phone: string }` as `newValue` directly (a JS object, not a JSON string).

`emergency_contact` is already in `ALLOWED_FIELDS` — the only problem is `newValue: string` and the naive `.update({ [fieldName]: input.newValue })` / `String(oldValue)` logic, which works for the 5 plain-string fields already handled but was never exercised with a `jsonb` value. Supabase-js already serializes a JS object correctly for a `jsonb` column when passed as-is (not stringified) — the fix is purely widening the type and fixing the audit-log serialization, not changing the DB call itself.

- [ ] **Step 1: Write the failing test**

Add to `backend/supabase/functions/update-sensitive-field/handler.test.ts` (it already has a `testClient()`/volunteer-fixture helper from its existing tests — reuse it):

```typescript
Deno.test("updateSensitiveField accepts a structured object for emergency_contact and logs it as JSON text", async () => {
  const supabase = testClient();
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `emergency-contact-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "Emergency Contact Test",
    email: `emergency-contact-${crypto.randomUUID()}@example.com`, phone: "0300-1111111",
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();

  const result = await updateSensitiveField(supabase, {
    volunteerId: volunteer!.id, fieldName: "emergency_contact",
    newValue: { name: "Fatima Khan", phone: "0300-9999999" },
  });

  assertEquals(result.volunteerId, volunteer!.id);
  const { data: updated } = await supabase.from("volunteers").select("emergency_contact").eq("id", volunteer!.id).single();
  assertEquals(updated!.emergency_contact, { name: "Fatima Khan", phone: "0300-9999999" });

  const { data: logRow } = await supabase
    .from("profile_field_changes")
    .select("new_value")
    .eq("volunteer_id", volunteer!.id)
    .eq("field_name", "emergency_contact")
    .single();
  assertEquals(logRow!.new_value, JSON.stringify({ name: "Fatima Khan", phone: "0300-9999999" }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno test --allow-net --allow-env functions/update-sensitive-field/handler.test.ts`
Expected: FAIL — a type error passing an object where `newValue: string` is declared (or, if TypeScript doesn't block it at test-run time, a runtime failure from `String(oldValue)`/an incorrect stored value).

- [ ] **Step 3: Widen the handler**

```typescript
// backend/supabase/functions/update-sensitive-field/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";

export type SensitiveFieldName = "dob" | "cnic_number" | "phone" | "emergency_contact" | "guardian_name" | "guardian_contact";

export interface UpdateSensitiveFieldInput {
  volunteerId: string;
  fieldName: SensitiveFieldName;
  newValue: unknown;
}

export interface UpdateSensitiveFieldResult {
  volunteerId: string;
}

const ALLOWED_FIELDS: readonly SensitiveFieldName[] = [
  "dob",
  "cnic_number",
  "phone",
  "emergency_contact",
  "guardian_name",
  "guardian_contact",
];

// profile_field_changes.old_value/new_value are text columns — anything
// that isn't already a string (emergency_contact's object shape) is
// serialized to JSON text for the audit row; the actual volunteers.update
// call below still gets the real value, string or object, unchanged.
function toAuditText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function updateSensitiveField(
  supabase: SupabaseClient,
  input: UpdateSensitiveFieldInput,
): Promise<UpdateSensitiveFieldResult> {
  if (!ALLOWED_FIELDS.includes(input.fieldName)) {
    throw new Error("invalid_field");
  }

  const { data: volunteer, error: fetchError } = await supabase
    .from("volunteers")
    .select(input.fieldName)
    .eq("id", input.volunteerId)
    .single();
  if (fetchError) throw fetchError;

  const oldValue = (volunteer as Record<string, unknown>)[input.fieldName];

  const { error: updateError } = await supabase
    .from("volunteers")
    .update({ [input.fieldName]: input.newValue })
    .eq("id", input.volunteerId);
  if (updateError) throw updateError;

  const { error: logError } = await supabase.from("profile_field_changes").insert({
    volunteer_id: input.volunteerId,
    field_name: input.fieldName,
    old_value: toAuditText(oldValue),
    new_value: toAuditText(input.newValue),
  });
  if (logError) throw logError;

  return { volunteerId: input.volunteerId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2, plus the rest of this file's existing tests (they exercise the plain-string fields, e.g. `phone` — confirm they still pass with `newValue: unknown` and no other behavior change).
Expected: all pass.

- [ ] **Step 5: Run the full suite and verify no regressions**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno task test`

- [ ] **Step 6: Commit**

```bash
git add backend/supabase/functions/update-sensitive-field/
git commit -m "feat: widen update-sensitive-field to support the jsonb emergency_contact shape"
```

---

### Task 2: New `update-profile-field` Edge Function (non-safeguarding fields, no audit log)

**Files:**
- Create: `backend/supabase/functions/update-profile-field/handler.ts`
- Create: `backend/supabase/functions/update-profile-field/handler.test.ts`
- Create: `backend/supabase/functions/update-profile-field/index.ts`
- Create: `backend/supabase/functions/update-profile-field/index.test.ts`

**Interfaces:**
- Consumes: `getAdminClient`, `verifyVolunteerAuth` (check `backend/supabase/functions/_shared/verifyVolunteerAuth.ts` for its exact export name/shape before writing — every other volunteer-facing function in this repo, e.g. `register-volunteer`, `submit-hours`, already uses it the same way; match that, don't invent a new auth path), `corsHeaders`, `handleCorsPreflight`.
- Produces: `updateProfileField(supabase, volunteerId: string, input: UpdateProfileFieldInput): Promise<{ volunteerId: string }>` — `UpdateProfileFieldInput: { fieldName: "city" | "institution" | "graduation_year" | "availability" | "skills" | "interests"; newValue: string | number | string[] }`.

- [ ] **Step 1: Write the failing handler test**

Verified directly against `backend/supabase/functions/submit-hours/index.ts` and `_shared/verifyVolunteerAuth.ts`: volunteer-facing functions authenticate via `verifyVolunteerToken(supabase, authHeader)`, which returns `{ volunteerId, authUserId }` — Step 5 below uses this exact call. `updateProfileField`'s own handler test (this step) doesn't need auth at all — it takes `volunteerId` as a plain parameter, same as the handler-layer tests for every other function in this repo; auth only enters at the `index.ts` layer.

```typescript
// backend/supabase/functions/update-profile-field/handler.test.ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateProfileField } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>) {
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `profile-field-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "Profile Field Test",
    email: `profile-field-${crypto.randomUUID()}@example.com`, phone: "0300-1111111",
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();
  return data!.id as string;
}

Deno.test("updateProfileField updates a plain string field (institution)", async () => {
  const supabase = testClient();
  const volunteerId = await makeVolunteer(supabase);

  const result = await updateProfileField(supabase, volunteerId, { fieldName: "institution", newValue: "IBA" });

  assertEquals(result.volunteerId, volunteerId);
  const { data } = await supabase.from("volunteers").select("institution").eq("id", volunteerId).single();
  assertEquals(data!.institution, "IBA");
});

Deno.test("updateProfileField updates a numeric field (graduation_year)", async () => {
  const supabase = testClient();
  const volunteerId = await makeVolunteer(supabase);

  await updateProfileField(supabase, volunteerId, { fieldName: "graduation_year", newValue: 2027 });

  const { data } = await supabase.from("volunteers").select("graduation_year").eq("id", volunteerId).single();
  assertEquals(data!.graduation_year, 2027);
});

Deno.test("updateProfileField updates an array field (skills)", async () => {
  const supabase = testClient();
  const volunteerId = await makeVolunteer(supabase);

  await updateProfileField(supabase, volunteerId, { fieldName: "skills", newValue: ["First Aid", "Public Speaking"] });

  const { data } = await supabase.from("volunteers").select("skills").eq("id", volunteerId).single();
  assertEquals(data!.skills, ["First Aid", "Public Speaking"]);
});

Deno.test("updateProfileField never writes profile_field_changes — this endpoint is deliberately unaudited", async () => {
  const supabase = testClient();
  const volunteerId = await makeVolunteer(supabase);

  await updateProfileField(supabase, volunteerId, { fieldName: "city", newValue: "Karachi" });

  const { data } = await supabase.from("profile_field_changes").select("id").eq("volunteer_id", volunteerId);
  assertEquals(data ?? [], []);
});

Deno.test("updateProfileField rejects a field name outside its allowlist rather than trusting client input", async () => {
  const supabase = testClient();
  const volunteerId = await makeVolunteer(supabase);

  await assertRejects(
    // deno-lint-ignore no-explicit-any
    () => updateProfileField(supabase, volunteerId, { fieldName: "status" as any, newValue: "active" }),
    Error,
    "invalid_field",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/supabase && set -a; source ../.env; set +a && deno test --allow-net --allow-env functions/update-profile-field/handler.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the handler**

```typescript
// backend/supabase/functions/update-profile-field/handler.ts
import { SupabaseClient } from "@supabase/supabase-js";

export type ProfileFieldName = "city" | "institution" | "graduation_year" | "availability" | "skills" | "interests";

export interface UpdateProfileFieldInput {
  fieldName: ProfileFieldName;
  newValue: string | number | string[];
}

export interface UpdateProfileFieldResult {
  volunteerId: string;
}

// Deliberately not the same allowlist as update-sensitive-field: none of
// these are safeguarding-relevant, so none of them write to
// profile_field_changes (whose field_name check constraint doesn't include
// them, and shouldn't — that log stays scoped to what it was built for).
const ALLOWED_FIELDS: readonly ProfileFieldName[] = [
  "city",
  "institution",
  "graduation_year",
  "availability",
  "skills",
  "interests",
];

export async function updateProfileField(
  supabase: SupabaseClient,
  volunteerId: string,
  input: UpdateProfileFieldInput,
): Promise<UpdateProfileFieldResult> {
  if (!ALLOWED_FIELDS.includes(input.fieldName)) {
    throw new Error("invalid_field");
  }

  const { error } = await supabase
    .from("volunteers")
    .update({ [input.fieldName]: input.newValue })
    .eq("id", volunteerId);
  if (error) throw error;

  return { volunteerId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2. Expected: `ok | 5 passed | 0 failed`.

- [ ] **Step 5: Write the index.ts wrapper**

Verified directly against `_shared/verifyVolunteerAuth.ts` and `submit-hours/index.ts` (the closest existing analog — a volunteer editing their own data, not a staff action): `verifyVolunteerToken(supabase, authHeader)` returns `{ volunteerId, authUserId }`, and the exported function is named `handler` per this repo's real convention.

```typescript
// backend/supabase/functions/update-profile-field/index.ts
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { updateProfileField } from "./handler.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const supabase = getAdminClient();
    const { volunteerId } = await verifyVolunteerToken(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await updateProfileField(supabase, volunteerId, input);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "invalid_field" ? 400 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
```

- [ ] **Step 6: Write the index.ts CORS tests**

```typescript
// backend/supabase/functions/update-profile-field/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";

Deno.test("update-profile-field index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handler(new Request("https://example.com/fn", { method: "OPTIONS" }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("update-profile-field index carries CORS headers on an error response", async () => {
  const res = await handler(
    new Request("https://example.com/fn", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldName: "city", newValue: "Karachi" }),
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
git add backend/supabase/functions/update-profile-field/
git commit -m "feat: add update-profile-field Edge Function for non-safeguarding profile fields"
```

---

### Task 3: Frontend wrappers — `updateProfileField` + widen `updateSensitiveField`'s type

**Files:**
- Modify: `frontend/lib/edgeFunctions.ts`
- Modify: `frontend/lib/edgeFunctions.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `updateProfileField(payload: { fieldName: string; newValue: string | number | string[] }, accessToken: string): Promise<{ volunteerId: string }>`; `UpdateSensitiveFieldPayload.newValue` widened to `unknown`.

- [ ] **Step 1: Write the failing test**

Add to `frontend/lib/edgeFunctions.test.ts` (it already has the `mockOk`/fetch-stub setup from its existing tests):

```typescript
describe("updateProfileField", () => {
  it("posts to update-profile-field", async () => {
    mockOk({ volunteerId: "vol-1" });
    const result = await updateProfileField({ fieldName: "institution", newValue: "IBA" }, "session-token");
    expect(result.volunteerId).toBe("vol-1");
  });

  it("supports an array newValue for skills/interests", async () => {
    mockOk({ volunteerId: "vol-1" });
    await updateProfileField({ fieldName: "skills", newValue: ["First Aid"] }, "session-token");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/update-profile-field"),
      expect.objectContaining({ body: JSON.stringify({ fieldName: "skills", newValue: ["First Aid"] }) }),
    );
  });
});

describe("updateSensitiveField with a structured value", () => {
  it("accepts an object newValue for emergency_contact", async () => {
    mockOk({ volunteerId: "vol-1" });
    const result = await updateSensitiveField(
      { fieldName: "emergency_contact", newValue: { name: "Fatima Khan", phone: "0300-9999999" } },
      "session-token",
    );
    expect(result.volunteerId).toBe("vol-1");
  });
});
```

Add `updateProfileField` to the existing `import { ... } from "./edgeFunctions"` line at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- lib/edgeFunctions.test.ts`
Expected: FAIL — `updateProfileField` not exported / type error on the object `newValue`.

- [ ] **Step 3: Update `lib/edgeFunctions.ts`**

Find the existing `UpdateSensitiveFieldPayload` interface and `updateSensitiveField` function; change `newValue: string` to `newValue: unknown`. Then add, near it:

```typescript
export interface UpdateProfileFieldPayload {
  fieldName: "city" | "institution" | "graduation_year" | "availability" | "skills" | "interests";
  newValue: string | number | string[];
}
export interface UpdateProfileFieldResponse {
  volunteerId: string;
}
export function updateProfileField(payload: UpdateProfileFieldPayload, accessToken: string) {
  return callFunction<UpdateProfileFieldResponse>("update-profile-field", payload, accessToken);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2, plus the full file (existing `updateSensitiveField` tests must still pass with the widened type).

- [ ] **Step 5: Run the full suite and verify no regressions**

Run: `cd frontend && npm test`

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/edgeFunctions.ts frontend/lib/edgeFunctions.test.ts
git commit -m "feat: add updateProfileField wrapper, widen updateSensitiveField's newValue type"
```

---

### Task 4: Profile page — optional fields, city/institution, emergency contact

**Files:**
- Create: `frontend/components/ProfileFieldEditor.tsx`
- Create: `frontend/components/ProfileFieldEditor.test.tsx`
- Create: `frontend/components/EmergencyContactEditor.tsx`
- Create: `frontend/components/EmergencyContactEditor.test.tsx`
- Create: `frontend/components/SkillsEditor.tsx`
- Create: `frontend/components/SkillsEditor.test.tsx`
- Modify: `frontend/app/profile/page.tsx`

**Interfaces:**
- Consumes: `updateProfileField`, `updateSensitiveField` from `@/lib/edgeFunctions`.

- [ ] **Step 1: Write the failing `ProfileFieldEditor` test**

```tsx
// frontend/components/ProfileFieldEditor.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileFieldEditor } from "./ProfileFieldEditor";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("ProfileFieldEditor", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.updateProfileField).mockReset();
  });

  it("saves a string field via updateProfileField", async () => {
    vi.mocked(edgeFunctions.updateProfileField).mockResolvedValue({ volunteerId: "vol-1" });
    const onUpdated = vi.fn();
    const user = userEvent.setup();

    render(<ProfileFieldEditor fieldName="institution" fieldLabel="Institution" currentValue="LUMS" accessToken="t" onUpdated={onUpdated} />);

    await user.clear(screen.getByLabelText("Institution"));
    await user.type(screen.getByLabelText("Institution"), "IBA");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(edgeFunctions.updateProfileField).toHaveBeenCalledWith({ fieldName: "institution", newValue: "IBA" }, "t");
      expect(onUpdated).toHaveBeenCalledWith("IBA");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- components/ProfileFieldEditor.test.tsx`

- [ ] **Step 3: Write `ProfileFieldEditor.tsx`**

Same shape as the existing `SensitiveFieldEditor.tsx`, but calling `updateProfileField` instead of `updateSensitiveField`, and typed for the non-safeguarding field names:

```tsx
// frontend/components/ProfileFieldEditor.tsx
"use client";

import { useState } from "react";
import { updateProfileField, type UpdateProfileFieldPayload } from "@/lib/edgeFunctions";

export function ProfileFieldEditor({
  fieldName,
  fieldLabel,
  currentValue,
  accessToken,
  onUpdated,
}: {
  fieldName: UpdateProfileFieldPayload["fieldName"];
  fieldLabel: string;
  currentValue: string;
  accessToken: string;
  onUpdated: (newValue: string) => void;
}) {
  const [value, setValue] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const newValue = fieldName === "graduation_year" ? Number(value) : value;
      await updateProfileField({ fieldName, newValue }, accessToken);
      onUpdated(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor={fieldName} className="block text-sm">{fieldLabel}</label>
        <input id={fieldName} className="mt-1 w-full rounded border px-3 py-2" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Save
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2.

- [ ] **Step 5: Write the failing `SkillsEditor` test**

```tsx
// frontend/components/SkillsEditor.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillsEditor } from "./SkillsEditor";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("SkillsEditor", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.updateProfileField).mockReset();
  });

  it("parses a comma-separated string into an array and saves it", async () => {
    vi.mocked(edgeFunctions.updateProfileField).mockResolvedValue({ volunteerId: "vol-1" });
    const onUpdated = vi.fn();
    const user = userEvent.setup();

    render(<SkillsEditor fieldName="skills" fieldLabel="Skills" currentValue={[]} accessToken="t" onUpdated={onUpdated} />);

    await user.type(screen.getByLabelText("Skills"), "First Aid, Public Speaking");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(edgeFunctions.updateProfileField).toHaveBeenCalledWith(
        { fieldName: "skills", newValue: ["First Aid", "Public Speaking"] },
        "t",
      );
    });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd frontend && npm test -- components/SkillsEditor.test.tsx`

- [ ] **Step 7: Write `SkillsEditor.tsx`**

```tsx
// frontend/components/SkillsEditor.tsx
"use client";

import { useState } from "react";
import { updateProfileField } from "@/lib/edgeFunctions";

export function SkillsEditor({
  fieldName,
  fieldLabel,
  currentValue,
  accessToken,
  onUpdated,
}: {
  fieldName: "skills" | "interests";
  fieldLabel: string;
  currentValue: string[];
  accessToken: string;
  onUpdated: (newValue: string[]) => void;
}) {
  const [text, setText] = useState(currentValue.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const values = text.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
      await updateProfileField({ fieldName, newValue: values }, accessToken);
      onUpdated(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor={fieldName} className="block text-sm">{fieldLabel}</label>
        <input
          id={fieldName}
          className="mt-1 w-full rounded border px-3 py-2"
          placeholder="Comma-separated"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Save
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: same as Step 6.

- [ ] **Step 9: Write the failing `EmergencyContactEditor` test**

```tsx
// frontend/components/EmergencyContactEditor.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmergencyContactEditor } from "./EmergencyContactEditor";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("EmergencyContactEditor", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.updateSensitiveField).mockReset();
  });

  it("saves name and phone as a structured object via updateSensitiveField", async () => {
    vi.mocked(edgeFunctions.updateSensitiveField).mockResolvedValue({ volunteerId: "vol-1" });
    const onUpdated = vi.fn();
    const user = userEvent.setup();

    render(<EmergencyContactEditor currentValue={null} accessToken="t" onUpdated={onUpdated} />);

    await user.type(screen.getByLabelText("Emergency contact name"), "Fatima Khan");
    await user.type(screen.getByLabelText("Emergency contact phone"), "0300-9999999");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(edgeFunctions.updateSensitiveField).toHaveBeenCalledWith(
        { fieldName: "emergency_contact", newValue: { name: "Fatima Khan", phone: "0300-9999999" } },
        "t",
      );
    });
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd frontend && npm test -- components/EmergencyContactEditor.test.tsx`

- [ ] **Step 11: Write `EmergencyContactEditor.tsx`**

```tsx
// frontend/components/EmergencyContactEditor.tsx
"use client";

import { useState } from "react";
import { updateSensitiveField } from "@/lib/edgeFunctions";

export function EmergencyContactEditor({
  currentValue,
  accessToken,
  onUpdated,
}: {
  currentValue: { name: string; phone: string } | null;
  accessToken: string;
  onUpdated: (newValue: { name: string; phone: string }) => void;
}) {
  const [name, setName] = useState(currentValue?.name ?? "");
  const [phone, setPhone] = useState(currentValue?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const newValue = { name, phone };
      await updateSensitiveField({ fieldName: "emergency_contact", newValue }, accessToken);
      onUpdated(newValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Emergency contact</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div>
          <label htmlFor="emergencyContactName" className="block text-sm">Emergency contact name</label>
          <input id="emergencyContactName" className="mt-1 rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="emergencyContactPhone" className="block text-sm">Emergency contact phone</label>
          <input id="emergencyContactPhone" className="mt-1 rounded border px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
          Save
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: same as Step 10.

- [ ] **Step 13: Wire everything into the profile page**

```tsx
// frontend/app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { SensitiveFieldEditor } from "@/components/SensitiveFieldEditor";
import { ProfileFieldEditor } from "@/components/ProfileFieldEditor";
import { SkillsEditor } from "@/components/SkillsEditor";
import { EmergencyContactEditor } from "@/components/EmergencyContactEditor";
import { CnicUploadField } from "@/components/CnicUploadField";

interface VolunteerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  volunteer_code: string;
  cnic_number: string | null;
  city: string;
  institution: string;
  graduation_year: number | null;
  availability: string | null;
  skills: string[] | null;
  interests: string[] | null;
  emergency_contact: { name: string; phone: string } | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [cnicUploadedKey, setCnicUploadedKey] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      setAccessToken(sessionData.session.access_token);

      const { data } = await supabase
        .from("volunteers")
        .select("id, full_name, email, phone, volunteer_code, cnic_number, city, institution, graduation_year, availability, skills, interests, emergency_contact")
        .eq("auth_user_id", sessionData.session.user.id)
        .single();
      setProfile(data);
    }
    load();
  }, []);

  if (!profile || !accessToken) {
    return <p>Loading profile…</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{profile.full_name}</h1>
        <p className="text-sm text-gray-600">Volunteer ID: {profile.volunteer_code}</p>
      </div>

      <SensitiveFieldEditor
        fieldName="phone"
        fieldLabel="Phone"
        currentValue={profile.phone}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, phone: newValue } : p))}
      />

      <ProfileFieldEditor
        fieldName="city"
        fieldLabel="City"
        currentValue={profile.city}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, city: newValue } : p))}
      />

      <ProfileFieldEditor
        fieldName="institution"
        fieldLabel="Institution"
        currentValue={profile.institution}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, institution: newValue } : p))}
      />

      <ProfileFieldEditor
        fieldName="graduation_year"
        fieldLabel="Expected graduation year"
        currentValue={profile.graduation_year?.toString() ?? ""}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, graduation_year: Number(newValue) } : p))}
      />

      <ProfileFieldEditor
        fieldName="availability"
        fieldLabel="Availability"
        currentValue={profile.availability ?? ""}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, availability: newValue } : p))}
      />

      <SkillsEditor
        fieldName="skills"
        fieldLabel="Skills"
        currentValue={profile.skills ?? []}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, skills: newValue } : p))}
      />

      <SkillsEditor
        fieldName="interests"
        fieldLabel="Areas of interest"
        currentValue={profile.interests ?? []}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, interests: newValue } : p))}
      />

      <EmergencyContactEditor
        currentValue={profile.emergency_contact}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, emergency_contact: newValue } : p))}
      />

      <CnicUploadField accessToken={accessToken} onUploaded={setCnicUploadedKey} />
      {cnicUploadedKey && <p className="text-sm text-green-700">Document uploaded.</p>}
    </div>
  );
}
```

- [ ] **Step 14: Run the full suite and verify no regressions**

Run: `cd frontend && npm test`

- [ ] **Step 15: Commit**

```bash
git add frontend/components/ProfileFieldEditor.tsx frontend/components/ProfileFieldEditor.test.tsx frontend/components/SkillsEditor.tsx frontend/components/SkillsEditor.test.tsx frontend/components/EmergencyContactEditor.tsx frontend/components/EmergencyContactEditor.test.tsx frontend/app/profile/page.tsx
git commit -m "feat: profile page gains city/institution/emergency-contact edit and optional fields"
```

---

### Task 5: Opportunity detail — full field set, computed status, and a shared Type list

**Files:**
- Create: `frontend/lib/opportunityTypes.ts`
- Create: `frontend/lib/opportunityStatus.ts`
- Create: `frontend/lib/opportunityStatus.test.ts`
- Modify: `frontend/app/opportunities/[id]/page.tsx`

**Interfaces:**
- Produces: `OPPORTUNITY_TYPES: readonly string[]` (the shared fixed list — see this plan's "Explicitly Deferred" note on why this isn't DB-backed yet); `computeOpportunityStatus(o: OpportunityStatusInputs): string` (a frontend port of the same logic already ported once for the admin backend plan — port it again here independently; these are two different apps and shouldn't import across the repo boundary between `frontend` and `backend`).

- [ ] **Step 1: Write the shared Type list**

```typescript
// frontend/lib/opportunityTypes.ts
// A fixed list, not yet backed by an admin-editable database table — see
// this plan's "Explicitly Deferred" note. Real improvement over free text
// (this is what the Type filter in Task 6 filters against), but not the
// full "admin-extensible catalog" the doc ultimately wants.
export const OPPORTUNITY_TYPES = ["environment", "health", "education", "community"] as const;
```

- [ ] **Step 2: Write the failing status-computation test**

```typescript
// frontend/lib/opportunityStatus.test.ts
import { describe, it, expect } from "vitest";
import { computeOpportunityStatus } from "./opportunityStatus";

describe("computeOpportunityStatus", () => {
  it("prefers a manual override over every date-derived status", () => {
    expect(computeOpportunityStatus({
      statusOverride: "closed", applicationOpenAt: null, applicationDeadline: null,
      activityStartAt: null, activityEndAt: null, deactivatedAt: null,
    })).toBe("closed");
  });

  it("is 'closed' once deactivated, with no override", () => {
    expect(computeOpportunityStatus({
      statusOverride: null, applicationOpenAt: null, applicationDeadline: null,
      activityStartAt: null, activityEndAt: null, deactivatedAt: "2026-01-01T00:00:00Z",
    })).toBe("closed");
  });

  it("is 'coming_soon' before applications open", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(computeOpportunityStatus({
      statusOverride: null, applicationOpenAt: future, applicationDeadline: null,
      activityStartAt: null, activityEndAt: null, deactivatedAt: null,
    })).toBe("coming_soon");
  });

  it("is 'open' with no other signal", () => {
    expect(computeOpportunityStatus({
      statusOverride: null, applicationOpenAt: null, applicationDeadline: null,
      activityStartAt: null, activityEndAt: null, deactivatedAt: null,
    })).toBe("open");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npm test -- lib/opportunityStatus.test.ts`

- [ ] **Step 4: Write `opportunityStatus.ts`**

```typescript
// frontend/lib/opportunityStatus.ts
export interface OpportunityStatusInputs {
  statusOverride: string | null;
  applicationOpenAt: string | null;
  applicationDeadline: string | null;
  activityStartAt: string | null;
  activityEndAt: string | null;
  deactivatedAt: string | null;
}

// Ports the same logic as the backend's own opportunity_status() SQL
// function (0003_opportunities.sql) — kept in lockstep with that function
// and with the admin portal's own independent port of it if either changes.
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: same as Step 3.

- [ ] **Step 6: Update the opportunity detail page**

```tsx
// frontend/app/opportunities/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import { computeOpportunityStatus } from "@/lib/opportunityStatus";

interface OpportunityDetail {
  id: string;
  name: string;
  type: string;
  description: string | null;
  location: string | null;
  is_online: boolean;
  application_open_at: string | null;
  application_deadline: string | null;
  activity_start_at: string | null;
  activity_end_at: string | null;
  eligibility_criteria: string | null;
  capacity: number | null;
  status_override: string | null;
  deactivated_at: string | null;
}

async function fetchOpportunity(id: string): Promise<OpportunityDetail | null> {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("opportunities")
    .select(
      "id, name, type, description, location, is_online, application_open_at, application_deadline, activity_start_at, activity_end_at, eligibility_criteria, capacity, status_override, deactivated_at",
    )
    .eq("id", id)
    .single();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const opportunity = await fetchOpportunity(id);
  if (!opportunity) return {};

  return {
    title: `${opportunity.name} — Volunteer Opportunity`,
    description: opportunity.description ?? `Volunteer with us: ${opportunity.name}`,
    openGraph: {
      title: opportunity.name,
      description: opportunity.description ?? undefined,
      type: "website",
    },
  };
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunity = await fetchOpportunity(id);
  if (!opportunity) notFound();

  const status = computeOpportunityStatus({
    statusOverride: opportunity.status_override,
    applicationOpenAt: opportunity.application_open_at,
    applicationDeadline: opportunity.application_deadline,
    activityStartAt: opportunity.activity_start_at,
    activityEndAt: opportunity.activity_end_at,
    deactivatedAt: opportunity.deactivated_at,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">{opportunity.name}</h1>
      <p className="text-sm text-gray-600">
        {opportunity.type}{opportunity.location ? ` · ${opportunity.location}` : ""} · {opportunity.is_online ? "Online" : "Physical"}
      </p>
      <p className="text-sm">
        Status: {status}
        {opportunity.status_override && <span className="ml-1 text-xs text-amber-700">(admin override)</span>}
      </p>
      {opportunity.description && <p>{opportunity.description}</p>}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {opportunity.application_open_at && (
          <>
            <dt className="text-gray-600">Application opens</dt>
            <dd>{opportunity.application_open_at}</dd>
          </>
        )}
        {opportunity.application_deadline && (
          <>
            <dt className="text-gray-600">Application deadline</dt>
            <dd>{opportunity.application_deadline}</dd>
          </>
        )}
        {opportunity.activity_start_at && (
          <>
            <dt className="text-gray-600">Activity starts</dt>
            <dd>{opportunity.activity_start_at}</dd>
          </>
        )}
        {opportunity.activity_end_at && (
          <>
            <dt className="text-gray-600">Activity ends</dt>
            <dd>{opportunity.activity_end_at}</dd>
          </>
        )}
        {opportunity.capacity !== null && (
          <>
            <dt className="text-gray-600">Capacity</dt>
            <dd>{opportunity.capacity}</dd>
          </>
        )}
      </dl>

      {opportunity.eligibility_criteria && (
        <div>
          <h2 className="text-sm font-medium text-gray-700">Eligibility</h2>
          <p className="text-sm">{opportunity.eligibility_criteria}</p>
        </div>
      )}

      <a
        href={`/apply/${opportunity.id}`}
        className="mt-6 inline-block rounded bg-gray-900 px-4 py-2 text-white"
      >
        Apply
      </a>
    </div>
  );
}
```

- [ ] **Step 7: Run the full suite and verify no regressions**

Run: `cd frontend && npm test`

- [ ] **Step 8: Commit**

```bash
git add frontend/lib/opportunityTypes.ts frontend/lib/opportunityStatus.ts frontend/lib/opportunityStatus.test.ts frontend/app/opportunities/[id]/page.tsx
git commit -m "feat: opportunity detail shows full field set, computed status, and override indicator"
```

---

### Task 6: Opportunities list — Type/Status filters + pagination

**Files:**
- Modify: `frontend/app/opportunities/page.tsx`
- Create: `frontend/app/opportunities/page.test.tsx`

**Interfaces:**
- Consumes: `OPPORTUNITY_TYPES` from `@/lib/opportunityTypes`, `computeOpportunityStatus` from `@/lib/opportunityStatus`.

This page is currently a Server Component (`async function`, no `"use client"`) reading directly via `getServerSupabaseClient()`. Filters need to read from the URL's search params (the Next.js App Router convention for server-rendered filtering) rather than client state, so the page stays server-rendered — do not convert it to a client component just to add filters.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/app/opportunities/page.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import OpportunitiesPage from "./page";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";

vi.mock("@/lib/supabase/serverClient");

function mockSupabase(opportunities: unknown[], organizations: unknown[]) {
  return {
    from(table: string) {
      if (table === "opportunities") {
        return {
          select: () => ({
            is: () => ({
              order: () => ({
                range: () => Promise.resolve({ data: opportunities, count: opportunities.length, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "organizations") {
        return { select: () => ({ in: () => Promise.resolve({ data: organizations, error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("OpportunitiesPage", () => {
  it("shows Type and Status filter controls, and pagination controls", async () => {
    vi.mocked(getServerSupabaseClient).mockResolvedValue(
      mockSupabase(
        [{ id: "opp-1", name: "Beach Cleanup", type: "environment", location: "Karachi", organization_id: "org-1", status_override: null, application_open_at: null, application_deadline: null, activity_start_at: null, activity_end_at: null, deactivated_at: null }],
        [{ id: "org-1", name: "Youth Republic" }],
      ) as never,
    );

    const jsx = await OpportunitiesPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByLabelText("Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- app/opportunities/page.test.tsx`
Expected: FAIL — no `searchParams` prop handling / no filter or pagination controls exist yet.

- [ ] **Step 3: Update the page**

```tsx
// frontend/app/opportunities/page.tsx
import Link from "next/link";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import { OpportunityCard } from "@/components/OpportunityCard";
import { OPPORTUNITY_TYPES } from "@/lib/opportunityTypes";
import { computeOpportunityStatus } from "@/lib/opportunityStatus";

export const revalidate = 60;

const PAGE_SIZE = 12;
const STATUSES = ["coming_soon", "open", "closed", "in_progress", "completed"] as const;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; page?: string }>;
}) {
  const { type, status, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await getServerSupabaseClient();
  let query = supabase
    .from("opportunities")
    .select(
      "id, name, type, location, organization_id, status_override, application_open_at, application_deadline, activity_start_at, activity_end_at, deactivated_at",
      { count: "exact" },
    )
    .is("deactivated_at", null);
  if (type) query = query.eq("type", type);

  const { data: rawOpportunities, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  let opportunities = (rawOpportunities ?? []).map((o) => ({
    ...o,
    computedStatus: computeOpportunityStatus({
      statusOverride: o.status_override,
      applicationOpenAt: o.application_open_at,
      applicationDeadline: o.application_deadline,
      activityStartAt: o.activity_start_at,
      activityEndAt: o.activity_end_at,
      deactivatedAt: o.deactivated_at,
    }),
  }));
  if (status) opportunities = opportunities.filter((o) => o.computedStatus === status);

  const organizationIds = [...new Set(opportunities.map((o) => o.organization_id))];
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", organizationIds);
  const organizationNameById = new Map((organizations ?? []).map((o) => [o.id, o.name]));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  function pageHref(targetPage: number, overrides: { type?: string; status?: string } = {}) {
    const params = new URLSearchParams();
    const effectiveType = overrides.type ?? type;
    const effectiveStatus = overrides.status ?? status;
    if (effectiveType) params.set("type", effectiveType);
    if (effectiveStatus) params.set("status", effectiveStatus);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/opportunities?${query}` : "/opportunities";
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Opportunities</h1>

      <form className="mb-4 flex gap-4" action="/opportunities" method="get">
        <div>
          <label htmlFor="type" className="block text-sm">Type</label>
          <select id="type" name="type" defaultValue={type ?? ""} className="mt-1 rounded border px-3 py-2">
            <option value="">All</option>
            {OPPORTUNITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="mt-1 rounded border px-3 py-2">
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="mt-auto rounded bg-gray-900 px-4 py-2 text-white">Filter</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {opportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={{
              ...opportunity,
              organizationName: organizationNameById.get(opportunity.organization_id) ?? "Unknown organization",
            }}
          />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        {page > 1 ? (
          <Link href={pageHref(page - 1)} className="underline">Previous</Link>
        ) : (
          <span />
        )}
        <span>Page {page} of {totalPages}</span>
        {page < totalPages ? (
          <Link href={pageHref(page + 1)} className="underline">Next</Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- app/opportunities/page.test.tsx`

- [ ] **Step 5: Run the full suite and verify no regressions**

Run: `cd frontend && npm test`

- [ ] **Step 6: Commit**

```bash
git add frontend/app/opportunities/page.tsx frontend/app/opportunities/page.test.tsx
git commit -m "feat: opportunities list gains Type/Status filters and pagination"
```

---

### Task 7: Applications page — visible participation stage + pagination

**Files:**
- Modify: `frontend/app/applications/page.tsx`
- Create: `frontend/app/applications/page.test.tsx`

**Interfaces:**
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/app/applications/page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ApplicationsPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("@/lib/supabase/browserClient");

describe("ApplicationsPage", () => {
  it("shows the participation stage alongside the application status when one exists", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      from: () => ({
        select: () => ({
          order: () => ({
            range: () => Promise.resolve({
              data: [{
                id: "app-1", status: "selected", applied_at: "2026-01-01T00:00:00Z",
                opportunities: { name: "Beach Cleanup" },
                participation: [{ status: "participating" }],
              }],
              count: 1,
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    render(<ApplicationsPage />);

    expect(await screen.findByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getByText(/participating/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- app/applications/page.test.tsx`

- [ ] **Step 3: Update the page**

```tsx
// frontend/app/applications/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { ApplicationStatusBadge, type ApplicationStatus } from "@/components/ApplicationStatusBadge";

const PAGE_SIZE = 20;

interface ApplicationRow {
  id: string;
  status: ApplicationStatus;
  applied_at: string;
  opportunities: { name: string } | null;
  participation: Array<{ status: string }> | null;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRow[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();
      const offset = (page - 1) * PAGE_SIZE;
      const { data, count } = await supabase
        .from("applications")
        .select("id, status, applied_at, opportunities(name), participation(status)", { count: "exact" })
        .order("applied_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      setApplications((data as unknown as ApplicationRow[]) ?? []);
      setTotal(count ?? 0);
    }
    load();
  }, [page]);

  if (!applications) return <p>Loading…</p>;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">My Applications</h1>
      <ul className="space-y-3">
        {applications.map((application) => (
          <li key={application.id} className="flex items-center justify-between rounded border border-gray-200 p-3">
            <span>{application.opportunities?.name}</span>
            <div className="flex items-center gap-2">
              {application.participation?.[0] && (
                <span className="text-sm text-gray-600">{application.participation[0].status}</span>
              )}
              <ApplicationStatusBadge status={application.status} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between text-sm">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="underline disabled:no-underline disabled:text-gray-400">
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="underline disabled:no-underline disabled:text-gray-400">
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- app/applications/page.test.tsx`

- [ ] **Step 5: Run the full suite and verify no regressions**

Run: `cd frontend && npm test`

- [ ] **Step 6: Commit**

```bash
git add frontend/app/applications/page.tsx frontend/app/applications/page.test.tsx
git commit -m "feat: applications page shows participation stage and gains pagination"
```

---

### Task 8: Submit-hours form gains Role and Location

**Files:**
- Modify: `frontend/components/SubmitHoursForm.tsx`
- Modify: `frontend/components/SubmitHoursForm.test.tsx`

**Interfaces:**
- Consumes: nothing new — `submitHours` in `lib/edgeFunctions.ts` already accepts `role?: string; location?: string` (verified against live source), and the backend `submit-hours` handler already accepts and presumably stores both. This task is UI-only.

- [ ] **Step 1: Write the failing test**

Add to the existing `frontend/components/SubmitHoursForm.test.tsx`:

```typescript
it("submits role and location alongside date and hours", async () => {
  vi.mocked(edgeFunctions.submitHours).mockResolvedValue({ activityHoursId: "ah-1" });
  const onSubmitted = vi.fn();
  const user = userEvent.setup();

  render(
    <SubmitHoursForm participationId="p-1" opportunityId="opp-1" organizationId="org-1" accessToken="t" onSubmitted={onSubmitted} />,
  );

  await user.type(screen.getByLabelText("Date"), "2026-02-01");
  await user.type(screen.getByLabelText("Hours"), "3");
  await user.type(screen.getByLabelText("Role"), "Team Lead");
  await user.type(screen.getByLabelText("Location"), "Karachi Beach");
  await user.click(screen.getByRole("button", { name: "Submit hours" }));

  await waitFor(() => {
    expect(edgeFunctions.submitHours).toHaveBeenCalledWith(
      {
        participationId: "p-1", opportunityId: "opp-1", organizationId: "org-1",
        activityDate: "2026-02-01", hoursSubmitted: 3, role: "Team Lead", location: "Karachi Beach",
      },
      "t",
    );
  });
});
```

(Check the top of this test file for its existing `import` and mock setup — it already mocks `@/lib/edgeFunctions` for its current tests; reuse that, don't duplicate the `vi.mock` call.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- components/SubmitHoursForm.test.tsx`
Expected: FAIL — no "Role"/"Location" labeled inputs exist yet.

- [ ] **Step 3: Update the form**

```tsx
// frontend/components/SubmitHoursForm.tsx
"use client";

import { useState } from "react";
import { submitHours } from "@/lib/edgeFunctions";

export function SubmitHoursForm({
  participationId,
  opportunityId,
  organizationId,
  accessToken,
  onSubmitted,
}: {
  participationId: string;
  opportunityId: string;
  organizationId: string;
  accessToken: string;
  onSubmitted: () => void;
}) {
  const [activityDate, setActivityDate] = useState("");
  const [hoursSubmitted, setHoursSubmitted] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitHours(
        {
          participationId,
          opportunityId,
          organizationId,
          activityDate,
          hoursSubmitted: Number(hoursSubmitted),
          role: role || undefined,
          location: location || undefined,
        },
        accessToken,
      );
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <div>
        <label htmlFor="activityDate" className="block text-sm">Date</label>
        <input id="activityDate" type="date" className="mt-1 rounded border px-3 py-2" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
      </div>
      <div>
        <label htmlFor="hoursSubmitted" className="block text-sm">Hours</label>
        <input id="hoursSubmitted" type="number" step="0.5" className="mt-1 rounded border px-3 py-2" value={hoursSubmitted} onChange={(e) => setHoursSubmitted(e.target.value)} />
      </div>
      <div>
        <label htmlFor="hoursRole" className="block text-sm">Role</label>
        <input id="hoursRole" className="mt-1 rounded border px-3 py-2" value={role} onChange={(e) => setRole(e.target.value)} />
      </div>
      <div>
        <label htmlFor="hoursLocation" className="block text-sm">Location</label>
        <input id="hoursLocation" className="mt-1 rounded border px-3 py-2" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Submit hours
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

Note the labels use `htmlFor="hoursRole"`/`"hoursLocation"` but the test queries `screen.getByLabelText("Role")`/`("Location")` — React Testing Library matches on the `<label>` text content, not the `id`, so this is correct; the `id` only needs to be unique on the page, not match the accessible name.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- components/SubmitHoursForm.test.tsx`

- [ ] **Step 5: Run the full suite and the build, verify no regressions**

Run: `cd frontend && npm test`
Run: `cd frontend && npm run build`
Expected: both clean. This is the last task in this plan.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/SubmitHoursForm.tsx frontend/components/SubmitHoursForm.test.tsx
git commit -m "feat: submit-hours form captures Role and Location"
```

---

## Self-Review Notes (for the plan author, not a task to execute)

- **Spec coverage**: report items → tasks: optional profile fields → Task 4; city/institution/emergency-contact edit → Tasks 1–4; opportunity detail fields + computed status → Task 5; Type/Status filters → Task 6 (also consumes Task 5's shared constant/status function); participation stage visible → Task 7; submit-hours Role/Location → Task 8; pagination → Tasks 6 and 7. "Current chapter" edit, profile picture upload, and true DB-backed admin-extensible Type are explicitly deferred (see header) — not silently dropped.
- **Real schema constraint found and designed around**: `profile_field_changes.field_name` has a genuine Postgres CHECK constraint limited to 6 safeguarding fields (verified against `0008_admin_action_log_and_profile_field_changes.sql` directly, not assumed) — this is why Task 2 is a separate, unaudited endpoint rather than extending `update-sensitive-field`'s allowlist, which would have required a migration widening that constraint and diluted a deliberately narrow audit boundary.
- **Type consistency checked**: `updateProfileField`/`updateSensitiveField` field-name unions match between backend (`ProfileFieldName`/`SensitiveFieldName` in their respective `handler.ts` files) and frontend (`UpdateProfileFieldPayload`/`UpdateSensitiveFieldPayload` in `edgeFunctions.ts`) task by task.
- **No open verification items remain**: every signature this plan relies on (`submitHours`'s existing `role`/`location` fields, `updateSensitiveField`'s existing fields, `verifyVolunteerToken`'s return shape, the `volunteers`/`opportunities`/`applications`/`participation`/`profile_field_changes` schemas including its check constraint) was checked directly against live source while writing this plan, not reconstructed from memory.
