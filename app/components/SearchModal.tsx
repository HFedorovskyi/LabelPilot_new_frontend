"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n";

function cx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

const TYPE_STYLE: Record<string, { dot: string; badge: string }> = {
  product: { dot: "bg-indigo-400", badge: "bg-indigo-400/10 text-indigo-300" },
  station: { dot: "bg-emerald-400", badge: "bg-emerald-400/10 text-emerald-300" },
  label: { dot: "bg-violet-400", badge: "bg-violet-400/10 text-violet-300" },
  barcode: { dot: "bg-amber-400", badge: "bg-amber-400/10 text-amber-300" },
  job: { dot: "bg-sky-400", badge: "bg-sky-400/10 text-sky-300" },
};

export default function SearchModal({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Portal target only exists on the client (static export prerenders on the server).
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setResults([]);
    setSel(0);
    const id = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const id = setTimeout(() => {
      api
        .search(query)
        .then((d: any) => {
          if (alive) {
            setResults(d.results ?? []);
            setSel(0);
          }
        })
        .catch(() => {
          if (alive) setResults([]);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 200);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q, open]);

  const choose = (r: any) => {
    if (r) {
      onNavigate(r.tab);
      onClose();
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[sel]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open || !mounted) return null;
  const query = q.trim();
  // Portal to <body> so the overlay escapes the main column's stacking context
  // (z-10, below the sidebar's z-20) and reliably covers the whole viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0c0c0e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" className="shrink-0 text-white/35" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
            <path d="m20 20-3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={t("search.placeholder")}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
          {loading && (
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          )}
          <kbd className="shrink-0 rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-white/40">ESC</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {query.length < 2 ? (
            <div className="px-3 py-8 text-center text-[13px] text-white/35">{t("search.hint")}</div>
          ) : results.length === 0 && !loading ? (
            <div className="px-3 py-8 text-center text-[13px] text-white/35">{t("search.noResults")}</div>
          ) : (
            results.map((r, i) => {
              const st = TYPE_STYLE[r.type] ?? TYPE_STYLE.product;
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => choose(r)}
                  onMouseEnter={() => setSel(i)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                    i === sel ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                  )}
                >
                  <span className={cx("h-2 w-2 shrink-0 rounded-full", st.dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] text-white">{r.title}</div>
                    {r.subtitle ? <div className="truncate text-[11.5px] text-white/40">{r.subtitle}</div> : null}
                  </div>
                  <span className={cx("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium", st.badge)}>
                    {t(`search.type.${r.type}`)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
