export default function ApplyLoading() {
  return (
    <div className="mx-auto max-w-lg w-full font-['Jost'] animate-pulse" aria-busy="true" aria-label="Loading application form">
      <div style={{ width: "120px", height: "28px", borderRadius: "6px", background: "var(--line)", marginBottom: "1.5rem" }}></div>
      <div className="space-y-4">
        <div style={{ width: "100%", height: "120px", borderRadius: "var(--radius-btn)", background: "var(--line)" }}></div>
        <div style={{ width: "100%", height: "44px", borderRadius: "var(--radius-btn)", background: "var(--line)" }}></div>
      </div>
    </div>
  );
}
