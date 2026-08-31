import { describe, it, expect } from "vitest";
import { computeMiddlewareRedirect } from "./middlewareRedirect";

describe("computeMiddlewareRedirect", () => {
  it("redirects authenticated users from /login to /portfolio when no redirectToParam is given", () => {
    const result = computeMiddlewareRedirect({
      pathname: "/login",
      isAuthenticated: true,
    });
    expect(result).toBe("/portfolio");
  });

  it("redirects authenticated users from /login to redirectToParam when a valid one is present", () => {
    const result = computeMiddlewareRedirect({
      pathname: "/login",
      redirectToParam: "/apply/ffd9cb51-8b8d-4914-9906-4a9dc124c59e",
      isAuthenticated: true,
    });
    expect(result).toBe("/apply/ffd9cb51-8b8d-4914-9906-4a9dc124c59e");
  });

  it("redirects authenticated users from /register to /portfolio", () => {
    const result = computeMiddlewareRedirect({
      pathname: "/register",
      isAuthenticated: true,
    });
    expect(result).toBe("/portfolio");
  });

  it("redirects authenticated users from /register to valid redirectToParam", () => {
    const result = computeMiddlewareRedirect({
      pathname: "/register",
      redirectToParam: "/opportunities/123",
      isAuthenticated: true,
    });
    expect(result).toBe("/opportunities/123");
  });

  it("allows unauthenticated users on /login", () => {
    const result = computeMiddlewareRedirect({
      pathname: "/login",
      isAuthenticated: false,
    });
    expect(result).toBeNull();
  });

  it("allows unauthenticated users on /register", () => {
    const result = computeMiddlewareRedirect({
      pathname: "/register",
      isAuthenticated: false,
    });
    expect(result).toBeNull();
  });

  it("redirects unauthenticated users from /portfolio to /login", () => {
    const result = computeMiddlewareRedirect({
      pathname: "/portfolio",
      isAuthenticated: false,
    });
    expect(result).toBe("/login?redirectTo=%2Fportfolio");
  });

  it("redirects unauthenticated users from /profile to /login", () => {
    const result = computeMiddlewareRedirect({
      pathname: "/profile",
      isAuthenticated: false,
    });
    expect(result).toBe("/login?redirectTo=%2Fprofile");
  });

  it("redirects unauthenticated users from /apply with query preserved", () => {
    const result = computeMiddlewareRedirect({
      pathname: "/apply/123",
      search: "?shift=morning",
      isAuthenticated: false,
    });
    expect(result).toBe("/login?redirectTo=%2Fapply%2F123%3Fshift%3Dmorning");
  });

  it("allows unauthenticated users on public browsing pages like / and /opportunities", () => {
    expect(computeMiddlewareRedirect({ pathname: "/", isAuthenticated: false })).toBeNull();
    expect(computeMiddlewareRedirect({ pathname: "/opportunities", isAuthenticated: false })).toBeNull();
    expect(computeMiddlewareRedirect({ pathname: "/opportunities/123", isAuthenticated: false })).toBeNull();
  });

  it("allows authenticated users on public browsing pages", () => {
    expect(computeMiddlewareRedirect({ pathname: "/", isAuthenticated: true })).toBeNull();
    expect(computeMiddlewareRedirect({ pathname: "/opportunities", isAuthenticated: true })).toBeNull();
  });
});
