import { describe, it, expect } from "vitest";
import { formatDobTyping, parseDateToIso, formatIsoToDisplay, isValidDate } from "./dobUtils";

describe("dobUtils", () => {
  it("formats typed digits as DD/MM/YYYY when starting with day", () => {
    expect(formatDobTyping("1")).toBe("1");
    expect(formatDobTyping("15")).toBe("15");
    expect(formatDobTyping("150")).toBe("15/0");
    expect(formatDobTyping("1508")).toBe("15/08");
    expect(formatDobTyping("15082000")).toBe("15/08/2000");
  });

  it("formats typed digits as YYYY-MM-DD when starting with year", () => {
    expect(formatDobTyping("1999")).toBe("1999");
    expect(formatDobTyping("199901")).toBe("1999-01");
    expect(formatDobTyping("19990101")).toBe("1999-01-01");
    expect(formatDobTyping("1999-01-01")).toBe("1999-01-01");
  });

  it("converts ISO YYYY-MM-DD input to DD/MM/YYYY display format", () => {
    expect(formatIsoToDisplay("1999-01-01")).toBe("01/01/1999");
    expect(formatIsoToDisplay("2005-12-31")).toBe("31/12/2005");
  });

  it("parses valid DD/MM/YYYY into ISO YYYY-MM-DD", () => {
    expect(parseDateToIso("15/08/2000")).toBe("2000-08-15");
    expect(parseDateToIso("01/01/1999")).toBe("1999-01-01");
    expect(parseDateToIso("1999-01-01")).toBe("1999-01-01");
  });

  it("returns null for invalid dates", () => {
    expect(parseDateToIso("35/13/2000")).toBeNull();
    expect(parseDateToIso("31/02/2020")).toBeNull();
    expect(parseDateToIso("")).toBeNull();
  });

  it("checks date validity properly", () => {
    expect(isValidDate(2000, 2, 29)).toBe(true); // Leap year
    expect(isValidDate(2001, 2, 29)).toBe(false); // Not leap year
    expect(isValidDate(2000, 4, 31)).toBe(false); // April has 30 days
  });
});
