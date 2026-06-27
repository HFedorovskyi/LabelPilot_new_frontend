"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n";

function cx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

function relTime(iso: string | null, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t("dashboard.relJustNow");
  if (mins < 60) return t("dashboard.relMinsAgo", { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("dashboard.relHrsAgo", { hrs });
  return t("dashboard.relDaysAgo", { days: Math.floor(hrs / 24) });
}

const LEVEL_DOT: Record<string, string> = {
  ERROR: "bg-rose-400",
  WARNING: "bg-amber-400",
  INFO: "bg-white/30",
};

export default function NotificationsPanel({
  open,
  onClose,
  items,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  items: any[];
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  // Render into <body> via a portal so the dropdown escapes the header's
  // backdrop-blur stacking context (which otherwise traps it BELOW <main>,
  // hiding it behind the dashboard cards regardless of its z-index).
  const [mounted, setMounted] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; right: number } | null>(null);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Anchor the panel's top below the bell and align its right edge to the
      // bell's right edge (clamped so it never spills off-screen on the left).
      const right = Math.min(Math.max(8, window.innerWidth - r.right), window.innerWidth - 348);
      setPos({ top: Math.round(r.bottom + 8), right: Math.round(Math.max(8, right)) });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, anchorRef]);

  if (!open || !mounted || !pos) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[199]" onClick={onClose} />
      <div
        className="fixed z-[200] w-[340px] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0c0c0e] shadow-2xl"
        style={{ top: pos.top, right: pos.right }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-[13px] font-semibold text-white">{t("notif.title")}</span>
          <span className="text-[11px] text-white/35">{items.length}</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-white/35">{t("notif.empty")}</div>
          ) : (
            items.map((n) => (
              <div key={n.id} className="flex gap-2.5 border-b border-white/[0.05] px-4 py-2.5 last:border-0">
                <span className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", LEVEL_DOT[n.level] ?? LEVEL_DOT.INFO)} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] leading-snug text-white/90">{n.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-white/35">
                    {n.subtitle ? <span className="truncate">{n.subtitle}</span> : null}
                    {n.subtitle ? <span className="shrink-0">·</span> : null}
                    <span className="shrink-0">{relTime(n.created_at, t)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
