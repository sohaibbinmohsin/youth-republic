import { describe, it, expect } from "vitest";
import { formatCnic, isValidCnic } from "./cnicUtils";

describe("cnicUtils", () => {
  it("formats 13 digits into XXXXX-XXXXXXX-X", () => {
    expect(formatCnic("3520212345671")).toBe("35202-1234567-1");
  });

  it("handles progressive typing", () => {
    expect(formatCnic("35202")).toBe("35202");
    expect(formatCnic("352021")).toBe("35202-1");
    expect(formatCnic("352021234567")).toBe("35202-1234567");
    expect(formatCnic("3520212345671")).toBe("35202-1234567-1");
  });

  it("ignores non-digit characters and caps at 13 digits", () => {
    expect(formatCnic("35202-1234567-1999")).toBe("35202-1234567-1");
    expect(formatCnic("abc35202def1234567-1")).toBe("35202-1234567-1");
  });

  it("validates 13-digit CNIC format", () => {
    expect(isValidCnic("35202-1234567-1")).toBe(true);
    expect(isValidCnic("3520212345671")).toBe(true);
    expect(isValidCnic("35202-1234567")).toBe(false);
  });
});
