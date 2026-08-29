export interface GuardianConsentValue {
  guardianName: string;
  guardianContact: string;
  guardianConsent: boolean;
}

export function GuardianConsentFields({
  guardianName,
  guardianContact,
  guardianConsent,
  onChange,
}: GuardianConsentValue & { onChange: (value: GuardianConsentValue) => void }) {
  return (
    <fieldset className="mt-4 space-y-3 rounded border border-amber-300 bg-amber-50 p-4">
      <legend className="text-sm font-medium">Guardian information (required for volunteers under 18)</legend>
      <div>
        <label htmlFor="guardianName" className="block text-sm">Guardian name</label>
        <input
          id="guardianName"
          className="mt-1 w-full rounded border px-3 py-2"
          value={guardianName}
          onChange={(e) => onChange({ guardianName: e.target.value, guardianContact, guardianConsent })}
        />
      </div>
      <div>
        <label htmlFor="guardianContact" className="block text-sm">Guardian contact</label>
        <input
          id="guardianContact"
          className="mt-1 w-full rounded border px-3 py-2"
          value={guardianContact}
          onChange={(e) => onChange({ guardianName, guardianContact: e.target.value, guardianConsent })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          aria-label="Guardian consent"
          checked={guardianConsent}
          onChange={(e) => onChange({ guardianName, guardianContact, guardianConsent: e.target.checked })}
        />
        My guardian consents to my volunteering through this platform.
      </label>
    </fieldset>
  );
}
