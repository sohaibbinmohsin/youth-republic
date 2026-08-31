import { describe, it, expect } from "vitest";
import { computeMiddlewareRedirect } from "./middlewareRedirect";

describe("computeMiddlewareRedirect", () => {
  it("redirects authenticated users from /login to /portfolio", () => {
    const result = computeMiddlewareRedirect({
      pathname: "/login",
      isAuthenticated: true,
    });
    expect(result).toBe("/portfolio");
  });

  it("redirects authenticated users from /register to /portfolio", () => {
    const result = computeMiddlewareRedirect({
      pathname: "/register",
      isAuthenticated: true,
    });
    expect(result).toBe("/portfolio");
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
