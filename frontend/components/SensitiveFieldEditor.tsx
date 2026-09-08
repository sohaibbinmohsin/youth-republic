"use client";

import { useState } from "react";
import { updateSensitiveField, type SensitiveFieldName } from "@/lib/edgeFunctions";
import { FieldSaveButton } from "@/components/FieldSaveButton";
import { FieldRevertButton } from "@/components/FieldRevertButton";

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
  required = false,
  validate,
}: {
  fieldName: SensitiveFieldName;
  fieldLabel: string;
  currentValue: string;
  accessToken: string;
  onUpdated: (newValue: string) => void;
  /** Block an empty save. */
  required?: boolean;
  /** Return an error string to block the save, or null to allow it. */
  validate?: (value: string) => string | null;
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
    const validationError = validate?.(value) ?? null;
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateSensitiveField({ fieldName, newValue: value }, accessToken);
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
        <input id={fieldName} value={value} onChange={(e) => setValue(e.target.value)} />
        {(dirty || saving || saved) && (
          <div className="field-actions">
            <FieldRevertButton onClick={() => { setValue(currentValue); setError(null); }} disabled={saving} />
            <FieldSaveButton saving={saving} saved={saved} onClick={handleSave} />
          </div>
        )}
      </div>
      {error && <p className="field-error-text">{formatErrorMessage(error)}</p>}
    </div>
  );
}
