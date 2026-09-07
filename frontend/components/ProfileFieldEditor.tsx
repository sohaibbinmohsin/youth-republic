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
      {error && <p className="field-error-text">{error}</p>}
    </div>
  );
}
