import { describe, it, expect } from "vitest";
import { validatePassword } from "./passwordUtils";

describe("validatePassword", () => {
  it("rejects empty passwords", () => {
    const result = validatePassword("");
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBe("Password is required.");
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = validatePassword("Ab1!");
    expect(result.isValid).toBe(false);
    expect(result.hasMinLength).toBe(false);
    expect(result.errorMessage).toBe("Password must be at least 8 characters long.");
  });

  it("rejects passwords missing lowercase letters", () => {
    const result = validatePassword("ALLCAPS123!");
    expect(result.isValid).toBe(false);
    expect(result.hasLowercase).toBe(false);
    expect(result.errorMessage).toBe("Password must contain at least one lowercase letter.");
  });

  it("rejects passwords missing uppercase letters", () => {
    const result = validatePassword("alllower123!");
    expect(result.isValid).toBe(false);
    expect(result.hasUppercase).toBe(false);
    expect(result.errorMessage).toBe("Password must contain at least one uppercase letter.");
  });

  it("rejects passwords missing numbers", () => {
    const result = validatePassword("NoNumbersHere!");
    expect(result.isValid).toBe(false);
    expect(result.hasDigit).toBe(false);
    expect(result.errorMessage).toBe("Password must contain at least one number.");
  });

  it("rejects passwords missing symbols", () => {
    const result = validatePassword("NoSymbols123");
    expect(result.isValid).toBe(false);
    expect(result.hasSymbol).toBe(false);
    expect(result.errorMessage).toBe("Password must contain at least one symbol (e.g. !@#$%^&*).");
  });

  it("accepts passwords fulfilling all 5 criteria", () => {
    const result = validatePassword("StrongPass123!");
    expect(result.isValid).toBe(true);
    expect(result.hasMinLength).toBe(true);
    expect(result.hasLowercase).toBe(true);
    expect(result.hasUppercase).toBe(true);
    expect(result.hasDigit).toBe(true);
    expect(result.hasSymbol).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });
});
