const SESSION_RETURN_KEY = "yr_return_to";

const DISALLOWED_PREFIXES = ["/login", "/register", "/logout"];

export function isValidReturnUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;

  const trimmed = url.trim();

  // Must be a relative path starting with a single '/'
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return false;
  }

  // Disallow auth/session lifecycle routes
  const normalized = trimmed.toLowerCase();
  for (const prefix of DISALLOWED_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`) || normalized.startsWith(`${prefix}?`)) {
      return false;
    }
  }

  return true;
}

export function recordReturnUrl(url: string | null | undefined): void {
  if (typeof window === "undefined") return;
  if (!isValidReturnUrl(url)) return;

  try {
    window.sessionStorage.setItem(SESSION_RETURN_KEY, url!.trim());
  } catch {
    // Ignore sessionStorage errors (e.g. private mode restrictions)
  }
}

export function getRecordedReturnUrl(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.sessionStorage.getItem(SESSION_RETURN_KEY);
    if (isValidReturnUrl(stored)) {
      return stored;
    }
  } catch {
    // Ignore sessionStorage errors
  }

  return null;
}

export function clearReturnUrl(): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(SESSION_RETURN_KEY);
  } catch {
    // Ignore sessionStorage errors
  }
}

export function getEffectiveReturnUrl(
  searchParamRedirect?: string | null,
  fallbackUrl: string = "/portfolio",
): string {
  // 1. Explicit query parameter redirect
  if (isValidReturnUrl(searchParamRedirect)) {
    return searchParamRedirect!.trim();
  }

  // 2. Browser-stored active journey in sessionStorage
  const recorded = getRecordedReturnUrl();
  if (recorded) {
    return recorded;
  }

  // 3. Document referrer (if same-origin and safe)
  if (typeof window !== "undefined" && document.referrer) {
    try {
      const refUrl = new URL(document.referrer);
      if (refUrl.origin === window.location.origin) {
        const path = refUrl.pathname + refUrl.search;
        if (isValidReturnUrl(path)) {
          return path;
        }
      }
    } catch {
      // Ignore URL parse errors
    }
  }

  return fallbackUrl;
}
