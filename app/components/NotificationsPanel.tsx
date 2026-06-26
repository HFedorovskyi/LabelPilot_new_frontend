"use client";

import React from "react";
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
}: {
  open: boolean;
  onClose: () => void;
  items: any[];
}) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[114]" onClick={onClose} />
      <div className="absolute right-0 top-[calc(100%+8px)] z-[115] w-[340px] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0c0c0e] shadow-2xl">
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
    </>
  );
}
