"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  /** When this value changes (e.g. the active tab), a caught error is cleared so the
   *  app recovers automatically — switching tabs escapes a broken view. */
  resetKey?: unknown;
};
type State = { error: Error | null };

/**
 * Catches render-time exceptions in its subtree and shows a recoverable fallback instead of
 * white-screening the whole app. The SPA shell (sidebar + header) stays usable because only the
 * tab content is wrapped, so a crash in one view never blanks the entire window.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Diagnostics only — never re-throw.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] render crash:", error, info?.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-6 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                <path d="M12 9v4m0 4h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-[15px] font-semibold text-white">Что-то пошло не так</div>
            <div className="mt-1 text-[12.5px] text-white/50">
              Этот раздел не удалось отобразить. Переключитесь на другую вкладку или перезагрузите страницу.
            </div>
            {this.state.error?.message && (
              <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-2 text-left font-mono text-[11px] text-rose-300/80">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => this.setState({ error: null })}
                className="rounded-lg border border-white/15 px-4 py-2 text-[12.5px] text-white/70 transition hover:bg-white/10"
              >
                Попробовать снова
              </button>
              <button
                onClick={() => { if (typeof window !== "undefined") window.location.reload(); }}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-indigo-400"
              >
                Перезагрузить
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
