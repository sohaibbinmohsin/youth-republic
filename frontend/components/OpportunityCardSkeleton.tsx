export function OpportunityCardSkeleton() {
  return (
    <div
      className="oc-card oc animate-pulse"
      style={{
        background: "var(--bg, #fff)",
        border: "1px solid var(--line, #e2dfd7)",
        borderRadius: "var(--radius-card, 12px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      {/* 16:9 Media Frame */}
      <div
        className="oc-card__media"
        style={{
          aspectRatio: "16 / 9",
          position: "relative",
          background: "var(--line, #e2dfd7)",
          borderTopLeftRadius: "calc(var(--radius-card, 12px) - 1px)",
          borderTopRightRadius: "calc(var(--radius-card, 12px) - 1px)",
          overflow: "visible",
        }}
      >
        {/* Category Tag skeleton */}
        <div className="oc-card__overlay-top" style={{ position: "absolute", top: "10px", left: "10px", zIndex: 5 }}>
          <div
            style={{
              width: "68px",
              height: "18px",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.55)",
            }}
          />
        </div>

        {/* Squircle Avatar + Org Name Badge skeleton */}
        <div className="media-org-overlap">
          <div
            className="org-avatar-overlap"
            style={{
              background: "rgba(255, 255, 255, 0.65)",
              border: "2px solid #FFFFFF",
            }}
          />
          <div
            className="org-name-overlap-badge"
            style={{
              width: "90px",
              height: "22px",
              background: "#FFFFFF",
              border: "1px solid var(--line, #e2dfd7)",
            }}
          />
        </div>
      </div>

      {/* Card Body */}
      <div className="oc-card__body" style={{ padding: "16px 14px 12px", display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Title */}
        <div
          style={{
            width: "75%",
            height: "18px",
            borderRadius: "4px",
            background: "var(--line, #e2dfd7)",
            marginBottom: "8px",
          }}
        />

        {/* Location line */}
        <div
          style={{
            width: "40%",
            height: "13px",
            borderRadius: "4px",
            background: "var(--line, #e2dfd7)",
            marginBottom: "12px",
          }}
        />

        {/* Description line 1 & 2 */}
        <div
          style={{
            width: "92%",
            height: "11px",
            borderRadius: "4px",
            background: "var(--line, #e2dfd7)",
            marginBottom: "6px",
          }}
        />
        <div
          style={{
            width: "65%",
            height: "11px",
            borderRadius: "4px",
            background: "var(--line, #e2dfd7)",
            marginBottom: "16px",
          }}
        />

        {/* Footer Row */}
        <div
          className="oc-card__footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: "8px",
          }}
        >
          <div
            style={{
              width: "85px",
              height: "18px",
              borderRadius: "999px",
              background: "var(--line, #e2dfd7)",
            }}
          />
          <div
            style={{
              width: "65px",
              height: "13px",
              borderRadius: "4px",
              background: "var(--line, #e2dfd7)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
