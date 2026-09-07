"use client";

import { useState } from "react";
import { updateSensitiveField, type SensitiveFieldName } from "@/lib/edgeFunctions";

function formatErrorMessage(err: string): string {
  if (err === "id_doc_already_registered") {
    return "This identification number is already registered with another account.";
  }
  if (err === "phone_already_registered") {
    return "This phone number is already registered with another account.";
  }
  if (err === "unauthorized") {
    return "Session expired. Please sign in again.";
  }
  return err;
}

export function SensitiveFieldEditor({
  fieldName,
  fieldLabel,
  currentValue,
  accessToken,
  onUpdated,
}: {
  fieldName: SensitiveFieldName;
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
      await updateSensitiveField({ fieldName, newValue: value }, accessToken);
      onUpdated(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor={fieldName}>{fieldLabel}</label>
      <div className="field-row">
        <input id={fieldName} value={value} onChange={(e) => setValue(e.target.value)} />
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="field-error-text">{formatErrorMessage(error)}</p>}
    </div>
  );
}
