"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  id: string;
  name?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function CustomSelect({
  id,
  name,
  value,
  options,
  onChange,
  placeholder = "Choose one…",
  required = false,
  error = false,
  disabled = false,
  className = "",
  ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Determine vertical placement relative to viewport
  const updatePlacement = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // If less than 240px below and more room above, flip to open upwards
    if (spaceBelow < 240 && spaceAbove > spaceBelow) {
      setPlacement("top");
    } else {
      setPlacement("bottom");
    }
  }, []);

  // Handle outside click & touch to close
  useEffect(() => {
    function handleOutsideInteraction(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideInteraction);
      document.addEventListener("touchstart", handleOutsideInteraction);
      window.addEventListener("resize", updatePlacement);
      window.addEventListener("scroll", updatePlacement, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideInteraction);
      document.removeEventListener("touchstart", handleOutsideInteraction);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [isOpen, updatePlacement]);

  // When opening, calculate placement and set initial highlighted index
  function handleToggleOpen() {
    if (disabled) return;
    if (!isOpen) {
      updatePlacement();
      const currentIdx = options.findIndex((opt) => opt.value === value);
      setHighlightedIndex(currentIdx >= 0 ? currentIdx : -1);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }

  function handleSelect(val: string) {
    onChange(val);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        updatePlacement();
        const currentIdx = options.findIndex((opt) => opt.value === value);
        setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > -1 ? prev - 1 : options.length - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (highlightedIndex === -1) {
        handleSelect("");
      } else if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        handleSelect(options[highlightedIndex].value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  }

  return (
    <div className={`custom-select-wrap ${className}`} ref={containerRef}>
      {/* Hidden native select for standard form integration & accessibility */}
      <select
        id={id}
        name={name || id}
        value={value}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="custom-select-native-hidden"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Custom styled trigger button */}
      <button
        ref={triggerRef}
        type="button"
        id={`${id}-trigger`}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-popup`}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={handleToggleOpen}
        onKeyDown={handleKeyDown}
        className={`custom-select-trigger ${error ? "input-error" : ""} ${isOpen ? "is-open" : ""}`}
      >
        <span className={`custom-select-value ${!selectedOption ? "custom-select-placeholder" : ""}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="custom-select-icon" aria-hidden="true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`custom-select-chevron ${isOpen ? "custom-select-chevron--open" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {/* Options displayed in our custom designed card */}
      {isOpen && (
        <div
          id={`${id}-popup`}
          ref={menuRef}
          role="listbox"
          aria-label={ariaLabel || placeholder}
          className={`custom-select-card custom-select-card--${placement}`}
        >
          {/* Default / Clear option */}
          <div
            role="option"
            aria-selected={!value}
            className={`custom-select-option custom-select-option--placeholder ${!value ? "is-selected" : ""} ${highlightedIndex === -1 ? "is-highlighted" : ""}`}
            onClick={() => handleSelect("")}
            onMouseEnter={() => setHighlightedIndex(-1)}
          >
            <span>{placeholder}</span>
            {!value && (
              <span className="custom-select-check" aria-hidden="true">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            )}
          </div>

          {/* Form options */}
          {options.map((opt, idx) => {
            const isSelected = value === opt.value;
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className={`custom-select-option ${isSelected ? "is-selected" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setHighlightedIndex(idx)}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <span className="custom-select-check" aria-hidden="true">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
