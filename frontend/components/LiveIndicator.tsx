"use client";

import { useState, useRef, useEffect } from "react";

export function LiveIndicator() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="live-indicator-wrap" ref={containerRef}>
      <button
        type="button"
        className="live-indicator-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        title="Ongoing program — Click for details"
        aria-label="Ongoing program information"
      >
        <span className="live-dot-pulse" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="live-popover-box"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          role="tooltip"
        >
          <span>This volunteer drive is currently active and in progress.</span>
        </div>
      )}
    </div>
  );
}

