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
    <div className="field">
      <label>Emergency contact</label>
      <div className="field-row">
        <div className="field-inputs">
          <input
            id="emergencyContactName"
            aria-label="Emergency contact name"
            placeholder="Contact name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            id="emergencyContactPhone"
            aria-label="Emergency contact phone"
            placeholder="Contact phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
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
