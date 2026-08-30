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
