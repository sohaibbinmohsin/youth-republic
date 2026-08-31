"use client";

interface GenderOption {
  value: string;
  label: string;
}

const GENDER_OPTIONS: GenderOption[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

interface GenderCardsProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function GenderCards({
  id = "gender",
  value,
  onChange,
  required = false,
}: GenderCardsProps) {
  return (
    <div className="gender-container">
      {/* Visually hidden select to guarantee backward compatibility with automated tests & standard forms */}
      <select
        id={id}
        name="gender"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="gender-select-hidden"
        aria-label="Gender"
      >
        <option value="">Select gender</option>
        {GENDER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Custom interactive cards */}
      <div className="gender-cards-grid" role="radiogroup" aria-label="Gender options">
        {GENDER_OPTIONS.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`gender-card ${isSelected ? "selected" : ""}`}
              onClick={() => onChange(opt.value)}
            >
              <span className="gender-card__dot" aria-hidden="true" />
              <span className="gender-card__label">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
