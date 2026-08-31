import { describe, it, expect } from "vitest";
import { formatPhoneNumber } from "./phoneUtils";

describe("phoneUtils - formatPhoneNumber", () => {
  it("formats local Pakistani numbers starting with 0 with a space after 4 digits", () => {
    expect(formatPhoneNumber("0300")).toBe("0300");
    expect(formatPhoneNumber("03001")).toBe("0300 1");
    expect(formatPhoneNumber("03001234567")).toBe("0300 1234567");
    expect(formatPhoneNumber("03217654321")).toBe("0321 7654321");
    expect(formatPhoneNumber("0300-1234567")).toBe("0300 1234567");
  });

  it("formats international numbers starting with + with a space after country code", () => {
    expect(formatPhoneNumber("+")).toBe("+");
    expect(formatPhoneNumber("+92")).toBe("+92");
    expect(formatPhoneNumber("+923")).toBe("+92 3");
    expect(formatPhoneNumber("+923001234567")).toBe("+92 300 1234567");
    expect(formatPhoneNumber("+15551234567")).toBe("+1 555 123 4567");
    expect(formatPhoneNumber("+447911123456")).toBe("+44 7911 123456");
    expect(formatPhoneNumber("+971501234567")).toBe("+971 5012 34567");
  });

  it("handles empty or partial inputs gracefully", () => {
    expect(formatPhoneNumber("")).toBe("");
    expect(formatPhoneNumber("0")).toBe("0");
    expect(formatPhoneNumber("03")).toBe("03");
  });
});
