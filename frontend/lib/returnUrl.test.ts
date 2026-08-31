import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  isValidReturnUrl,
  recordReturnUrl,
  getRecordedReturnUrl,
  clearReturnUrl,
  getEffectiveReturnUrl,
} from "./returnUrl";

describe("returnUrl utility", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  describe("isValidReturnUrl", () => {
    it("accepts valid relative paths", () => {
      expect(isValidReturnUrl("/")).toBe(true);
      expect(isValidReturnUrl("/opportunities")).toBe(true);
      expect(isValidReturnUrl("/opportunities/ffd9cb51-8b8d-4914-9906-4a9dc124c59e")).toBe(true);
      expect(isValidReturnUrl("/apply/ffd9cb51-8b8d-4914-9906-4a9dc124c59e")).toBe(true);
      expect(isValidReturnUrl("/opportunities?type=community")).toBe(true);
      expect(isValidReturnUrl("/applications")).toBe(true);
      expect(isValidReturnUrl("/portfolio")).toBe(true);
    });

    it("rejects auth and logout routes", () => {
      expect(isValidReturnUrl("/login")).toBe(false);
      expect(isValidReturnUrl("/login?redirectTo=/apply/1")).toBe(false);
      expect(isValidReturnUrl("/register")).toBe(false);
      expect(isValidReturnUrl("/register?redirectTo=/apply/1")).toBe(false);
      expect(isValidReturnUrl("/logout")).toBe(false);
      expect(isValidReturnUrl("/logout/")).toBe(false);
    });

    it("rejects open redirects and invalid protocols", () => {
      expect(isValidReturnUrl(null)).toBe(false);
      expect(isValidReturnUrl(undefined)).toBe(false);
      expect(isValidReturnUrl("")).toBe(false);
      expect(isValidReturnUrl("   ")).toBe(false);
      expect(isValidReturnUrl("//evil.com")).toBe(false);
      expect(isValidReturnUrl("/\\evil.com")).toBe(false);
      expect(isValidReturnUrl("https://evil.com")).toBe(false);
      expect(isValidReturnUrl("javascript:alert(1)")).toBe(false);
    });
  });

  describe("sessionStorage recording", () => {
    it("records, retrieves, and clears valid return URLs", () => {
      expect(getRecordedReturnUrl()).toBeNull();

      recordReturnUrl("/opportunities/123");
      expect(getRecordedReturnUrl()).toBe("/opportunities/123");

      clearReturnUrl();
      expect(getRecordedReturnUrl()).toBeNull();
    });

    it("ignores recording invalid or auth URLs", () => {
      recordReturnUrl("/login");
      expect(getRecordedReturnUrl()).toBeNull();

      recordReturnUrl("//evil.com");
      expect(getRecordedReturnUrl()).toBeNull();
    });
  });

  describe("getEffectiveReturnUrl", () => {
    it("prioritizes explicit searchParamRedirect when valid", () => {
      recordReturnUrl("/opportunities/recorded");
      const result = getEffectiveReturnUrl("/apply/specific-opp");
      expect(result).toBe("/apply/specific-opp");
    });

    it("falls back to sessionStorage when searchParamRedirect is absent or invalid", () => {
      recordReturnUrl("/apply/from-session");
      expect(getEffectiveReturnUrl(null)).toBe("/apply/from-session");
      expect(getEffectiveReturnUrl("")).toBe("/apply/from-session");
      expect(getEffectiveReturnUrl("/login")).toBe("/apply/from-session");
    });

    it("falls back to default /portfolio when no searchParam, session, or referrer exists", () => {
      expect(getEffectiveReturnUrl(null)).toBe("/portfolio");
      expect(getEffectiveReturnUrl(undefined, "/custom-fallback")).toBe("/custom-fallback");
    });
  });
});
