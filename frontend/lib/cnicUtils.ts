/**
 * Utilities for formatting CNIC and B-Form numbers.
 * Pakistan CNIC / B-Form is 13 digits, formatted as:
 * XXXXX-XXXXXXX-X (5 digits - 7 digits - 1 digit).
 */

export function formatCnic(input: string): string {
  if (!input) return "";
  const digits = input.replace(/\D/g, "").slice(0, 13);
  if (digits.length === 0) return "";
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
}

export function isValidCnic(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  return digits.length === 13;
}
