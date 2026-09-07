"use client";

/**
 * Save control for an inline profile field. On mobile it's a normal
 * text button ("Save"); on desktop it collapses to a circular brand-colour
 * button with a white checkmark (see .field-save rules in globals.css).
 */
export function FieldSaveButton({
  saving,
  onClick,
  disabled,
}: {
  saving: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="field-save btn btn--primary btn--sm"
      onClick={onClick}
      disabled={saving || disabled}
      aria-label="Save changes"
      title="Save changes"
    >
      <span className="field-save__label">{saving ? "Saving…" : "Save"}</span>
      <span className="field-save__check" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    </button>
  );
}
