export function LiveIndicator() {
  return (
    <span
      className="live-pill"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        marginLeft: "0.45rem",
        padding: "0.1rem 0.5rem",
        borderRadius: "9999px",
        backgroundColor: "var(--blue-strong, #941A80)",
        color: "#ffffff",
        fontFamily: "var(--font-body, 'Jost', system-ui, -apple-system, sans-serif)",
        fontSize: "0.6875rem",
        fontWeight: 700,
        letterSpacing: "0.02em",
        textTransform: "none",
        lineHeight: "1.25",
        whiteSpace: "nowrap",
      }}
      title="Drive in progress"
    >
      Live
    </span>
  );
}
