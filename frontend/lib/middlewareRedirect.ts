export interface MiddlewareRedirectInput {
  pathname: string;
  isAuthenticated: boolean;
}

const PROTECTED_PREFIXES = ["/profile", "/applications", "/portfolio", "/apply"];
const AUTH_ROUTES = ["/login", "/register"];

export function computeMiddlewareRedirect(input: MiddlewareRedirectInput): string | null {
  const { pathname, isAuthenticated } = input;

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  // If already authenticated and trying to access login/register, redirect to portfolio
  if (isAuthenticated && isAuthRoute) {
    return "/portfolio";
  }

  // If not authenticated and trying to access protected route, redirect to login
  if (!isAuthenticated && isProtected) {
    return `/login?redirectTo=${encodeURIComponent(pathname)}`;
  }

  return null;
}
