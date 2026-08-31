"use client";

import { useState, useEffect, useRef } from "react";
import { formatDobTyping, parseDateToIso, formatIsoToDisplay } from "@/lib/dobUtils";

interface DateOfBirthInputProps {
  id?: string;
  name?: string;
  required?: boolean;
  value: string; // ISO date string (YYYY-MM-DD) or partial string
  onChange: (isoValue: string) => void;
  placeholder?: string;
}

export function DateOfBirthInput({
  id = "dob",
  name = "dob",
  required = false,
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
}: DateOfBirthInputProps) {
  // Local display text
  const [displayValue, setDisplayValue] = useState(() => (value ? formatIsoToDisplay(value) : ""));
  const hiddenDateRef = useRef<HTMLInputElement>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    // Only synchronize from external value if user is not actively typing
    if (!isTypingRef.current) {
      if (!value) {
        setDisplayValue("");
      } else {
        const isoFromDisplay = parseDateToIso(displayValue);
        if (isoFromDisplay !== value) {
          setDisplayValue(formatIsoToDisplay(value));
        }
      }
    }
  }, [value, displayValue]);

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    isTypingRef.current = true;
    const raw = e.target.value;
    const formatted = formatDobTyping(raw);
    setDisplayValue(formatted);

    const iso = parseDateToIso(formatted);
    if (iso) {
      onChange(iso);
    } else {
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
        onChange(raw.trim());
      } else {
        onChange("");
      }
    }
  }

  function handleBlur() {
    isTypingRef.current = false;
    const iso = parseDateToIso(displayValue);
    if (iso) {
      setDisplayValue(formatIsoToDisplay(iso));
      onChange(iso);
    }
  }

  function handleCalendarPickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    isTypingRef.current = false;
    const pickerIso = e.target.value;
    if (pickerIso) {
      setDisplayValue(formatIsoToDisplay(pickerIso));
      onChange(pickerIso);
    }
  }

  function openCalendar() {
    if (hiddenDateRef.current) {
      if (typeof hiddenDateRef.current.showPicker === "function") {
        try {
          hiddenDateRef.current.showPicker();
        } catch {
          hiddenDateRef.current.focus();
        }
      } else {
        hiddenDateRef.current.focus();
      }
    }
  }

  return (
    <div className="dob-input-wrap">
      <input
        id={id}
        name={name}
        type="text"
        required={required}
        inputMode="numeric"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        className="dob-text-input"
        autoComplete="bday"
      />

      <button
        type="button"
        className="dob-cal-btn"
        onClick={openCalendar}
        aria-label="Choose date from calendar"
        tabIndex={0}
      >
        <svg
          className="dob-cal-icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Hidden native date input to trigger browser date picker popover */}
      <input
        ref={hiddenDateRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="dob-native-hidden"
        value={parseDateToIso(displayValue) || ""}
        onChange={handleCalendarPickerChange}
        max={new Date().toISOString().split("T")[0]}
      />
    </div>
  );
}
