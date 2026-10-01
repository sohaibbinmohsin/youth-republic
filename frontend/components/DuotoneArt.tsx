export const ORG_CONFIG: Record<string, { monogram: string; color: string }> = {
  rizq: { monogram: "RZ", color: "#8A7A10" },
  "rizq foundation": { monogram: "RZ", color: "#8A7A10" },
  "rizq trust": { monogram: "RT", color: "#8A7A10" },
  "green crescent": { monogram: "GC", color: "#0B7A3B" },
  "sehat first": { monogram: "SF", color: "#B02A2A" },
  "read foundation": { monogram: "RF", color: "#6E1560" },
};

export function getOrgConfig(orgName?: string | null) {
  const key = (orgName || "").toLowerCase().trim();
  if (ORG_CONFIG[key]) return ORG_CONFIG[key];
  for (const [k, v] of Object.entries(ORG_CONFIG)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  const monogram = (orgName || "YR")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return { monogram, color: "#8A7A10" };
}

export function DuotoneArt({
  type,
  monogram,
  isDetail = false,
}: {
  type?: string | null;
  monogram: string;
  isDetail?: boolean;
}) {
  const t = (type || "").toLowerCase();

  if (isDetail) {
    if (t === "community") {
      return (
        <div className="duotone-poster com">
          {/* Desktop Banner: 1200x250 */}
          <svg className="duotone-deco duotone-deco--desktop" viewBox="0 0 1200 250" fill="none" aria-hidden="true">
            <circle cx="920" cy="80" r="110" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 5" opacity="0.18" />
            <path d="M -20 160 H 510 C 525 160, 535 150, 542 141" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
            <path d="M 658 141 C 665 150, 675 160, 690 160 H 1220" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
            <g transform="translate(530, 60) scale(5.8)" stroke="#FFFFFF" strokeWidth="0.32" strokeLinecap="round" strokeLinejoin="round" opacity="0.88">
              <path d="m11 17 2 2a1 1 0 1 0 3-3" />
              <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
              <path d="m21 3 1 11h-2" />
              <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
              <path d="M3 4h8" />
            </g>
          </svg>
          {/* Mobile Banner: 400x225 (16:9) */}
          <svg className="duotone-deco duotone-deco--mobile" viewBox="0 0 400 225" fill="none" aria-hidden="true">
            <circle cx="310" cy="65" r="75" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 4" opacity="0.18" />
            <path d="M -10 140 H 140 C 150 140, 155 132, 158 123" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <path d="M 241 123 C 244 132, 250 140, 260 140 H 410" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <g transform="translate(149, 64) scale(4.2)" stroke="#FFFFFF" strokeWidth="0.36" strokeLinecap="round" strokeLinejoin="round" opacity="0.88">
              <path d="m11 17 2 2a1 1 0 1 0 3-3" />
              <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
              <path d="m21 3 1 11h-2" />
              <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
              <path d="M3 4h8" />
            </g>
          </svg>
          <div className="duotone-watermark">{monogram}</div>
        </div>
      );
    }
    if (t === "environment") {
      return (
        <div className="duotone-poster env">
          {/* Desktop Banner: 1200x250 */}
          <svg className="duotone-deco duotone-deco--desktop" viewBox="0 0 1200 250" fill="none" aria-hidden="true">
            <circle cx="920" cy="80" r="110" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 5" opacity="0.18" />
            <path d="M -20 160 H 530 C 545 160, 555 155, 570 155 C 585 155, 595 160, 610 160 H 1220" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
            <g transform="translate(535, 45) scale(6)" stroke="#FFFFFF" strokeWidth="0.32" strokeLinecap="round" strokeLinejoin="round" opacity="0.88">
              <path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" />
              <path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" />
            </g>
          </svg>
          {/* Mobile Banner: 400x225 (16:9) */}
          <svg className="duotone-deco duotone-deco--mobile" viewBox="0 0 400 225" fill="none" aria-hidden="true">
            <circle cx="310" cy="65" r="75" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 4" opacity="0.18" />
            <path d="M -10 145 H 145 C 160 145, 172 140, 185 140 C 198 140, 210 145, 225 145 H 410" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <g transform="translate(142, 40) scale(4.8)" stroke="#FFFFFF" strokeWidth="0.32" strokeLinecap="round" strokeLinejoin="round" opacity="0.88">
              <path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" />
              <path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" />
            </g>
          </svg>
          <div className="duotone-watermark">{monogram}</div>
        </div>
      );
    }
    if (t === "health") {
      return (
        <div className="duotone-poster hea">
          {/* Desktop Banner: 1200x250 */}
          <svg className="duotone-deco duotone-deco--desktop" viewBox="0 0 1200 250" fill="none" aria-hidden="true">
            <path d="M -20 160 H 480 L 515 95 L 550 215 L 585 130 L 610 160 H 1220" stroke="#FFFFFF" strokeWidth="2" fill="none" opacity="0.8" />
            <circle cx="960" cy="80" r="110" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 5" opacity="0.2" />
          </svg>
          {/* Mobile Banner: 400x225 (16:9) */}
          <svg className="duotone-deco duotone-deco--mobile" viewBox="0 0 400 225" fill="none" aria-hidden="true">
            <path d="M-10 145 H 120 L 140 95 L 160 185 L 180 125 L 195 145 H 420" stroke="#FFFFFF" strokeWidth="1.6" fill="none" opacity="0.8" />
            <circle cx="340" cy="65" r="80" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 4" opacity="0.2" />
          </svg>
          <div className="duotone-watermark">{monogram}</div>
        </div>
      );
    }
    if (t === "education") {
      return (
        <div className="duotone-poster edu">
          {/* Desktop Banner: 1200x250 */}
          <svg className="duotone-deco duotone-deco--desktop" viewBox="0 0 1200 250" fill="none" aria-hidden="true">
            <circle cx="920" cy="80" r="110" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 5" opacity="0.18" />
            <path d="M -20 160 H 520 C 530 160, 535 155, 538 148" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
            <path d="M 662 148 C 665 155, 670 160, 680 160 H 1220" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
            <g transform="translate(535, 40) scale(5.8)" stroke="#FFFFFF" strokeWidth="0.33" strokeLinecap="round" strokeLinejoin="round" opacity="0.88">
              <path d="M12 5v16" />
              <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
            </g>
          </svg>
          {/* Mobile Banner: 400x225 (16:9) */}
          <svg className="duotone-deco duotone-deco--mobile" viewBox="0 0 400 225" fill="none" aria-hidden="true">
            <circle cx="310" cy="65" r="75" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 4" opacity="0.18" />
            <path d="M -10 145 H 142 C 150 145, 153 141, 155 136" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <path d="M 245 136 C 247 141, 250 145, 258 145 H 410" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <g transform="translate(145, 40) scale(4.6)" stroke="#FFFFFF" strokeWidth="0.33" strokeLinecap="round" strokeLinejoin="round" opacity="0.88">
              <path d="M12 5v16" />
              <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
            </g>
          </svg>
          <div className="duotone-watermark">{monogram}</div>
        </div>
      );
    }
    return (
      <div className="duotone-poster default">
        {/* Desktop Banner: 1200x250 */}
        <svg className="duotone-deco duotone-deco--desktop" viewBox="0 0 1200 250" fill="none" aria-hidden="true">
          <circle cx="920" cy="80" r="110" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 5" opacity="0.18" />
          <line x1="-20" y1="160" x2="1220" y2="160" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
        </svg>
        {/* Mobile Banner: 400x225 (16:9) */}
        <svg className="duotone-deco duotone-deco--mobile" viewBox="0 0 400 225" fill="none" aria-hidden="true">
          <circle cx="310" cy="65" r="75" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 4" opacity="0.18" />
          <line x1="-10" y1="145" x2="410" y2="145" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        </svg>
        <div className="duotone-watermark">{monogram}</div>
      </div>
    );
  }

  // Card view: 400x225 viewBox (16:9)
  if (t === "community") {
    return (
      <div className="duotone-poster com">
        <svg className="duotone-deco" viewBox="0 0 400 225" fill="none" aria-hidden="true">
          <circle cx="310" cy="65" r="75" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 4" opacity="0.18" />
          <path d="M -10 140 H 140 C 150 140, 155 132, 158 123" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <path d="M 241 123 C 244 132, 250 140, 260 140 H 410" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <g transform="translate(149, 64) scale(4.2)" stroke="#FFFFFF" strokeWidth="0.36" strokeLinecap="round" strokeLinejoin="round" opacity="0.88">
            <path d="m11 17 2 2a1 1 0 1 0 3-3" />
            <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
            <path d="m21 3 1 11h-2" />
            <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
            <path d="M3 4h8" />
          </g>
        </svg>
        <div className="duotone-watermark">{monogram}</div>
      </div>
    );
  }
  if (t === "environment") {
    return (
      <div className="duotone-poster env">
        <svg className="duotone-deco" viewBox="0 0 400 225" fill="none" aria-hidden="true">
          <circle cx="310" cy="65" r="75" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 4" opacity="0.18" />
          <path d="M -10 145 H 145 C 160 145, 172 140, 185 140 C 198 140, 210 145, 225 145 H 410" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <g transform="translate(142, 40) scale(4.8)" stroke="#FFFFFF" strokeWidth="0.32" strokeLinecap="round" strokeLinejoin="round" opacity="0.88">
            <path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" />
            <path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" />
          </g>
        </svg>
        <div className="duotone-watermark">{monogram}</div>
      </div>
    );
  }
  if (t === "health") {
    return (
      <div className="duotone-poster hea">
        <svg className="duotone-deco" viewBox="0 0 400 225" fill="none" aria-hidden="true">
          <path d="M-10 145 H 120 L 140 95 L 160 185 L 180 125 L 195 145 H 420" stroke="#FFFFFF" strokeWidth="1.6" fill="none" opacity="0.8" />
          <circle cx="340" cy="65" r="80" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 4" opacity="0.2" />
        </svg>
        <div className="duotone-watermark">{monogram}</div>
      </div>
    );
  }
  if (t === "education") {
    return (
      <div className="duotone-poster edu">
        <svg className="duotone-deco" viewBox="0 0 400 225" fill="none" aria-hidden="true">
          <circle cx="310" cy="65" r="75" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 4" opacity="0.18" />
          <path d="M -10 145 H 142 C 150 145, 153 141, 155 136" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <path d="M 245 136 C 247 141, 250 145, 258 145 H 410" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <g transform="translate(145, 40) scale(4.6)" stroke="#FFFFFF" strokeWidth="0.33" strokeLinecap="round" strokeLinejoin="round" opacity="0.88">
            <path d="M12 5v16" />
            <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
          </g>
        </svg>
        <div className="duotone-watermark">{monogram}</div>
      </div>
    );
  }
  return (
    <div className="duotone-poster default">
      <svg className="duotone-deco" viewBox="0 0 400 225" fill="none" aria-hidden="true">
        <circle cx="310" cy="65" r="75" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 4" opacity="0.18" />
        <line x1="-10" y1="145" x2="410" y2="145" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      </svg>
      <div className="duotone-watermark">{monogram}</div>
    </div>
  );
}
