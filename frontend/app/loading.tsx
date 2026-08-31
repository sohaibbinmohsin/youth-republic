export default function RootLoading() {
  return (
    <section data-route="hub" className="animate-pulse w-full" aria-busy="true" aria-label="Loading content">
      {/* Notice Board Hero Skeleton */}
      <div className="hero" style={{ padding: "1rem 0 2.5rem", borderBottom: "1px solid var(--line)", marginBottom: "2rem" }}>
        <div style={{ width: "260px", height: "42px", borderRadius: "6px", background: "var(--line)", marginBottom: "0.5rem" }}></div>
        <div style={{ width: "320px", height: "42px", borderRadius: "6px", background: "var(--line)", marginBottom: "1rem" }}></div>
        <div style={{ width: "480px", maxWidth: "90%", height: "16px", borderRadius: "4px", background: "var(--line)", marginBottom: "1.5rem" }}></div>
        <div style={{ width: "100%", maxWidth: "620px", height: "46px", borderRadius: "var(--radius-btn)", background: "var(--line)" }}></div>
      </div>

      {/* Hub layout: Rail + 6 card skeletons */}
      <div className="hub-layout">
        <aside className="rail" style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "var(--radius-card)", padding: "1.15rem 1.2rem", height: "300px" }}>
          <div style={{ width: "60px", height: "14px", borderRadius: "4px", background: "var(--line)", marginBottom: "1rem" }}></div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ width: "100%", height: "18px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "85%", height: "18px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "90%", height: "18px", borderRadius: "4px", background: "var(--line)" }}></div>
          </div>
        </aside>

        <div>
          <div className="cards">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="oc" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
                <div className="oc__org" style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "6px", background: "var(--line)" }}></div>
                  <div style={{ width: "80px", height: "12px", borderRadius: "4px", background: "var(--line)" }}></div>
                </div>
                <div style={{ width: "85%", height: "20px", borderRadius: "4px", background: "var(--line)", margin: ".3rem 0" }}></div>
                <div style={{ width: "50%", height: "14px", borderRadius: "4px", background: "var(--line)" }}></div>
                <div style={{ width: "100%", height: "12px", borderRadius: "4px", background: "var(--line)", marginTop: ".4rem" }}></div>
                <div style={{ width: "70%", height: "12px", borderRadius: "4px", background: "var(--line)" }}></div>
                <div className="foot" style={{ marginTop: "1rem", paddingTop: ".5rem", display: "flex", justifyContent: "space-between" }}>
                  <div style={{ width: "65px", height: "16px", borderRadius: "999px", background: "var(--line)" }}></div>
                  <div style={{ width: "45px", height: "16px", borderRadius: "999px", background: "var(--line)" }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
