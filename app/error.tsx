"use client";

// Next.js route-level error boundary — the last-resort backstop so an uncaught render error
// (e.g. in the shell outside the per-tab ErrorBoundary) shows a recoverable screen, never a blank one.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06070b] p-6 text-white font-[family-name:var(--font-geist-sans)]">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-6 text-center">
        <div className="text-[15px] font-semibold">Что-то пошло не так</div>
        <div className="mt-1 text-[12.5px] text-white/50">Произошла ошибка в приложении. Перезагрузите страницу.</div>
        {error?.message && (
          <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-2 text-left font-mono text-[11px] text-rose-300/80">
            {error.message}
          </pre>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => reset()} className="rounded-lg border border-white/15 px-4 py-2 text-[12.5px] text-white/70 transition hover:bg-white/10">
            Попробовать снова
          </button>
          <button onClick={() => { if (typeof window !== "undefined") window.location.reload(); }} className="rounded-lg bg-indigo-500 px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-indigo-400">
            Перезагрузить
          </button>
        </div>
      </div>
    </div>
  );
}
