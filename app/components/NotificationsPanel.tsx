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
  ERROR: "bg-lp-bad",
  WARNING: "bg-lp-warn",
  INFO: "bg-lp-off",
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
  // Render into <body> via a portal so the dropdown escapes the side menu's stacking
  // context (which otherwise traps it below <main>, whatever its z-index).
  const [mounted, setMounted] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // The bell sits in the side menu: open the panel to its right, top-aligned,
      // clamped so it never spills off-screen.
      const left = Math.max(8, Math.min(r.right + 8, window.innerWidth - 348));
      const top = Math.max(8, Math.min(r.top, window.innerHeight - 120));
      setPos({ top: Math.round(top), left: Math.round(left) });
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
        className="fixed z-[200] w-[340px] overflow-hidden rounded-2xl border border-lp-line bg-lp-surface shadow-2xl"
        style={{ top: pos.top, left: pos.left }}
      >
        <div className="flex items-center justify-between border-b border-lp-line px-4 py-3">
          <span className="text-[14px] font-bold text-lp-ink">{t("notif.title")}</span>
          <span className="text-[12px] text-lp-ink-3">{items.length}</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-lp-ink-3">{t("notif.empty")}</div>
          ) : (
            items.map((n) => (
              <div key={n.id} className="flex gap-2.5 border-b border-lp-line px-4 py-2.5 last:border-0">
                <span className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", LEVEL_DOT[n.level] ?? LEVEL_DOT.INFO)} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-snug text-lp-ink">{n.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-lp-ink-3">
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
