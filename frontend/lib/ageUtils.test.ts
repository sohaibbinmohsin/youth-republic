import { describe, it, expect } from "vitest";
import { isMinor } from "./ageUtils";

describe("isMinor", () => {
  it("returns true for someone under 18", () => {
    expect(isMinor("2015-01-01", new Date("2026-08-26"))).toBe(true);
  });

  it("returns false for someone 18 or older", () => {
    expect(isMinor("1999-01-01", new Date("2026-08-26"))).toBe(false);
  });

  it("returns false on the exact 18th birthday", () => {
    expect(isMinor("2008-08-26", new Date("2026-08-26"))).toBe(false);
  });
});
