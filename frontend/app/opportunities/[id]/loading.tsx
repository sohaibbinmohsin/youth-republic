export default function OpportunityDetailLoading() {
  return (
    <section data-route="opportunity" className="pb-12 animate-pulse" aria-busy="true" aria-label="Loading opportunity details">
      {/* Breadcrumb Skeleton */}
      <div className="crumb" style={{ width: "130px", height: "18px", borderRadius: "4px", background: "var(--line)", marginBottom: "1.25rem" }}></div>

      <div className="pane">
        {/* Left Column: Detail Skeleton */}
        <div className="detail" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "var(--line)" }}></div>
            <div style={{ width: "120px", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
          </div>

          <div style={{ width: "80%", height: "42px", borderRadius: "6px", background: "var(--line)" }}></div>

          <div style={{ width: "40%", height: "18px", borderRadius: "4px", background: "var(--line)" }}></div>

          <div style={{ width: "75px", height: "24px", borderRadius: "999px", background: "var(--line)" }}></div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.5rem" }}>
            <div style={{ width: "100%", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "95%", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "70%", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
          </div>

          <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ width: "160px", height: "24px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "100%", height: "14px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "90%", height: "14px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "85%", height: "14px", borderRadius: "4px", background: "var(--line)" }}></div>
          </div>
        </div>

        {/* Right Aside: Key Details Card Skeleton */}
        <aside className="pane__aside aside-cta">
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem", paddingBottom: ".75rem", marginBottom: ".75rem", borderBottom: "1px solid var(--line)" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "var(--line)" }}></div>
            <div style={{ width: "100px", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
          </div>

          <div style={{ width: "100%", height: "42px", borderRadius: "var(--radius-btn)", background: "var(--line)", marginBottom: "1.25rem" }}></div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ width: "100%", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "100%", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "100%", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "100%", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
          </div>
        </aside>
      </div>
    </section>
  );
}
