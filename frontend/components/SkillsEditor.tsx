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
