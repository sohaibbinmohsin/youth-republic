"use client";

import { useState } from "react";
import { updateSensitiveField } from "@/lib/edgeFunctions";

export function EmergencyContactEditor({
  currentValue,
  accessToken,
  onUpdated,
}: {
  currentValue: { name: string; phone: string } | null;
  accessToken: string;
  onUpdated: (newValue: { name: string; phone: string }) => void;
}) {
  const [name, setName] = useState(currentValue?.name ?? "");
  const [phone, setPhone] = useState(currentValue?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const newValue = { name, phone };
      await updateSensitiveField({ fieldName: "emergency_contact", newValue }, accessToken);
      onUpdated(newValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Emergency contact</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div>
          <label htmlFor="emergencyContactName" className="block text-sm">Emergency contact name</label>
          <input id="emergencyContactName" className="mt-1 rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="emergencyContactPhone" className="block text-sm">Emergency contact phone</label>
          <input id="emergencyContactPhone" className="mt-1 rounded border px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
          Save
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
