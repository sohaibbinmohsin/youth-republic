export default function ApplyLoading() {
  return (
    <section
      data-route="apply"
      className="pb-12 font-['Jost'] animate-pulse"
      aria-busy="true"
      aria-label="Loading application form"
    >
      <div style={{ width: "140px", height: "18px", borderRadius: "4px", background: "var(--line)", marginBottom: "1.25rem" }}></div>
      <div className="pane pane--summary-first">
        <div>
          <div style={{ width: "160px", height: "36px", borderRadius: "6px", background: "var(--line)", marginBottom: "0.5rem" }}></div>
          <div style={{ width: "280px", height: "18px", borderRadius: "4px", background: "var(--line)", marginBottom: "1.75rem" }}></div>

          <div className="space-y-4">
            <div className="grid-2">
              <div style={{ width: "100%", height: "46px", borderRadius: "var(--radius-btn)", background: "var(--line)" }}></div>
              <div style={{ width: "100%", height: "46px", borderRadius: "var(--radius-btn)", background: "var(--line)" }}></div>
            </div>
            <div className="grid-2">
              <div style={{ width: "100%", height: "46px", borderRadius: "var(--radius-btn)", background: "var(--line)" }}></div>
              <div style={{ width: "100%", height: "46px", borderRadius: "var(--radius-btn)", background: "var(--line)" }}></div>
            </div>
            <div style={{ width: "100%", height: "96px", borderRadius: "var(--radius-btn)", background: "var(--line)" }}></div>
            <div style={{ width: "100%", height: "46px", borderRadius: "var(--radius-btn)", background: "var(--line)" }}></div>
          </div>
        </div>

        <aside className="pane__aside">
          <div style={{ width: "140px", height: "20px", borderRadius: "4px", background: "var(--line)", marginBottom: "1rem" }}></div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--line)" }}></div>
            <div style={{ width: "120px", height: "18px", borderRadius: "4px", background: "var(--line)" }}></div>
          </div>
          <div className="space-y-2">
            <div style={{ width: "100%", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "100%", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "100%", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
          </div>
        </aside>
      </div>
    </section>
  );
}
