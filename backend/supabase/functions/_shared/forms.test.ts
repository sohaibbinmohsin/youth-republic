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
