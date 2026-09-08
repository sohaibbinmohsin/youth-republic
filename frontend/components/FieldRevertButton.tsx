"use client";

/**
 * Sits next to FieldSaveButton and discards the pending edit, putting the
 * field back to its saved value. Same responsive shape as FieldSaveButton:
 * a text button ("Revert") on mobile, a circular ✕ on desktop.
 */
export function FieldRevertButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="field-revert btn btn--ghost btn--sm"
      onClick={onClick}
      disabled={disabled}
      aria-label="Discard changes"
      title="Discard changes"
    >
      <span className="field-save__label">Revert</span>
      <span className="field-save__icon" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    </button>
  );
}
