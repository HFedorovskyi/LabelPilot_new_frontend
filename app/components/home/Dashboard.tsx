"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n";
import Portal from "../Portal";

type TFunc = (key: string, params?: Record<string, string | number>) => string;

// ── helpers ──────────────────────────────────────────────────────────────────

function cx(...c: (string | boolean | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

function fmt(n: number) {
  return (n ?? 0).toLocaleString("ru-RU");
}

function relTime(iso: string | null, t: TFunc): string {
  if (!iso) return t("dashboard.relNever");
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("dashboard.relJustNow");
  if (mins < 60) return t("dashboard.relMinsAgo", { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("dashboard.relHrsAgo", { hrs });
  const days = Math.floor(hrs / 24);
  return t("dashboard.relDaysAgo", { days });
}

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Active-time span between the first and last marking of a station. */
function fmtDuration(firstIso: string | null, lastIso: string | null, t: TFunc): string {
  if (!firstIso || !lastIso) return "—";
  const ms = new Date(lastIso).getTime() - new Date(firstIso).getTime();
  if (!(ms > 0)) return "—";
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? t("dashboard.durHM", { h, m }) : t("dashboard.durM", { m });
}

/** A sync is "stale" if older than 7 days or never. */
function isStaleSync(iso: string | null): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > 7 * 24 * 60 * 60 * 1000;
}

function padNum(n: number | null | undefined): string {
  if (n == null) return "";
  return String(n).padStart(2, "0");
}

// ── stroke-icon set (viewBox 0 0 24 24, fill none, stroke currentColor 1.6) ──

type IconName =
  | "printer"
  | "tag"
  | "box"
  | "server"
  | "barcode"
  | "alert-triangle"
  | "circle-check"
  | "refresh"
  | "arrow-up-right"
  | "arrow-down-right"
  | "activity"
  | "layers"
  | "weight"
  | "trash"
  | "clock"
  | "x"
  | "chevron-right"
  | "download";

function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = "h-4 w-4";
  const cl = cx(common, className);
  const sw = "1.6";
  switch (name) {
    case "printer":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M6 9V4h12v5M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
          <path d="M6 14h12v8H6v-8z" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "tag":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M12.2 3H6.8A2.8 2.8 0 0 0 4 5.8v5.4a3 3 0 0 0 .9 2.1l6.2 6.2a3 3 0 0 0 4.2 0l4.4-4.4a3 3 0 0 0 0-4.2l-6.2-6.2A3 3 0 0 0 12.2 3Z" stroke="currentColor" strokeWidth={sw} />
          <path d="M8.25 8.25h.01" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M21 8.5 12 13 3 8.5M12 13v9" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
          <path d="M21 8.5V17a2 2 0 0 1-1.1 1.8l-7.8 3.9a2 2 0 0 1-1.8 0l-7.8-3.9A2 2 0 0 1 2 17V8.5a2 2 0 0 1 1.1-1.8l7.8-3.9a2 2 0 0 1 1.8 0l7.8 3.9A2 2 0 0 1 21 8.5Z" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "server":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M4 4h16v6H4zM4 14h16v6H4z" stroke="currentColor" strokeWidth={sw} />
          <path d="M7 7h.01M7 17h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case "barcode":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M4 6v12M7 6v12M10 6v12M12 6v12M15 6v12M18 6v12M20 8v8" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M10.3 3.9 2.4 17.5A1.8 1.8 0 0 0 4 20.2h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
          <path d="M12 9v4M12 16.5h.01" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "circle-check":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={sw} />
          <path d="m8.5 12 2.4 2.4 4.6-4.8" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "refresh":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M3.5 9a8.5 8.5 0 0 1 14.4-3.2L21 9M20.5 15a8.5 8.5 0 0 1-14.4 3.2L3 15" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 4v5h-5M3 20v-5h5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "arrow-up-right":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M7 17 17 7M8 7h9v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "arrow-down-right":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M7 7 17 17M17 8v9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "activity":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M3 12h4l2.5 7 5-14L17 12h4" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "layers":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="m12 2 9 5-9 5-9-5 9-5Z" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
          <path d="m3 12 9 5 9-5M3 17l9 5 9-5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "weight":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth={sw} />
          <path d="M6.8 7h10.4l2.6 11.6A1.2 1.2 0 0 1 18.6 20H5.4a1.2 1.2 0 0 1-1.2-1.4L6.8 7Z" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "trash":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={sw} />
          <path d="M12 7v5l3.2 2" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "download":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cl} aria-hidden="true">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

/** Map a server-event action to a stroke icon. */
function actionIconName(action: string): IconName {
  switch (action) {
    case "job_created":
    case "job_sent":
      return "printer";
    case "template_updated":
      return "tag";
    case "product_added":
      return "box";
    case "report_imported":
      return "server";
    case "station_synced":
      return "refresh";
    default:
      return "activity";
  }
}

// ── shared sub-components ────────────────────────────────────────────────────

const RAISED = { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" } as const;

/** Glass panel with a 2px domain-tinted left accent rail. */
function Panel({
  rail,
  className,
  children,
  style,
}: {
  rail: string; // tailwind bg-* class for the accent rail
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={cx(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl",
        className
      )}
      style={{ ...RAISED, ...style }}
    >
      <span className={cx("absolute inset-y-0 left-0 w-[2px]", rail)} aria-hidden="true" />
      {children}
    </section>
  );
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("text-[10px] uppercase tracking-[0.14em] text-white/35", className)}>
      {children}
    </span>
  );
}

/** Compact accent-tinted metric tile (icon + label + value); becomes a button when onClick is set. */
function MetricTile({
  icon,
  label,
  accent,
  onClick,
  children,
}: {
  icon: IconName;
  label: string;
  accent: "neutral" | "emerald" | "rose" | "indigo";
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const tone = {
    neutral: "border-white/[0.07] bg-white/[0.02] text-white/40",
    emerald: "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300",
    rose: "border-rose-400/20 bg-rose-400/[0.05] text-rose-300",
    indigo: "border-indigo-400/25 bg-indigo-400/[0.06] text-indigo-200",
  }[accent];
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cx(
        "flex flex-col rounded-xl border px-3.5 py-3 text-left transition",
        tone,
        onClick && "cursor-pointer hover:brightness-150"
      )}
    >
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em]">
        <Icon name={icon} className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        {onClick && <Icon name="chevron-right" className="ml-auto h-3.5 w-3.5 shrink-0 opacity-70" />}
      </span>
      <span className="mt-1.5 text-2xl font-bold tabular-nums text-white">{children}</span>
    </Comp>
  );
}

function ModalCell({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.08em] text-white/35">{label}</div>
      <div className={cx("mt-0.5 text-[15px] font-bold tabular-nums", tone)}>{value}</div>
    </div>
  );
}

/** One field of a pack's traceability passport (expanded row in the detail table). */
function PassportField({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-[0.08em] text-white/30">{label}</div>
      <div className={cx("text-white/80", mono ? "break-all font-mono text-[11px]" : "text-[12px]")}>
        {value || "—"}
      </div>
    </div>
  );
}

/** Drill-down: every individual marking (pack) of one station — time, operator, product,
 *  weight and status — with a today/all scope and load-more, for full traceability. */
function StationDetailModal({ station, onClose, t }: { station: any; onClose: () => void; t: TFunc }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<"date" | "all">("date");
  const [date, setDate] = useState(todayStr);
  const [labels, setLabels] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const fetchOpts = mode === "all" ? { scope: "all" as const } : { date };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setExpanded(new Set());
    api.statistics
      .stationLabels(station.id, { ...fetchOpts, limit: 500, offset: 0 })
      .then((d: any) => {
        if (!alive) return;
        setLabels(d.labels ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {
        if (alive) {
          setLabels([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [station.id, mode, date]);

  const loadMore = () => {
    setLoading(true);
    api.statistics
      .stationLabels(station.id, { ...fetchOpts, limit: 500, offset: labels.length })
      .then((d: any) => setLabels((prev) => [...prev, ...(d.labels ?? [])]))
      .finally(() => setLoading(false));
  };

  const shiftDay = (days: number) => {
    const d = new Date(date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    setMode("date");
    setDate(d.toISOString().slice(0, 10));
  };

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all: any[] = [];
      let offset = 0;
      for (let i = 0; i < 50; i++) {
        const d: any = await api.statistics.stationLabels(station.id, { ...fetchOpts, limit: 1000, offset });
        const batch = d.labels ?? [];
        all.push(...batch);
        offset += batch.length;
        if (batch.length < 1000 || offset >= (d.total ?? 0)) break;
      }
      const headers = [
        t("dashboard.colTime"),
        t("dashboard.colOperator"),
        t("dashboard.colProduct"),
        t("dashboard.colPack"),
        t("dashboard.colBatch"),
        t("dashboard.colProdDate"),
        t("dashboard.colExpDate"),
        t("dashboard.colBarcode"),
        `${t("dashboard.colWeight")} ${t("dashboard.unitKg")}`,
        `${t("dashboard.colBrutto")} ${t("dashboard.unitKg")}`,
        t("dashboard.colStatus"),
      ];
      const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [headers.map(esc).join(",")];
      for (const l of all) {
        lines.push(
          [
            l.printed_at ? new Date(l.printed_at).toLocaleString("ru-RU") : "",
            l.operator,
            l.product_name,
            l.pack_name,
            l.batch,
            l.production_date,
            l.expiration_date,
            l.barcode,
            l.weight_kg ?? "",
            l.weight_brutto_kg ?? "",
            l.is_deleted ? t("dashboard.stDeleted") : t("dashboard.stMarked"),
          ]
            .map(esc)
            .join(",")
        );
      }
      const csv = "﻿" + lines.join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `station_${padNum(station.number) || station.id}_${mode === "all" ? "all" : date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Portal>
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-6 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/[0.12] bg-[#0A0A0B] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-indigo-500/[0.06] px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              onClick={onClose}
              aria-label={t("dashboard.back")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <Icon name="chevron-right" className="h-4 w-4 rotate-180" />
            </button>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sm font-bold text-white/70">
              {padNum(station.number) || "—"}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-white">{station.name || t("dashboard.stationUnknown")}</h3>
              <p className="text-[11px] text-white/40">
                {t("dashboard.markingDetail")} · {fmt(total)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
            {mode === "date" && (
              <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                <button
                  onClick={() => shiftDay(-1)}
                  aria-label={t("dashboard.prevDay")}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-white/45 transition hover:bg-white/5 hover:text-white"
                >
                  <Icon name="chevron-right" className="h-4 w-4 rotate-180" />
                </button>
                <input
                  type="date"
                  value={date}
                  max={todayStr}
                  onChange={(e) => {
                    setMode("date");
                    setDate(e.target.value || todayStr);
                  }}
                  className="bg-transparent px-1 text-[12px] text-white/80 outline-none [color-scheme:dark]"
                />
                <button
                  onClick={() => shiftDay(1)}
                  disabled={date >= todayStr}
                  aria-label={t("dashboard.nextDay")}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-white/45 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
                >
                  <Icon name="chevron-right" className="h-4 w-4" />
                </button>
              </div>
            )}
            <button
              onClick={() => setMode(mode === "all" ? "date" : "all")}
              className={cx(
                "rounded-lg px-3 py-1.5 font-medium transition",
                mode === "all"
                  ? "bg-indigo-400/20 text-indigo-200"
                  : "border border-white/10 bg-white/[0.03] text-white/45 hover:text-white"
              )}
            >
              {t("dashboard.scopeAll")}
            </button>
            <button
              onClick={exportCsv}
              disabled={exporting || total === 0}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-medium text-white/55 transition hover:text-white disabled:opacity-40"
            >
              <Icon name="download" className="h-3.5 w-3.5" />
              {exporting ? "…" : t("dashboard.exportCsv")}
            </button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {loading && labels.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-white/40">{t("dashboard.detailLoading")}</div>
          ) : labels.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-white/40">{t("dashboard.noMarks")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[#0A0A0B] text-left text-[10px] uppercase tracking-[0.08em] text-white/35">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-2 font-medium">{t("dashboard.colTime")}</th>
                  <th className="px-2 py-2 font-medium">{t("dashboard.colOperator")}</th>
                  <th className="px-2 py-2 font-medium">{t("dashboard.colProduct")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("dashboard.colWeight")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("dashboard.colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((l) => (
                  <React.Fragment key={l.id}>
                    <tr
                      onClick={() => toggleExpand(l.id)}
                      className="cursor-pointer border-b border-white/[0.05] hover:bg-white/[0.025]"
                    >
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums text-white/80">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon
                            name="chevron-right"
                            className={cx("h-3 w-3 text-white/30 transition", expanded.has(l.id) && "rotate-90")}
                          />
                          {l.printed_at ? timeStr(l.printed_at) : "—"}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-white/70">{l.operator || "—"}</td>
                      <td className="px-2 py-2">
                        <span className="text-white/85">{l.product_name || "—"}</span>
                        {l.pack_name ? <span className="text-white/35"> · {l.pack_name}</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-emerald-300/90">
                        {l.weight_kg ? `${fmt(l.weight_kg)} ${t("dashboard.unitKg")}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        {l.is_deleted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                            <Icon name="trash" className="h-3 w-3" />
                            {t("dashboard.stDeleted")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                            <Icon name="circle-check" className="h-3 w-3" />
                            {t("dashboard.stMarked")}
                          </span>
                        )}
                      </td>
                    </tr>
                    {expanded.has(l.id) && (
                      <tr className="border-b border-white/[0.05] bg-white/[0.015]">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
                            <PassportField label={t("dashboard.colBatch")} value={l.batch} />
                            <PassportField label={t("dashboard.colProdDate")} value={l.production_date} />
                            <PassportField label={t("dashboard.colExpDate")} value={l.expiration_date} />
                            <PassportField label={t("dashboard.colBarcode")} value={l.barcode} mono />
                            <PassportField
                              label={t("dashboard.colBrutto")}
                              value={l.weight_brutto_kg ? `${fmt(l.weight_brutto_kg)} ${t("dashboard.unitKg")}` : null}
                            />
                            <PassportField label={t("dashboard.colPack")} value={l.pack_name} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
          {labels.length > 0 && labels.length < total && (
            <div className="p-3 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-50"
              >
                {loading ? t("dashboard.detailLoading") : t("dashboard.loadMore", { shown: labels.length, total })}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}

/** Per-station activity modal: marked / deleted / weight / active time, sorted by marked desc.
 *  Each row drills into StationDetailModal for the full per-pack marking log. */
function StationsModal({
  open,
  onClose,
  stations,
  t,
}: {
  open: boolean;
  onClose: () => void;
  stations: any[];
  t: TFunc;
}) {
  const [detail, setDetail] = useState<any>(null);
  useEffect(() => {
    if (!open) setDetail(null);
  }, [open]);
  if (!open) return null;
  const rows = [...(stations ?? [])].sort((a, b) => (b.marked ?? 0) - (a.marked ?? 0));
  const maxMarked = Math.max(1, ...rows.map((s) => s.marked ?? 0));
  return (
    <Portal>
    <>
      <div
        className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="my-6 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/[0.12] bg-[#0A0A0B] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-indigo-500/[0.06] px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                <Icon name="server" className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-bold text-white">{t("dashboard.stationsActivity")}</h3>
            </div>
            <button
              onClick={onClose}
              aria-label={t("dashboard.close")}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[72vh] overflow-y-auto p-3">
            {rows.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-white/40">{t("dashboard.noStations")}</div>
            ) : (
              rows.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setDetail(s)}
                  className="mb-2 block w-full rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-left transition last:mb-0 hover:border-white/15 hover:bg-white/[0.04]"
                >
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-white/70">
                      {padNum(s.number) || "—"}
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold text-white">
                      {s.name || t("dashboard.stationUnknown")}
                    </span>
                    <span
                      className={cx(
                        "inline-flex items-center gap-1.5 text-[11px]",
                        s.is_online ? "text-emerald-400" : "text-white/35"
                      )}
                    >
                      <span className={cx("h-1.5 w-1.5 rounded-full", s.is_online ? "bg-emerald-400" : "bg-white/25")} />
                      {s.is_online ? t("dashboard.stOnline") : t("dashboard.stOffline")}
                    </span>
                    <Icon name="chevron-right" className="h-4 w-4 text-white/25" />
                  </div>
                  <div className="mb-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full bg-indigo-500"
                      style={{ width: `${Math.round(((s.marked ?? 0) / maxMarked) * 100)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <ModalCell label={t("dashboard.colMarked")} value={fmt(s.marked ?? 0)} tone="text-white" />
                    <ModalCell label={t("dashboard.colDeleted")} value={fmt(s.deleted ?? 0)} tone="text-rose-300" />
                    <ModalCell
                      label={t("dashboard.colWeight")}
                      value={`${fmt(s.weight_kg ?? 0)} ${t("dashboard.unitKg")}`}
                      tone="text-emerald-300"
                    />
                    <ModalCell
                      label={t("dashboard.colDuration")}
                      value={fmtDuration(s.first_at, s.last_at, t)}
                      tone="text-white/80"
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-white/35">
                    {t("dashboard.lastSync")}: {relTime(s.last_sync_at, t)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
      {detail && <StationDetailModal station={detail} onClose={() => setDetail(null)} t={t} />}
    </>
    </Portal>
  );
}

/* Job status badge */
function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cfg: Record<string, { text: string; cls: string }> = {
    pending: { text: t("dashboard.statusPending"), cls: "text-amber-400 bg-amber-500/10" },
    sent: { text: t("dashboard.statusSent"), cls: "text-sky-400 bg-sky-500/10" },
    completed: { text: t("dashboard.statusCompleted"), cls: "text-emerald-400 bg-emerald-500/10" },
    error: { text: t("dashboard.statusError"), cls: "text-rose-400 bg-rose-500/10" },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span className={cx("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold", c.cls)}>
      {c.text}
    </span>
  );
}

/* Station mode state logic */
function getStationState(mode: string, isOnline: boolean, t: TFunc) {
  if (mode === "online") {
    return isOnline
      ? { label: t("dashboard.stationOnline"), dot: "bg-emerald-500", ping: "bg-emerald-400", healthy: true }
      : { label: t("dashboard.stationUnavailable"), dot: "bg-rose-500", ping: false, healthy: false };
  }
  if (mode === "hybrid") return { label: t("dashboard.stationHybrid"), dot: "bg-sky-400", ping: false, healthy: true };
  if (mode === "offline") return { label: t("dashboard.stationOffline"), dot: "bg-white/25", ping: false, healthy: true };
  return { label: mode || t("dashboard.stationUnknown"), dot: "bg-white/25", ping: false, healthy: true };
}

/* Station mode dot */
function ModeDot({ state }: { state: ReturnType<typeof getStationState> }) {
  if (state.ping) {
    return (
      <span className="relative flex h-2.5 w-2.5 shrink-0" title={state.label}>
        <span className={cx("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", state.ping)} />
        <span className={cx("relative inline-flex rounded-full h-2.5 w-2.5", state.dot)} />
      </span>
    );
  }
  return <span className={cx("inline-flex rounded-full h-2.5 w-2.5 shrink-0", state.dot)} title={state.label} />;
}

/* Ranked bar (adapted from v1 ProductBar) */
const BAR_PALETTE = ["bg-indigo-400", "bg-violet-400", "bg-fuchsia-400", "bg-sky-400", "bg-cyan-400"];

function ProductBar({
  rank,
  label,
  value,
  max,
  unit,
}: {
  rank: number;
  label: string;
  value: number;
  max: number;
  unit?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const bar = BAR_PALETTE[rank] ?? "bg-white/30";
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-5 shrink-0 text-right text-[10px] font-bold text-white/30 font-[family-name:var(--font-geist-mono)]">
        #{rank + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/80 truncate">{label}</span>
          <span className="ml-2 shrink-0 text-xs font-bold text-white tabular-nums">
            {fmt(value)}
            {unit ? ` ${unit}` : ""}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/5">
          <div className={cx("h-1.5 rounded-full transition-all duration-700", bar)} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/* Loading skeleton */
function Skel() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-44 w-full rounded-2xl bg-white/5" />
      <div className="h-64 w-full rounded-2xl bg-white/5" />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-6 h-56 rounded-2xl bg-white/5" />
        <div className="col-span-12 lg:col-span-6 h-56 rounded-2xl bg-white/5" />
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5 h-72 rounded-2xl bg-white/5" />
        <div className="col-span-12 lg:col-span-7 h-72 rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-white/30 italic my-auto text-center py-8">{text}</p>;
}

// ── hand-drawn SVG charts (no chart library) ────────────────────────────────

type Pt = { t: string; count: number };

/** Build a smooth-ish path (Catmull-Rom-ish via quadratic midpoints) through points. */
function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` Q ${p0.x} ${p0.y} ${midX} ${(p0.y + p1.y) / 2}`;
    d += ` Q ${p1.x} ${p1.y} ${p1.x} ${p1.y}`;
  }
  return d;
}

/** Compact 24h sparkline (area) for the hero. */
function HeroSparkline({ data }: { data: Pt[] }) {
  const W = 220;
  const H = 56;
  const pad = 2;
  const series = !data || data.length === 0 ? [] : data;
  const max = Math.max(1, ...series.map((d) => d.count));
  const n = series.length;
  const pts = series.map((d, i) => ({
    x: pad + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad * 2)),
    y: H - pad - (d.count / max) * (H - pad * 2),
  }));
  const line = buildSmoothPath(pts);
  const area = pts.length > 1 ? `${line} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z` : "";
  const gid = "heroSpark";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(129,140,248)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(129,140,248)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={H - pad} x2={W} y2={H - pad} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {area && <path d={area} fill={`url(#${gid})`} />}
      {line && <path d={line} fill="none" stroke="rgb(165,180,252)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** Wide area chart for the throughput panel. */
function ThroughputChart({ data, mode }: { data: Pt[]; mode: "24h" | "7d" }) {
  const { t } = useTranslation();
  const W = 760;
  const H = 200;
  const padX = 8;
  const padTop = 16;
  const padBottom = 26;
  const series = !data || data.length === 0 ? [] : data;
  const allZero = series.length === 0 || series.every((d) => d.count === 0);
  const max = Math.max(1, ...series.map((d) => d.count));
  const n = series.length;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  const pts = series.map((d, i) => ({
    x: padX + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW),
    y: padTop + innerH - (d.count / max) * innerH,
  }));
  const line = buildSmoothPath(pts);
  const area = pts.length > 1 ? `${line} L ${pts[pts.length - 1].x} ${padTop + innerH} L ${pts[0].x} ${padTop + innerH} Z` : "";
  const baseY = padTop + innerH;

  // axis ticks
  const tickIdx: number[] = [];
  if (n > 0) {
    tickIdx.push(0);
    if (n > 2) tickIdx.push(Math.floor((n - 1) / 2));
    if (n > 1) tickIdx.push(n - 1);
  }
  const tickLabel = (iso: string) => {
    const d = new Date(iso);
    if (mode === "24h") {
      return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  };

  const gid = "throughputArea";
  const isBars = mode === "7d";
  const slot = n > 0 ? innerW / n : innerW;
  const barW = Math.min(38, slot * 0.55);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(129,140,248)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="rgb(129,140,248)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* faint baseline */}
        <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
        {/* faint mid gridline */}
        <line x1={padX} y1={padTop + innerH / 2} x2={W - padX} y2={padTop + innerH / 2} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

        {isBars ? (
          series.map((d, i) => {
            const bh = (d.count / max) * innerH;
            const cxp = padX + slot * (i + 0.5);
            const x = cxp - barW / 2;
            const y = baseY - bh;
            return (
              <g key={i}>
                {d.count > 0 && <rect x={x} y={y} width={barW} height={Math.max(2, bh)} rx="4" fill="rgb(99,102,241)" />}
                {d.count > 0 && (
                  <text x={cxp} y={y - 6} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.50)">
                    {fmt(d.count)}
                  </text>
                )}
                <text x={cxp} y={H - 8} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.30)">
                  {tickLabel(d.t)}
                </text>
              </g>
            );
          })
        ) : (
          <>
            {!allZero && area && <path d={area} fill={`url(#${gid})`} />}
            {!allZero && line && (
              <path d={line} fill="none" stroke="rgb(165,180,252)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {tickIdx.map((idx) => {
              const x = pts[idx]?.x ?? padX;
              return (
                <text
                  key={idx}
                  x={x}
                  y={H - 8}
                  textAnchor={idx === 0 ? "start" : idx === n - 1 ? "end" : "middle"}
                  fontSize="11"
                  fill="rgba(255,255,255,0.30)"
                >
                  {series[idx] ? tickLabel(series[idx].t) : ""}
                </text>
              );
            })}
          </>
        )}
      </svg>

      {allZero && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-white/30 italic">{t("dashboard.noPrintsToday")}</span>
        </div>
      )}
    </div>
  );
}

// ── activity feed (merge server_events + recent_logs) ───────────────────────

type FeedItem = {
  key: string;
  time: number;
  iso: string;
  kind: "server" | "log";
  title: string;
  sub?: string;
  // server
  action?: string;
  // log
  level?: "ERROR" | "WARNING" | "INFO" | string;
};

const LOG_DOT: Record<string, string> = {
  ERROR: "bg-rose-400",
  WARNING: "bg-amber-400",
  INFO: "bg-sky-400",
};

// ── delta computation ───────────────────────────────────────────────────────

function computeDelta(today: number, yesterday: number, t: TFunc) {
  const diff = today - yesterday;
  if (diff === 0) {
    return { dir: "equal" as const, label: "—", cls: "text-white/60 bg-white/5 border-white/10" };
  }
  if (diff > 0) {
    const pct = yesterday > 0 ? Math.round((diff / yesterday) * 100) : null;
    const label =
      pct != null
        ? t("dashboard.deltaPctVsYesterday", { value: `+${pct}%` })
        : t("dashboard.deltaCountVsYesterday", { value: `+${fmt(diff)}` });
    return { dir: "up" as const, label, cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" };
  }
  const pct = yesterday > 0 ? Math.round((diff / yesterday) * 100) : null;
  const label =
    pct != null
      ? t("dashboard.deltaPctVsYesterday", { value: `${pct}%` })
      : t("dashboard.deltaCountVsYesterday", { value: `${fmt(diff)}` });
  return { dir: "down" as const, label, cls: "text-rose-300 bg-rose-500/10 border-rose-500/20" };
}

// ── main component ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [stationsOpen, setStationsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [chartMode, setChartMode] = useState<"24h" | "7d">("24h");
  const [feedFilter, setFeedFilter] = useState<"all" | "server" | "station" | "error">("all");

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const data = await api.statistics.get();
      setStats(data);
      setError("");
      setLastFetched(new Date().toISOString());
    } catch (e: any) {
      setError(e.message || t("dashboard.statsLoadError"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 60_000);
    return () => clearInterval(t);
  }, []);

  // ── derived values (hooks must run before any early return) ──
  const stationsSorted = useMemo(() => {
    const list = (stats?.stations_detail as any[]) ?? [];
    return [...list].sort((a, b) => {
      const sa = getStationState(a.mode, a.is_online, t);
      const sb = getStationState(b.mode, b.is_online, t);
      const aBad = !sa.healthy || isStaleSync(a.last_sync_at);
      const bBad = !sb.healthy || isStaleSync(b.last_sync_at);
      if (aBad !== bBad) return aBad ? -1 : 1;
      return (a.number ?? 9999) - (b.number ?? 9999);
    });
  }, [stats, t]);

  const feed = useMemo<FeedItem[]>(() => {
    const events = (stats?.server_events as any[]) ?? [];
    const logs = (stats?.recent_logs as any[]) ?? [];
    const items: FeedItem[] = [];
    for (const ev of events) {
      items.push({
        key: `ev-${ev.id}`,
        time: new Date(ev.created_at).getTime(),
        iso: ev.created_at,
        kind: "server",
        title: ev.action_display || ev.description || t("dashboard.eventFallback"),
        sub: ev.action_display && ev.description ? ev.description : undefined,
        action: ev.action,
      });
    }
    for (const log of logs) {
      items.push({
        key: `log-${log.id}`,
        time: new Date(log.timestamp).getTime(),
        iso: log.timestamp,
        kind: "log",
        title: log.message,
        sub: log.station,
        level: log.level,
      });
    }
    return items.sort((a, b) => b.time - a.time);
  }, [stats, t]);

  const feedFiltered = useMemo(() => {
    return feed.filter((it) => {
      if (feedFilter === "all") return true;
      if (feedFilter === "server") return it.kind === "server";
      if (feedFilter === "station") return it.kind === "log";
      if (feedFilter === "error") return it.kind === "log" && it.level === "ERROR";
      return true;
    });
  }, [feed, feedFilter]);

  if (loading) return <Skel />;
  if (error)
    return (
      <div className="p-4 text-rose-400 bg-rose-500/10 rounded-2xl text-sm">{error}</div>
    );
  if (!stats) return null;

  const r = stats.readiness ?? {};
  const labelsToday: number = stats.labels_today ?? 0;
  const labelsYesterday: number = stats.labels_yesterday ?? 0;
  const delta = computeDelta(labelsToday, labelsYesterday, t);

  const throughput24h: Pt[] = (stats.throughput_24h as Pt[]) ?? [];
  const throughput7d: Pt[] = (stats.throughput_7d as Pt[]) ?? [];
  const chartData = chartMode === "24h" ? throughput24h : throughput7d;

  const activeStations: number = stats.active_stations ?? 0;
  const totalStations: number = stats.total_stations ?? 0;
  const stationRatioPct = totalStations > 0 ? Math.round((activeStations / totalStations) * 100) : 0;

  const topStations: any[] = stats.top_stations ?? [];
  const topProducts: any[] = stats.top_products ?? [];
  const maxStationCount: number = topStations.length > 0 ? topStations[0].count : 1;
  const maxProductCount: number = topProducts.length > 0 ? topProducts[0].count : 1;

  const productsWithoutTemplate: number = r.products_without_template ?? 0;

  // readiness chip (3/3)
  const readyChecks = [
    { ok: (r.products_count ?? 0) > 0, label: t("dashboard.readyProducts"), value: r.products_count ?? 0, icon: "box" as IconName },
    { ok: (r.templates_count ?? 0) > 0, label: t("dashboard.readyTemplates"), value: r.templates_count ?? 0, icon: "tag" as IconName },
    { ok: (r.barcode_templates_count ?? 0) > 0, label: t("dashboard.readyBarcodes"), value: r.barcode_templates_count ?? 0, icon: "barcode" as IconName },
  ];
  const readyCount = readyChecks.filter((c) => c.ok).length;

  const feedTabs: { key: typeof feedFilter; label: string }[] = [
    { key: "all", label: t("dashboard.tabAll") },
    { key: "server", label: t("dashboard.tabServer") },
    { key: "station", label: t("dashboard.tabStations") },
    { key: "error", label: t("dashboard.tabErrors") },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* ── freshness bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon name="activity" className="h-4 w-4 text-indigo-300" />
          <h2 className="text-sm font-semibold tracking-tight text-white/85">Pulse</h2>
          <Eyebrow className="hidden sm:inline">{t("dashboard.serverAnalytics")}</Eyebrow>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-white/35">
          <span>{t("dashboard.updatedAt", { time: relTime(lastFetched, t) })}</span>
          <button
            onClick={fetchStats}
            disabled={refreshing}
            aria-label={t("dashboard.refresh")}
            title={t("dashboard.refresh")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/55 transition hover:border-white/25 hover:text-white disabled:opacity-50"
          >
            <Icon name="refresh" className={cx("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── 1) HERO KPI BAND ──────────────────────────────────────────────── */}
      <Panel rail="bg-indigo-400/80" className="px-6 py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
          {/* hero number + delta + sparkline */}
          <div className="flex min-w-0 flex-1 flex-col">
            <Eyebrow>{t("dashboard.labelsToday")}</Eyebrow>
            <div className="mt-1 flex flex-wrap items-end gap-3">
              <span className="text-5xl font-black leading-none tabular-nums text-white sm:text-6xl">
                {fmt(labelsToday)}
              </span>
              <span
                className={cx(
                  "mb-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  delta.cls
                )}
              >
                {delta.dir === "up" && <Icon name="arrow-up-right" className="h-3.5 w-3.5" />}
                {delta.dir === "down" && <Icon name="arrow-down-right" className="h-3.5 w-3.5" />}
                {delta.label}
              </span>
            </div>

            <div className="mt-4 max-w-md">
              <HeroSparkline data={throughput24h} />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-white/25">{t("dashboard.hours24")}</span>
                <span className="text-[10px] text-white/25">{t("dashboard.now")}</span>
              </div>
            </div>

            {productsWithoutTemplate > 0 && (
              <div className="mt-4">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-medium text-rose-300">
                  <Icon name="alert-triangle" className="h-3.5 w-3.5" />
                  {t("dashboard.productsWithoutTemplate", { count: fmt(productsWithoutTemplate) })}
                </span>
              </div>
            )}
          </div>

          {/* tributary metric tiles */}
          <div className="grid grid-cols-2 gap-2.5 self-center lg:w-[420px] lg:shrink-0">
            <MetricTile icon="layers" label={t("dashboard.total")} accent="neutral">
              {fmt(stats.total_labels)}
            </MetricTile>
            <MetricTile icon="weight" label={t("dashboard.weightTodayFixed")} accent="emerald">
              {fmt(stats.weight_today_kg ?? 0)}
              <span className="text-base font-semibold text-emerald-400/60"> {t("dashboard.unitKg")}</span>
            </MetricTile>
            <MetricTile icon="trash" label={t("dashboard.deletedToday")} accent="rose">
              {fmt(stats.deleted_today ?? 0)}
              <span className="text-base font-semibold text-rose-300/55"> {t("dashboard.unitWeighings")}</span>
            </MetricTile>
            <MetricTile
              icon="server"
              label={t("dashboard.stationsOnline")}
              accent="indigo"
              onClick={() => setStationsOpen(true)}
            >
              <span className="flex items-center gap-2">
                <span className={cx("h-2 w-2 rounded-full", activeStations > 0 ? "bg-emerald-400" : "bg-white/25")} />
                {activeStations}
                <span className="text-base font-semibold text-white/40"> / {totalStations}</span>
              </span>
            </MetricTile>
          </div>
        </div>
      </Panel>

      <StationsModal
        open={stationsOpen}
        onClose={() => setStationsOpen(false)}
        stations={stationsSorted}
        t={t}
      />

      {/* ── 2) THROUGHPUT CHART ───────────────────────────────────────────── */}
      <Panel rail="bg-violet-400/70" className="px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex flex-col">
            <Eyebrow>{t("dashboard.printVolume")}</Eyebrow>
            <span className="text-sm font-semibold text-white/85">
              {chartMode === "24h" ? t("dashboard.last24Hours") : t("dashboard.last7Days")}
            </span>
          </div>
          <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-[11px]">
            {(["24h", "7d"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={cx(
                  "rounded-md px-3 py-1 font-medium transition",
                  chartMode === m ? "bg-indigo-400/20 text-indigo-200" : "text-white/45 hover:text-white"
                )}
              >
                {m === "24h" ? t("dashboard.toggle24h") : t("dashboard.toggle7d")}
              </button>
            ))}
          </div>
        </div>
        <ThroughputChart data={chartData} mode={chartMode} />
      </Panel>

      {/* ── 3) LEADERS ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        <Panel rail="bg-fuchsia-400/70" className="col-span-12 p-5 lg:col-span-6">
          <div className="mb-3 flex items-center gap-2">
            <Icon name="server" className="h-4 w-4 text-white/40" />
            <Eyebrow>{t("dashboard.stationLeaders")}</Eyebrow>
          </div>
          {!topStations || topStations.length === 0 ? (
            <EmptyState text={t("dashboard.noPrintData")} />
          ) : (
            <div className="flex flex-col">
              {topStations.map((s: any, i: number) => (
                <ProductBar
                  key={i}
                  rank={i}
                  label={`${s.number != null ? `#${padNum(s.number)} ` : ""}${s.name}`}
                  value={s.count}
                  max={maxStationCount}
                  unit={t("dashboard.unitPcs")}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel rail="bg-sky-400/70" className="col-span-12 p-5 lg:col-span-6">
          <div className="mb-3 flex items-center gap-2">
            <Icon name="tag" className="h-4 w-4 text-white/40" />
            <Eyebrow>{t("dashboard.topProducts")}</Eyebrow>
          </div>
          {!topProducts || topProducts.length === 0 ? (
            <EmptyState text={t("dashboard.noPrintData")} />
          ) : (
            <div className="flex flex-col">
              {topProducts.map((p: any, i: number) => (
                <ProductBar key={i} rank={i} label={p.name} value={p.count} max={maxProductCount} unit={t("dashboard.unitPcs")} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── 4) STATION HEALTH ─────────────────────────────────────────────── */}
      <Panel rail="bg-emerald-400/70" className="p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Icon name="server" className="h-4 w-4 text-white/40" />
            <Eyebrow>{t("dashboard.stationHealth")}</Eyebrow>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-white/5 sm:block">
              <div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${stationRatioPct}%` }} />
            </div>
            <span className="text-xs font-semibold tabular-nums text-white/70">
              {activeStations} / {totalStations}
            </span>
          </div>
        </div>

        {stationsSorted.length === 0 ? (
          <EmptyState text={t("dashboard.noStations")} />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {stationsSorted.map((s: any) => {
              const st = getStationState(s.mode, s.is_online, t);
              const stale = isStaleSync(s.last_sync_at);
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                >
                  <ModeDot state={st} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {s.number != null ? `#${padNum(s.number)} ` : ""}
                      {s.name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/35">
                      {st.label}
                      {" · "}
                      <span className={cx(stale ? "text-amber-400" : "text-white/35")}>
                        {t("dashboard.syncedAgo", { time: relTime(s.last_sync_at, t) })}
                      </span>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-white/55 font-[family-name:var(--font-geist-mono)]">
                    {fmt(s.labels_count)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ── 5) ACTIVITY TIMELINE + recent jobs ────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        {/* Activity feed */}
        <Panel rail="bg-indigo-400/70" className="col-span-12 p-5 lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon name="activity" className="h-4 w-4 text-white/40" />
              <Eyebrow>{t("dashboard.activity")}</Eyebrow>
            </div>
            <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-[11px]">
              {feedTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFeedFilter(t.key)}
                  className={cx(
                    "rounded-md px-2.5 py-1 font-medium transition",
                    feedFilter === t.key ? "bg-indigo-400/20 text-indigo-200" : "text-white/45 hover:text-white"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {feedFiltered.length === 0 ? (
            <EmptyState text={t("dashboard.noActivity")} />
          ) : (
            <div className="flex max-h-[360px] flex-col divide-y divide-white/5 overflow-y-auto">
              {feedFiltered.map((it) => (
                <div key={it.key} className="flex items-start gap-3 py-2.5">
                  {it.kind === "server" ? (
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-white/55">
                      <Icon name={actionIconName(it.action || "")} className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center">
                      <span className={cx("h-2 w-2 rounded-full", LOG_DOT[it.level || ""] ?? "bg-sky-400")} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug text-white/80">{it.title}</p>
                    <p className="mt-0.5 text-[10px] text-white/30">
                      {it.sub ? `${it.sub} · ` : ""}
                      {timeStr(it.iso)}
                    </p>
                  </div>
                  {it.kind === "log" && it.level === "ERROR" && (
                    <span className="shrink-0 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-400">
                      ERR
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Recent print jobs */}
        <Panel rail="bg-amber-400/70" className="col-span-12 p-5 lg:col-span-5">
          <div className="mb-3 flex items-center gap-2">
            <Icon name="printer" className="h-4 w-4 text-white/40" />
            <Eyebrow>{t("dashboard.recentJobs")}</Eyebrow>
          </div>
          {!stats.recent_jobs || stats.recent_jobs.length === 0 ? (
            <EmptyState text={t("dashboard.noJobs")} />
          ) : (
            <div className="flex flex-col divide-y divide-white/5">
              {stats.recent_jobs.map((j: any) => (
                <div key={j.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-8 shrink-0 text-[10px] font-bold text-white/25 font-[family-name:var(--font-geist-mono)]">
                    #{j.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{j.nomenclature_name}</p>
                    <p className="mt-0.5 text-[10px] text-white/35">
                      {j.station_name}
                      {j.station_number != null ? ` (#${padNum(j.station_number)})` : ""}
                      {" · "}
                      <span className="tabular-nums">{fmt(j.quantity)}</span> {j.quantity_unit === "kg" ? t("dashboard.unitKg") : t("dashboard.unitPcs")}
                    </p>
                  </div>
                  <StatusBadge status={j.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── 6) READINESS chip ─────────────────────────────────────────────── */}
      <Panel rail="bg-cyan-400/60" className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
        <div className="flex items-center gap-2">
          {readyCount === readyChecks.length ? (
            <Icon name="circle-check" className="h-4 w-4 text-emerald-400" />
          ) : (
            <Icon name="alert-triangle" className="h-4 w-4 text-amber-400" />
          )}
          <span className="text-xs font-semibold text-white/80">
            {t("dashboard.readiness")}{" "}
            <span className={cx("tabular-nums", readyCount === readyChecks.length ? "text-emerald-400" : "text-amber-400")}>
              {readyCount}/{readyChecks.length}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {readyChecks.map((c) => (
            <span
              key={c.label}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium",
                c.ok
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                  : "border-rose-500/20 bg-rose-500/5 text-rose-300"
              )}
              title={c.ok ? t("dashboard.ready") : t("dashboard.notConfigured")}
            >
              <Icon name={c.icon} className="h-3.5 w-3.5" />
              {c.label}
              <span className="tabular-nums opacity-70">{fmt(c.value)}</span>
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}
