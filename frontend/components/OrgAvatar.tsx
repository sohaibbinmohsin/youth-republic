import { isDisplayableLogo, orgInitials } from "@/lib/orgLogo";

/**
 * Organization avatar used across the volunteer surface. Exactly two sizes:
 *  - "sm" (22px): opportunity cards, the org label above the detail-page title
 *  - "md" (28px): the org card on the detail aside, the apply summary, portfolio
 *
 * Renders the uploaded logo when there is one (transparent logos sit on the
 * surrounding surface; a logo with its own background fills the rounded square),
 * otherwise an initials chip tinted with the org's brand colour.
 */
const SIZE_PX = { sm: 22, md: 28 } as const;

export type OrgAvatarSize = keyof typeof SIZE_PX;

export function OrgAvatar({
  name,
  logoUrl,
  color,
  size = "sm",
  className,
}: {
  name?: string | null;
  logoUrl?: string | null;
  color?: string | null;
  size?: OrgAvatarSize;
  className?: string;
}) {
  const px = SIZE_PX[size];

  if (isDisplayableLogo(logoUrl)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name ? `${name} logo` : "Organization logo"}
        className={className}
        style={{
          width: px,
          height: px,
          borderRadius: 6,
          objectFit: "contain",
          overflow: "hidden",
          flexShrink: 0,
          display: "block",
        }}
      />
    );
  }

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        width: px,
        height: px,
        borderRadius: 6,
        flexShrink: 0,
        background: color || "var(--ink-3)",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        font: `700 ${Math.round(px * 0.42)}px/1 "Oswald", sans-serif`,
        letterSpacing: ".02em",
      }}
    >
      {orgInitials(name)}
    </span>
  );
}
