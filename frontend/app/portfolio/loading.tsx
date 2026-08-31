export default function PortfolioLoading() {
  return (
    <div className="w-full space-y-6 font-['Jost'] animate-pulse" aria-busy="true" aria-label="Loading volunteer portfolio">
      {/* Header Profile Identity Skeleton */}
      <div className="pf-id">
        <div className="avatar" style={{ background: "var(--line)" }}></div>
        <div className="pf-id__who" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ width: "220px", height: "28px", borderRadius: "6px", background: "var(--line)" }}></div>
          <div style={{ width: "320px", height: "16px", borderRadius: "4px", background: "var(--line)" }}></div>
        </div>
      </div>

      {/* 3 Stat Tiles Skeleton */}
      <div className="tiles">
        <div className="tile" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ width: "50px", height: "36px", borderRadius: "4px", background: "var(--line)" }}></div>
          <div style={{ width: "90px", height: "14px", borderRadius: "4px", background: "var(--line)" }}></div>
        </div>
        <div className="tile" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ width: "50px", height: "36px", borderRadius: "4px", background: "var(--line)" }}></div>
          <div style={{ width: "110px", height: "14px", borderRadius: "4px", background: "var(--line)" }}></div>
        </div>
        <div className="tile" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ width: "50px", height: "36px", borderRadius: "4px", background: "var(--line)" }}></div>
          <div style={{ width: "130px", height: "14px", borderRadius: "4px", background: "var(--line)" }}></div>
        </div>
      </div>

      {/* Tab Bar Skeleton */}
      <div className="pf-tabs" style={{ display: "flex", gap: "1.5rem" }}>
        <div style={{ width: "70px", height: "24px", borderRadius: "4px", background: "var(--line)" }}></div>
        <div style={{ width: "90px", height: "24px", borderRadius: "4px", background: "var(--line)" }}></div>
        <div style={{ width: "110px", height: "24px", borderRadius: "4px", background: "var(--line)" }}></div>
      </div>

      {/* Program Cards Skeleton */}
      <div className="pcards" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[1, 2].map((i) => (
          <div key={i} className="pcard" style={{ background: "var(--bg)", border: "1px solid var(--line)", padding: "1.25rem", borderRadius: "var(--radius-card)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "var(--line)" }}></div>
                <div style={{ width: "160px", height: "18px", borderRadius: "4px", background: "var(--line)" }}></div>
              </div>
              <div style={{ width: "80px", height: "22px", borderRadius: "999px", background: "var(--line)" }}></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "1rem" }}>
              <div style={{ width: "80px", height: "14px", borderRadius: "4px", background: "var(--line)" }}></div>
              <div style={{ width: "80px", height: "14px", borderRadius: "4px", background: "var(--line)" }}></div>
              <div style={{ width: "80px", height: "14px", borderRadius: "4px", background: "var(--line)" }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
