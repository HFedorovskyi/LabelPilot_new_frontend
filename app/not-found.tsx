"use client";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgb(var(--lp-bg))",
        color: "rgb(var(--lp-ink))",
        fontFamily: "\"Manrope Variable\", Manrope, system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.02em" }}>404</div>
        <div style={{ color: "rgb(var(--lp-ink-3))", marginTop: 6 }}>Страница не найдена</div>
      </div>
    </div>
  );
}
