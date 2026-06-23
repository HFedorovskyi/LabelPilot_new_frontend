"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, background: "#06070b", color: "#ecedf2", fontFamily: "sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 600 }}>Что-то пошло не так</div>
            <button
              onClick={() => reset()}
              style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#ecedf2", cursor: "pointer" }}
            >
              Перезагрузить
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
