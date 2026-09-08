"use client";

import { useState } from "react";
import { updateSensitiveField } from "@/lib/edgeFunctions";
import { FieldSaveButton } from "@/components/FieldSaveButton";
import { FieldRevertButton } from "@/components/FieldRevertButton";

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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const newValue = { name, phone };
      await updateSensitiveField({ fieldName: "emergency_contact", newValue }, accessToken);
      onUpdated(newValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSaving(false);
    }
  }

  const origName = currentValue?.name ?? "";
  const origPhone = currentValue?.phone ?? "";
  const dirty = name !== origName || phone !== origPhone;
  function handleRevert() {
    setName(origName);
    setPhone(origPhone);
    setError(null);
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
        {(dirty || saving || saved) && (
          <div className="field-actions">
            <FieldRevertButton onClick={handleRevert} disabled={saving} />
            <FieldSaveButton saving={saving} saved={saved} onClick={handleSave} />
          </div>
        )}
      </div>
      {error && <p className="field-error-text">{error}</p>}
    </div>
  );
}
