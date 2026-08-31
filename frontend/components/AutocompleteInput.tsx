"use client";

import { useState, useRef, useEffect } from "react";
import { type AutocompleteItem, searchSimilarItems } from "@/lib/formDatasets";

interface AutocompleteInputProps {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  dataset: AutocompleteItem[];
  required?: boolean;
  maxResults?: number;
}

export function AutocompleteInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  dataset,
  required = false,
  maxResults = 5,
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update suggestions when value changes
  useEffect(() => {
    if (value && value.trim().length > 0) {
      const matches = searchSimilarItems(value, dataset, maxResults);
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  }, [value, dataset, maxResults]);

  // Handle outside click to dismiss dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    onChange(val);
    setIsOpen(true);
    setActiveIndex(-1);
  }

  function handleSelect(item: AutocompleteItem) {
    onChange(item.label);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        setIsOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="autocomplete-wrap" ref={containerRef}>
      <input
        ref={inputRef}
        id={id}
        name={name || id}
        type="text"
        required={required}
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="autocomplete-input"
        aria-autocomplete="list"
        aria-expanded={isOpen && suggestions.length > 0}
      />

      {isOpen && suggestions.length > 0 && (
        <ul className="autocomplete-menu" role="listbox" id={`${id}-suggestions`}>
          {suggestions.map((item, idx) => {
            const isHighlighted = idx === activeIndex;
            return (
              <li
                key={item.id + idx}
                role="option"
                aria-selected={isHighlighted}
                className={`autocomplete-item ${isHighlighted ? "highlighted" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before click fires
                  handleSelect(item);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <div className="autocomplete-item__main">{item.label}</div>
                {item.secondary && (
                  <div className="autocomplete-item__sub">{item.secondary}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
