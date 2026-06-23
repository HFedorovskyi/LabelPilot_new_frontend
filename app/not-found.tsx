"use client";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#06070b",
        color: "#ecedf2",
        fontFamily: "var(--font-geist-sans), sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.02em" }}>404</div>
        <div style={{ color: "rgba(255,255,255,0.5)", marginTop: 6 }}>Страница не найдена</div>
      </div>
    </div>
  );
}
