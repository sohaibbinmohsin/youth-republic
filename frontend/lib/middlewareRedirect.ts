export interface MiddlewareRedirectInput {
  pathname: string;
  search?: string;
  redirectToParam?: string | null;
  isAuthenticated: boolean;
}

const PROTECTED_PREFIXES = ["/profile", "/applications", "/portfolio", "/apply"];
const AUTH_ROUTES = ["/login", "/register"];

export function computeMiddlewareRedirect(input: MiddlewareRedirectInput): string | null {
  const { pathname, search = "", redirectToParam, isAuthenticated } = input;

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  // If already authenticated and trying to access login/register, redirect to destination or portfolio
  if (isAuthenticated && isAuthRoute) {
    if (
      redirectToParam &&
      redirectToParam.startsWith("/") &&
      !redirectToParam.startsWith("//") &&
      !AUTH_ROUTES.some((route) => redirectToParam === route || redirectToParam.startsWith(`${route}/`)) &&
      !redirectToParam.startsWith("/logout")
    ) {
      return redirectToParam;
    }
    return "/portfolio";
  }

  // If not authenticated and trying to access protected route, redirect to login
  if (!isAuthenticated && isProtected) {
    const fullTarget = pathname + (search && search.startsWith("?") ? search : search ? `?${search}` : "");
    return `/login?redirectTo=${encodeURIComponent(fullTarget)}`;
  }

  return null;
}
