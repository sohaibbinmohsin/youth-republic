"use client";

import { useState } from "react";
import { updateProfileField, type UpdateProfileFieldPayload } from "@/lib/edgeFunctions";
import { FieldSaveButton } from "@/components/FieldSaveButton";
import { FieldRevertButton } from "@/components/FieldRevertButton";
import { AutocompleteInput } from "@/components/AutocompleteInput";
import type { AutocompleteItem } from "@/lib/formDatasets";

export function ProfileFieldEditor({
  fieldName,
  fieldLabel,
  currentValue,
  accessToken,
  onUpdated,
  dataset,
  required = false,
  placeholder,
}: {
  fieldName: UpdateProfileFieldPayload["fieldName"];
  fieldLabel: string;
  currentValue: string;
  accessToken: string;
  onUpdated: (newValue: string) => void;
  /** When given, the field is a typeahead over this list (same as registration). */
  dataset?: AutocompleteItem[];
  /** Block an empty save, matching the registration form's checks. */
  required?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (required && !value.trim()) {
      setError(`${fieldLabel} is required.`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const newValue = fieldName === "graduation_year" ? Number(value) : value;
      await updateProfileField({ fieldName, newValue }, accessToken);
      onUpdated(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSaving(false);
    }
  }

  const dirty = value !== currentValue;

  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={fieldName}>{fieldLabel}</label>
      <div className="field-row">
        {dataset ? (
          <AutocompleteInput
            id={fieldName}
            value={value}
            onChange={setValue}
            dataset={dataset}
            placeholder={placeholder}
            required={required}
          />
        ) : (
          <input id={fieldName} value={value} onChange={(e) => setValue(e.target.value)} />
        )}
        {(dirty || saving || saved) && (
          <div className="field-actions">
            <FieldRevertButton onClick={() => { setValue(currentValue); setError(null); }} disabled={saving} />
            <FieldSaveButton saving={saving} saved={saved} onClick={handleSave} />
          </div>
        )}
      </div>
      {error && <p className="field-error-text">{error}</p>}
    </div>
  );
}
