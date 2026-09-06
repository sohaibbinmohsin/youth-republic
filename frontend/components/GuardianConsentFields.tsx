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
  errors,
}: GuardianConsentValue & {
  onChange: (value: GuardianConsentValue) => void;
  errors?: {
    guardianName?: string;
    guardianContact?: string;
    guardianConsent?: string;
  };
}) {
  return (
    <div
      className="guardian-card"
      style={{
        marginTop: "1.25rem",
        marginBottom: "1rem",
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-card)",
        padding: "1.25rem",
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div>
          <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)" }}>
            Guardian Information &amp; Consent
          </h4>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--ink-2)" }}>
            Required for volunteers 18 years or younger.
          </p>
        </div>
        <span className="pill pill--pend text-[0.7rem] py-0.5 px-2">Minor Requirement</span>
      </div>

      <div className="grid-2" style={{ marginBottom: "0.75rem" }}>
        <div className={`field ${errors?.guardianName ? "has-error" : ""}`} style={{ marginBottom: 0 }}>
          <label htmlFor="guardianName">Guardian name</label>
          <input
            id="guardianName"
            type="text"
            placeholder="Parent or legal guardian name"
            value={guardianName}
            onChange={(e) =>
              onChange({ guardianName: e.target.value, guardianContact, guardianConsent })
            }
          />
          {errors?.guardianName && (
            <p className="field__error" role="alert">
              {errors.guardianName}
            </p>
          )}
        </div>

        <div className={`field ${errors?.guardianContact ? "has-error" : ""}`} style={{ marginBottom: 0 }}>
          <label htmlFor="guardianContact">Guardian contact</label>
          <input
            id="guardianContact"
            type="text"
            placeholder="Phone number or email"
            value={guardianContact}
            onChange={(e) =>
              onChange({ guardianName, guardianContact: e.target.value, guardianConsent })
            }
          />
          {errors?.guardianContact && (
            <p className="field__error" role="alert">
              {errors.guardianContact}
            </p>
          )}
        </div>
      </div>

      <label
        className="checkline"
        style={{
          marginTop: "0.75rem",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.6rem",
          fontSize: "0.85rem",
          color: "var(--ink)",
          cursor: "pointer",
        }}
      >
        <input
          id="guardianConsent"
          type="checkbox"
          aria-label="Guardian consent"
          checked={guardianConsent}
          onChange={(e) =>
            onChange({ guardianName, guardianContact, guardianConsent: e.target.checked })
          }
          style={{ marginTop: "0.15rem" }}
        />
        <span>My parent or legal guardian consents to my volunteering activities through Youth Republic.</span>
      </label>
      {errors?.guardianConsent && (
        <p className="field__error" role="alert" style={{ marginTop: "0.4rem" }}>
          {errors.guardianConsent}
        </p>
      )}
    </div>
  );
}
