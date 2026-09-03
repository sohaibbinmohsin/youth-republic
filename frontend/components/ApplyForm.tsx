"use client";

import { useMemo, useState } from "react";
import {
  applyToOpportunity,
  finalizeAttachment,
  requestAttachmentUpload,
  ValidationError,
} from "@/lib/edgeFunctions";
import { type FieldDef, type FormDefinition, validateAnswers } from "@/lib/forms";
import type { OpportunityDetailRow } from "@/lib/opportunityData";

export interface VolunteerInitialProfile {
  fullName?: string;
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

type AnswerValue = string | number | boolean | string[];

const EMPTY_FORM: FormDefinition = { version: 1, fields: [] };

function initialAnswer(field: FieldDef): AnswerValue {
  if (field.type === "checkbox") return false;
  if (field.type === "multiselect" || field.type === "file") return [];
  if (field.type === "number") return "";
  return "";
}

export function ApplyForm({
  opportunityId,
  accessToken,
  onSuccess,
  initialVolunteerProfile,
  opportunity,
}: {
  opportunityId: string;
  // kept for call-site compatibility; the backend derives the org from the opportunity
  organizationId?: string;
  accessToken: string;
  onSuccess: () => void;
  initialVolunteerProfile?: VolunteerInitialProfile | null;
  opportunity?: OpportunityDetailRow | null;
}) {
  const form: FormDefinition = useMemo(() => {
    const f = opportunity?.application_form;
    return f && Array.isArray(f.fields) ? f : EMPTY_FORM;
  }, [opportunity]);

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
    const seed: Record<string, AnswerValue> = {};
    for (const field of form.fields) seed[field.id] = initialAnswer(field);
    return seed;
  });
  const [filesByField, setFilesByField] = useState<Record<string, File[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function setAnswer(id: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setFieldErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function toggleInArray(id: string, value: string) {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      return { ...prev, [id]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  }

  async function uploadFilesForField(field: FieldDef): Promise<string[]> {
    const files = filesByField[field.id] ?? [];
    const ids: string[] = [];
    for (const file of files) {
      const meta = await requestAttachmentUpload(
        {
          domain: "application_file",
          ownerType: "application",
          // draft owner id — apply-to-opportunity re-points it to the new application row
          ownerId: crypto.randomUUID(),
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          originalFilename: file.name,
        },
        accessToken,
      );
      await fetch(meta.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      await finalizeAttachment({ attachmentId: meta.attachmentId }, accessToken);
      ids.push(meta.attachmentId);
    }
    return ids;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      // 1. Upload any files, folding their attachment ids into the answers.
      const finalAnswers: Record<string, unknown> = { ...answers };
      const allAttachmentIds: string[] = [];
      for (const field of form.fields) {
        if (field.type !== "file") continue;
        const ids = await uploadFilesForField(field);
        finalAnswers[field.id] = ids;
        allAttachmentIds.push(...ids);
      }
      // number answers -> number for validation
      for (const field of form.fields) {
        if (field.type === "number" && finalAnswers[field.id] !== "" && finalAnswers[field.id] != null) {
          finalAnswers[field.id] = Number(finalAnswers[field.id]);
        }
      }

      // 2. Client-side validate against the form the admin published.
      const result = validateAnswers(form, finalAnswers);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setError("Please fix the highlighted fields.");
        setSubmitting(false);
        return;
      }

      // 3. Submit.
      await applyToOpportunity(
        {
          opportunityId,
          answers: finalAnswers,
          attachmentIds: allAttachmentIds.length > 0 ? allAttachmentIds : undefined,
        },
        accessToken,
      );
      onSuccess();
    } catch (err) {
      if (err instanceof ValidationError) {
        setFieldErrors(err.fieldErrors);
        setError("Please fix the highlighted fields.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const profile = initialVolunteerProfile ?? {};

  return (
    <form onSubmit={handleSubmit} className="apply-form" id="applyForm" noValidate>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-[#FCEBEB] bg-[#FFF8F8] p-3.5 text-sm text-[#A32D2D]"
        >
          {error}
        </div>
      )}

      {/* Identity — sourced from the volunteer's profile, not editable here. */}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="a-name">Full name</label>
          <input id="a-name" value={profile.fullName ?? ""} readOnly />
        </div>
        <div className="field">
          <label htmlFor="a-phone">Phone</label>
          <input id="a-phone" value={profile.phone ?? ""} readOnly />
        </div>
      </div>
      <div className="field">
        <label htmlFor="a-email">Email</label>
        <input id="a-email" type="email" value={profile.email ?? ""} readOnly />
        <p className="hint">These come from your profile. Update them in Profile if they&rsquo;ve changed.</p>
      </div>

      {form.fields.length === 0 && (
        <p className="hint">This opportunity has no extra questions — just confirm below and submit.</p>
      )}

      {form.fields.map((field) => (
        <ApplyField
          key={field.id}
          field={field}
          value={answers[field.id]}
          error={fieldErrors[field.id]}
          onChange={(v) => setAnswer(field.id, v)}
          onToggle={(v) => toggleInArray(field.id, v)}
          onFiles={(files) => setFilesByField((p) => ({ ...p, [field.id]: files }))}
          fileNames={(filesByField[field.id] ?? []).map((f) => f.name)}
        />
      ))}

      <button
        type="submit"
        disabled={submitting}
        className="btn btn--primary btn--block"
        id="applySubmit"
      >
        {submitting ? "Submitting application…" : "Submit application"}
      </button>
    </form>
  );
}

function ApplyField({
  field,
  value,
  error,
  onChange,
  onToggle,
  onFiles,
  fileNames,
}: {
  field: FieldDef;
  value: AnswerValue;
  error?: string;
  onChange: (v: AnswerValue) => void;
  onToggle: (v: string) => void;
  onFiles: (files: File[]) => void;
  fileNames: string[];
}) {
  const labelNode = (
    <>
      {field.label}
      {field.required ? " *" : ""}
    </>
  );
  const help = field.help ? <p className="hint">{field.help}</p> : null;
  const err = error ? <p className="field__error">{error}</p> : null;
  const cls = `field${error ? " has-error" : ""}`;

  switch (field.type) {
    case "long_text":
      return (
        <div className={cls}>
          <label htmlFor={`f-${field.id}`}>{labelNode}</label>
          <textarea
            id={`f-${field.id}`}
            rows={3}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
          {err}
        </div>
      );
    case "select":
      return (
        <div className={cls}>
          <label htmlFor={`f-${field.id}`}>{labelNode}</label>
          <select id={`f-${field.id}`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">Choose one…</option>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {help}
          {err}
        </div>
      );
    case "radio":
      return (
        <fieldset className={error ? "has-error" : undefined}>
          <legend>{labelNode}</legend>
          <div className="checks">
            {(field.options ?? []).map((o) => (
              <label key={o.value}>
                <input
                  type="radio"
                  name={`f-${field.id}`}
                  value={o.value}
                  checked={value === o.value}
                  onChange={() => onChange(o.value)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {help}
          {err}
        </fieldset>
      );
    case "multiselect": {
      const arr = Array.isArray(value) ? value : [];
      return (
        <fieldset className={error ? "has-error" : undefined}>
          <legend>{labelNode}</legend>
          <div className="checks checks--inline">
            {(field.options ?? []).map((o) => (
              <label key={o.value}>
                <input type="checkbox" checked={arr.includes(o.value)} onChange={() => onToggle(o.value)} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {help}
          {err}
        </fieldset>
      );
    }
    case "checkbox":
      return (
        <div>
          <label className="checkline" style={{ margin: ".25rem 0 1rem" }}>
            <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
            <span>{labelNode}</span>
          </label>
          {help}
          {err}
        </div>
      );
    case "file":
      return (
        <div className={cls}>
          <label htmlFor={`f-${field.id}`}>{labelNode}</label>
          <label className="upload">
            <input
              id={`f-${field.id}`}
              type="file"
              multiple={(field.maxFiles ?? 1) > 1}
              accept={(field.accept ?? []).join(",") || undefined}
              onChange={(e) => onFiles(e.target.files ? Array.from(e.target.files) : [])}
            />
            <span className="upload__btn">Choose file{(field.maxFiles ?? 1) > 1 ? "s" : ""}</span>
            <span className="upload__name" data-empty="No file selected">
              {fileNames.length > 0 ? fileNames.join(", ") : "No file selected"}
            </span>
          </label>
          {help ?? (
            <p className="hint">
              {(field.accept ?? ["PDF or image"]).join(", ")}
              {field.maxSizeMB ? ` · up to ${field.maxSizeMB} MB` : ""}
              {(field.maxFiles ?? 1) > 1 ? ` · up to ${field.maxFiles} files` : ""}
            </p>
          )}
          {err}
        </div>
      );
    default: {
      const inputType =
        field.type === "email" ? "email" :
        field.type === "phone" ? "tel" :
        field.type === "url" ? "url" :
        field.type === "number" ? "number" :
        field.type === "date" ? "date" : "text";
      return (
        <div className={cls}>
          <label htmlFor={`f-${field.id}`}>{labelNode}</label>
          <input
            id={`f-${field.id}`}
            type={inputType}
            inputMode={field.type === "phone" ? "tel" : undefined}
            value={String(value ?? "")}
            placeholder={field.type === "url" ? "https://" : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
          {err}
        </div>
      );
    }
  }
}
