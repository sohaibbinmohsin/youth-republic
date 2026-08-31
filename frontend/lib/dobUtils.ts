/**
 * Date of birth helpers for masked typing (DD/MM/YYYY or YYYY-MM-DD) and ISO (YYYY-MM-DD) conversion.
 */

export function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > new Date().getFullYear()) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
}

export function parseDateToIso(inputStr: string): string | null {
  if (!inputStr) return null;
  const trimmed = inputStr.trim();

  // Match "YYYY-MM-DD" or "YYYY/MM/DD"
  const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    if (isValidDate(year, month, day)) {
      const padY = String(year).padStart(4, "0");
      const padM = String(month).padStart(2, "0");
      const padD = String(day).padStart(2, "0");
      return `${padY}-${padM}-${padD}`;
    }
  }

  // Match "DD/MM/YYYY" or "DD-MM-YYYY"
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (isValidDate(year, month, day)) {
      const padY = String(year).padStart(4, "0");
      const padM = String(month).padStart(2, "0");
      const padD = String(day).padStart(2, "0");
      return `${padY}-${padM}-${padD}`;
    }
  }

  // Match 8 contiguous digits: either YYYYMMDD or DDMMYYYY
  const rawDigits = trimmed.replace(/\D/g, "");
  if (rawDigits.length === 8) {
    // Try YYYYMMDD
    const y1 = Number(rawDigits.slice(0, 4));
    const m1 = Number(rawDigits.slice(4, 6));
    const d1 = Number(rawDigits.slice(6, 8));
    if (y1 >= 1900 && y1 <= new Date().getFullYear() && isValidDate(y1, m1, d1)) {
      return `${String(y1).padStart(4, "0")}-${String(m1).padStart(2, "0")}-${String(d1).padStart(2, "0")}`;
    }

    // Try DDMMYYYY
    const d2 = Number(rawDigits.slice(0, 2));
    const m2 = Number(rawDigits.slice(2, 4));
    const y2 = Number(rawDigits.slice(4, 8));
    if (isValidDate(y2, m2, d2)) {
      return `${String(y2).padStart(4, "0")}-${String(m2).padStart(2, "0")}-${String(d2).padStart(2, "0")}`;
    }
  }

  return null;
}

export function formatIsoToDisplay(isoStr: string): string {
  if (!isoStr) return "";
  const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return isoStr;
}

export function formatDobTyping(rawInput: string): string {
  if (!rawInput) return "";
  const trimmed = rawInput.trim();

  // If input starts with a year like "19..." or "20..." (ISO style typing)
  if (/^(19|20)\d*/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 4) {
      return digits;
    }
    if (digits.length <= 6) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  }

  // Otherwise standard DD/MM/YYYY formatting
  const digits = trimmed.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
