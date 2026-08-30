// vendored from backend/supabase/functions/_shared/forms.ts — keep in sync
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
