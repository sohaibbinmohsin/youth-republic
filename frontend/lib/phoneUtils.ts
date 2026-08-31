/**
 * Utilities for formatting phone numbers in real-time.
 * Rule:
 * 1. If it starts with '0', insert a space after 4 digits: e.g. "0300 1234567".
 * 2. If it starts with '+', insert a space after the country code: e.g. "+92 300 1234567" or "+1 555 1234567".
 */

// Known 1, 2, and 3 digit country codes
const KNOWN_3_DIGIT_COUNTRY_CODES = new Set([
  "971", "966", "965", "968", "974", "973", "962", "961", "880", "977", "94", "353", "358", "370", "371", "372",
]);

const KNOWN_2_DIGIT_COUNTRY_CODES = new Set([
  "92", "44", "91", "61", "81", "82", "86", "49", "33", "39", "34", "31", "32", "41", "43", "46", "47", "48", "90", "60", "65", "62", "63", "55", "52", "27", "20", "98",
]);

export function detectCountryCodeLength(digitsAfterPlus: string): number {
  if (digitsAfterPlus.length === 0) return 0;
  if (digitsAfterPlus.startsWith("1") || digitsAfterPlus.startsWith("7")) {
    // US/Canada (+1) or Russia/Kazakhstan (+7)
    return 1;
  }
  if (digitsAfterPlus.length >= 3) {
    const code3 = digitsAfterPlus.slice(0, 3);
    if (KNOWN_3_DIGIT_COUNTRY_CODES.has(code3)) {
      return 3;
    }
  }
  if (digitsAfterPlus.length >= 2) {
    const code2 = digitsAfterPlus.slice(0, 2);
    if (KNOWN_2_DIGIT_COUNTRY_CODES.has(code2)) {
      return 2;
    }
  }
  if (digitsAfterPlus.length >= 3) {
    return 2;
  }
  return digitsAfterPlus.length;
}

export function formatPhoneNumber(input: string): string {
  const trimmed = input.trimStart();
  if (!trimmed) return "";

  if (trimmed.startsWith("+")) {
    // Extract only digits after the '+'
    const rawDigits = trimmed.slice(1).replace(/\D/g, "");
    if (rawDigits.length === 0) {
      return "+";
    }

    const ccLen = detectCountryCodeLength(rawDigits);
    const countryCode = rawDigits.slice(0, ccLen);
    const subscriberNumber = rawDigits.slice(ccLen);

    if (!subscriberNumber) {
      return `+${countryCode}`;
    }

    // For Pakistani numbers (+92), format subscriber part as "300 1234567"
    if (countryCode === "92") {
      if (subscriberNumber.length <= 3) {
        return `+${countryCode} ${subscriberNumber}`;
      }
      return `+${countryCode} ${subscriberNumber.slice(0, 3)} ${subscriberNumber.slice(3, 10)}`;
    }

    // For US/Canada (+1), format as "555 123 4567"
    if (countryCode === "1") {
      if (subscriberNumber.length <= 3) {
        return `+${countryCode} ${subscriberNumber}`;
      }
      if (subscriberNumber.length <= 6) {
        return `+${countryCode} ${subscriberNumber.slice(0, 3)} ${subscriberNumber.slice(3)}`;
      }
      return `+${countryCode} ${subscriberNumber.slice(0, 3)} ${subscriberNumber.slice(3, 6)} ${subscriberNumber.slice(6, 10)}`;
    }

    // Generic international format
    if (subscriberNumber.length <= 4) {
      return `+${countryCode} ${subscriberNumber}`;
    }
    return `+${countryCode} ${subscriberNumber.slice(0, 4)} ${subscriberNumber.slice(4)}`;
  }

  if (trimmed.startsWith("0")) {
    const rawDigits = trimmed.replace(/\D/g, "");
    if (rawDigits.length <= 4) {
      return rawDigits;
    }
    // Space after 4 digits: e.g. "0300 1234567"
    return `${rawDigits.slice(0, 4)} ${rawDigits.slice(4, 11)}`;
  }

  // If user entered numbers with dashes like 0300-1234567, or plain digits without leading 0/+
  const rawDigits = trimmed.replace(/[^\d+]/g, "");
  if (rawDigits.startsWith("0")) {
    return formatPhoneNumber(rawDigits);
  }
  if (rawDigits.startsWith("+")) {
    return formatPhoneNumber(rawDigits);
  }

  return trimmed;
}
