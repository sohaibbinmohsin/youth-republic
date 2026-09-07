/**
 * True when `url` is worth rendering as an <img> org logo.
 *
 * The platform seed writes a ~118-char 1x1 placeholder pixel into
 * `organizations.logo_url`; that scales up to a solid colour square, so treat
 * any tiny data URI as "no logo" and fall back to an initials chip.
 */
export function isDisplayableLogo(url: string | null | undefined): url is string {
  if (!url) return false;
  if (/^https?:\/\//i.test(url)) return true;
  return url.startsWith("data:image/") && url.length > 512;
}

/** Two-letter monogram from an org name. */
export function orgInitials(name?: string | null): string {
  if (!name) return "YR";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "YR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
