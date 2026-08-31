export default function ApplicationsLoading() {
  return (
    <div className="w-full font-['Jost'] animate-pulse" aria-busy="true" aria-label="Loading applications">
      <div style={{ width: "180px", height: "28px", borderRadius: "6px", background: "var(--line)", marginBottom: "1.5rem" }}></div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-xl border border-[var(--line)] bg-white"
          >
            <div style={{ width: "220px", height: "18px", borderRadius: "4px", background: "var(--line)" }}></div>
            <div style={{ width: "90px", height: "22px", borderRadius: "999px", background: "var(--line)" }}></div>
          </div>
        ))}
      </div>
    </div>
  );
}
