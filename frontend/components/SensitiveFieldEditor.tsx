"use client";

import { useState } from "react";
import { updateSensitiveField, type SensitiveFieldName } from "@/lib/edgeFunctions";

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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
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
