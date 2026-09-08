"use client";

/**
 * Save control for an inline profile field.
 *
 * - mobile: a normal text button — "Save" -> "Saving…" -> "Saved"
 * - desktop: a circular brand button — a tick, a spinner while saving, a
 *   green tick for ~1.5s after a successful save (see .field-save* in
 *   globals.css)
 */
export function FieldSaveButton({
  saving,
  saved = false,
  onClick,
  disabled,
}: {
  saving: boolean;
  saved?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const label = saving ? "Saving…" : saved ? "Saved" : "Save";
  return (
    <button
      type="button"
      className={`field-save btn btn--primary btn--sm${saved ? " is-saved" : ""}`}
      onClick={onClick}
      disabled={saving || disabled}
      aria-label="Save changes"
      title="Save changes"
    >
      <span className="field-save__label">{label}</span>
      <span className="field-save__icon" aria-hidden="true">
        {saving ? (
          <span className="field-save__spinner" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
    </button>
  );
}
