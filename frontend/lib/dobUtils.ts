/**
 * Date of birth helpers for masked typing (DD/MM/YYYY) and ISO (YYYY-MM-DD) conversion.
 */

export function parseDateToIso(displayStr: string): string | null {
  if (!displayStr) return null;
  const trimmed = displayStr.trim();

  // Handle already ISO "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    if (isValidDate(y, m, d)) {
      return trimmed;
    }
    return null;
  }

  // Handle "DD/MM/YYYY" or "DD-MM-YYYY"
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    if (isValidDate(year, month, day)) {
      const padY = String(year).padStart(4, "0");
      const padM = String(month).padStart(2, "0");
      const padD = String(day).padStart(2, "0");
      return `${padY}-${padM}-${padD}`;
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
  // If user pasted/typed ISO format "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawInput.trim())) {
    return formatIsoToDisplay(rawInput.trim());
  }

  // Strip non-digits
  const digits = rawInput.replace(/\D/g, "").slice(0, 8);
  if (!digits) return "";

  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > new Date().getFullYear()) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
}
