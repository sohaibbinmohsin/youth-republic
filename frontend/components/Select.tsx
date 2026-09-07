"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type SelectOption = { value: string; label: string };

/**
 * Custom dropdown replacing the native <select>: a card-styled popover with
 * styled options. Styling lives in `.yr-select*` in globals.css.
 */
export function Select({
  value,
  onChange,
  options,
  id,
  disabled = false,
  className = "",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selectedIdx = options.findIndex((o) => o.value === value);
  const selected = selectedIdx >= 0 ? options[selectedIdx] : undefined;

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openMenu() {
    if (disabled) return;
    setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0);
    setOpen(true);
  }

  function commit(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIdx(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[activeIdx];
      if (opt) commit(opt.value);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className={`yr-select ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        id={id}
        className="yr-select__trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="yr-select__value">{selected?.label ?? ""}</span>
        <svg className="yr-select__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="yr-select__menu" id={listboxId} role="listbox" aria-label={ariaLabel}>
          {options.map((opt, idx) => (
            <button
              type="button"
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`yr-select__option${idx === activeIdx ? " is-active" : ""}${opt.value === value ? " is-selected" : ""}`}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => commit(opt.value)}
            >
              <span className="yr-select__option-label">{opt.label}</span>
              {opt.value === value && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
