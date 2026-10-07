"use client";

// «Сегодня»: what is printing now, what is ready for the shift and where the admin's
// decision is needed (canvas «LabelPilot Server — редизайн», board «Сегодня v2»).
// Keeps every earlier dashboard feature: labels/weight/deleted today vs yesterday,
// print volume 24 h / 7 days, readiness, station activity and per-station marking
// detail (day navigation, all time, CSV), recent jobs, event feed, top products.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, type StationsToday } from "@/lib/api/client";
import { useTranslation, type Lang } from "@/lib/i18n";
import { stationProblem, PROBLEMS, type Station, type StationProblem } from "@/lib/stations";
import Portal from "../Portal";
import type { NavKey } from "../shell/Sidebar";
import { cx, formatNumber, Icon, PROBLEM_TONE, sinceText, TONE_INK, TONE_SOFT, type Tone } from "../stations/shared";

type TFunc = (key: string, params?: Record<string, string | number | undefined>) => string;
type Pt = { t: string; count: number };

const card = "rounded-[18px] border border-lp-line bg-lp-surface";
const linkButton = "border-0 bg-transparent p-0 text-[14px] font-extrabold text-lp-accent-ink hover:underline";

function timeOf(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
}

function padNum(n: number | string | null | undefined): string {
  return n == null || n === "" ? "" : String(n).padStart(2, "0");
}

function fmtDuration(firstIso: string | null, lastIso: string | null, t: TFunc): string {
  if (!firstIso || !lastIso) return "—";
  const ms = new Date(lastIso).getTime() - new Date(firstIso).getTime();
  if (!(ms > 0)) return "—";
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? t("dashboard.durHM", { h, m }) : t("dashboard.durM", { m });
}

// ── Path of a label: the four steps that must be in order for stations to print ──

type Step = { key: NavKey; n: number; title: string; ok: boolean; text: string; cta: string };

function LabelPath({ steps, onNavigate }: { steps: Step[]; onNavigate?: (key: NavKey) => void }) {
  const { t } = useTranslation();
  const blocking = steps.find((s) => !s.ok);
  return (
    <section aria-labelledby="path-title" className={cx(card, "flex flex-col gap-3.5 px-5 py-[18px]")}>
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 id="path-title" className="m-0 text-[17px] font-extrabold">{t("today.pathTitle")}</h2>
        <span className="text-[14px] text-lp-ink-3">
          {blocking ? t("today.pathBlocked", { n: blocking.n }) : t("today.pathOk")}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-2.5">
        {steps.map((s) => (
          <button
            // Two steps can lead to the same section (products, then their templates).
            key={s.n}
            type="button"
            onClick={() => onNavigate?.(s.key)}
            className={cx(
              "flex flex-col gap-2 rounded-[14px] border border-lp-line p-3.5 text-left transition hover:border-lp-line-2",
              s.ok ? "bg-lp-surface" : "bg-lp-raised",
            )}
          >
            <span className="flex w-full items-center gap-2.5">
              <span className={cx("flex h-7 w-7 items-center justify-center rounded-[9px] text-[14px] font-extrabold tabular-nums", s.ok ? "bg-lp-accent-bg text-lp-accent-ink" : "bg-lp-coral-bg text-lp-coral")}>
                {s.n}
              </span>
              <span className="text-[15px] font-extrabold">{s.title}</span>
              <span className={cx("ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-extrabold", s.ok ? "bg-lp-ok-bg text-lp-ok" : "bg-lp-warn-bg text-lp-warn")}>
                {s.ok ? t("today.stepOk") : t("today.stepBlocks")}
              </span>
            </span>
            <span className="text-[14px] text-lp-ink-2">{s.text}</span>
            <span className={cx("text-[14px] font-extrabold", s.ok ? "text-lp-ink-3" : "text-lp-accent-ink")}>{s.cta}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Print volume chart: bars per hour (24 h) or per day (7 days) ──

function VolumeChart({ data, mode, lang, t }: { data: Pt[]; mode: "24h" | "7d"; lang: Lang; t: TFunc }) {
  const max = Math.max(0, ...data.map((p) => p.count));
  if (max === 0) {
    return <p className="m-0 py-10 text-center text-[14px] text-lp-ink-3">{t("dashboard.noPrintsToday")}</p>;
  }
  const label = (iso: string) => {
    const d = new Date(iso);
    return mode === "24h"
      ? d.toLocaleTimeString(lang, { hour: "2-digit" }).replace(/\D+$/, "")
      : d.toLocaleDateString(lang, { weekday: "short" });
  };
  const peak = data.reduce((best, p) => (p.count > best.count ? p : best), data[0]);
  const every = mode === "24h" ? 3 : 1;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-right text-[13px] tabular-nums text-lp-ink-3">
        {t("today.peak", { count: formatNumber(peak.count, lang), when: mode === "24h" ? timeOf(peak.t, lang) : new Date(peak.t).toLocaleDateString(lang, { day: "numeric", month: "short" }) })}
      </span>
      <div className="flex h-[150px] items-end gap-1.5 border-b border-lp-line px-1">
        {data.map((p, i) => (
          <div key={p.t} className="flex h-full flex-1 flex-col items-center justify-end" title={`${label(p.t)} · ${formatNumber(p.count, lang)}`}>
            <div
              className={cx("w-full max-w-[46px] rounded-t-[6px]", p.count === 0 ? "bg-lp-off-bg" : i === data.length - 1 ? "bg-lp-bar" : "bg-lp-accent")}
              style={{ height: p.count === 0 ? 3 : Math.max(5, Math.round((p.count / max) * 138)) }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 px-1">
        {data.map((p, i) => (
          <span key={p.t} className="flex-1 text-center text-[11px] tabular-nums text-lp-ink-3">
            {i % every === 0 ? label(p.t) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Per-station marking detail (side drawer): day navigation, all time, CSV ──

function PassportField({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-[12px] font-bold text-lp-ink-3">{label}</span>
      <span className={cx("truncate text-[13px] text-lp-ink", mono && "font-mono")}>{value ? String(value) : "—"}</span>
    </div>
  );
}

function StationDrawer({ station, totals, onClose }: { station: { id: number; name: string; number: string | null }; totals: any; onClose: () => void }) {
  const { t, lang } = useTranslation();
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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      .catch(() => { if (alive) { setLabels([]); setTotal(0); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [station.id, mode, date]); // eslint-disable-line react-hooks/exhaustive-deps

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
        t("dashboard.colTime"), t("dashboard.colOperator"), t("dashboard.colProduct"), t("dashboard.colPack"),
        t("dashboard.colBatch"), t("dashboard.colProdDate"), t("dashboard.colExpDate"), t("dashboard.colBarcode"),
        `${t("dashboard.colWeight")} ${t("dashboard.unitKg")}`, `${t("dashboard.colBrutto")} ${t("dashboard.unitKg")}`,
        t("dashboard.colStatus"),
      ];
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [headers.map(esc).join(",")];
      for (const l of all) {
        lines.push([
          l.printed_at ? new Date(l.printed_at).toLocaleString(lang) : "",
          l.operator, l.product_name, l.pack_name, l.batch, l.production_date, l.expiration_date, l.barcode,
          l.weight_kg ?? "", l.weight_brutto_kg ?? "",
          l.is_deleted ? t("dashboard.stDeleted") : t("dashboard.stMarked"),
        ].map(esc).join(","));
      }
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
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

  const navButton = "flex h-9 w-9 items-center justify-center rounded-[9px] text-lp-ink-2 transition hover:bg-lp-raised disabled:opacity-30";

  return (
    <Portal>
      <div className="fixed inset-0 z-[110] flex justify-end bg-[#0a0e16]/40" onClick={onClose}>
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={`${station.name} · ${t("dashboard.markingDetail")}`}
          className="flex h-full w-full max-w-[760px] flex-col border-l border-lp-line bg-lp-surface font-sans text-lp-ink shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-3 border-b border-lp-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              {station.number && <span className="rounded-[7px] border border-lp-line-2 px-[7px] py-[2px] font-mono text-[13px] font-semibold tabular-nums text-lp-ink-2">{padNum(station.number)}</span>}
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="m-0 truncate text-[18px] font-extrabold">{station.name}</h2>
                <span className="text-[13px] text-lp-ink-3">{t("dashboard.markingDetail")} · {formatNumber(total, lang)}</span>
              </div>
              <button type="button" onClick={onClose} aria-label={t("dashboard.close")} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-lp-line text-lp-ink-2 transition hover:bg-lp-raised">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            {totals && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  [t("dashboard.colMarked"), formatNumber(totals.marked ?? 0, lang)],
                  [t("dashboard.colDeleted"), formatNumber(totals.deleted ?? 0, lang)],
                  [t("dashboard.colWeight"), `${formatNumber(totals.weight_kg ?? 0, lang, 1)} ${t("dashboard.unitKg")}`],
                  [t("dashboard.colDuration"), fmtDuration(totals.first_at, totals.last_at, t)],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col rounded-[12px] bg-lp-raised px-3 py-2">
                    <span className="text-[12px] text-lp-ink-3">{k} · {t("today.allTime")}</span>
                    <span className="text-[16px] font-extrabold tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-[11px] border border-lp-line">
                <button type="button" onClick={() => shiftDay(-1)} aria-label={t("dashboard.prevDay")} className={navButton}>‹</button>
                <input
                  type="date"
                  value={date}
                  max={todayStr}
                  aria-label={t("today.day")}
                  onChange={(e) => { setMode("date"); setDate(e.target.value || todayStr); }}
                  className={cx("bg-transparent px-1 text-[14px] font-bold outline-none", mode === "all" && "text-lp-ink-3")}
                />
                <button type="button" onClick={() => shiftDay(1)} disabled={mode === "date" && date >= todayStr} aria-label={t("dashboard.nextDay")} className={navButton}>›</button>
              </div>
              <button
                type="button"
                onClick={() => setMode(mode === "all" ? "date" : "all")}
                aria-pressed={mode === "all"}
                className={cx("min-h-[38px] rounded-[10px] px-3 text-[14px] font-bold transition", mode === "all" ? "bg-lp-accent-bg text-lp-accent-ink" : "border border-lp-line text-lp-ink-2 hover:bg-lp-raised")}
              >
                {t("dashboard.scopeAll")}
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={exporting || total === 0}
                className="ml-auto min-h-[38px] rounded-[10px] border border-lp-line-2 px-3 text-[14px] font-extrabold transition hover:bg-lp-raised disabled:opacity-40"
              >
                {exporting ? "…" : t("dashboard.exportCsv")}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && labels.length === 0 ? (
              <p className="m-0 px-5 py-12 text-center text-[14px] text-lp-ink-3">{t("dashboard.detailLoading")}</p>
            ) : labels.length === 0 ? (
              <p className="m-0 px-5 py-12 text-center text-[14px] text-lp-ink-3">{t("dashboard.noMarks")}</p>
            ) : (
              <table className="w-full text-[14px]">
                <thead className="sticky top-0 z-10 bg-lp-raised text-left text-[12px] font-bold text-lp-ink-3">
                  <tr>
                    <th className="px-5 py-2 font-bold">{t("dashboard.colTime")}</th>
                    <th className="px-2 py-2 font-bold">{t("dashboard.colOperator")}</th>
                    <th className="px-2 py-2 font-bold">{t("dashboard.colProduct")}</th>
                    <th className="px-2 py-2 text-right font-bold">{t("dashboard.colWeight")}</th>
                    <th className="px-5 py-2 text-right font-bold">{t("dashboard.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {labels.map((l) => (
                    <React.Fragment key={l.id}>
                      <tr onClick={() => toggleExpand(l.id)} className="cursor-pointer border-t border-lp-line hover:bg-lp-raised">
                        <td className="whitespace-nowrap px-5 py-2.5 tabular-nums">
                          <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden="true" className={cx("text-lp-ink-3 transition", expanded.has(l.id) && "rotate-90")}>›</span>
                            {l.printed_at ? (mode === "all" ? new Date(l.printed_at).toLocaleString(lang, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : timeOf(l.printed_at, lang)) : "—"}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-lp-ink-2">{l.operator || "—"}</td>
                        <td className="px-2 py-2.5">
                          <span className="font-semibold">{l.product_name || "—"}</span>
                          {l.pack_name ? <span className="text-lp-ink-3"> · {l.pack_name}</span> : null}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
                          {l.weight_kg ? `${formatNumber(l.weight_kg, lang, 3)} ${t("dashboard.unitKg")}` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-right">
                          <span className={cx("rounded-full px-2.5 py-0.5 text-[12px] font-extrabold", l.is_deleted ? "bg-lp-bad-bg text-lp-bad" : "bg-lp-ok-bg text-lp-ok")}>
                            {l.is_deleted ? `■ ${t("dashboard.stDeleted")}` : `● ${t("dashboard.stMarked")}`}
                          </span>
                        </td>
                      </tr>
                      {expanded.has(l.id) && (
                        <tr className="bg-lp-raised">
                          <td colSpan={5} className="px-5 py-3">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
                              <PassportField label={t("dashboard.colBatch")} value={l.batch} />
                              <PassportField label={t("dashboard.colProdDate")} value={l.production_date} />
                              <PassportField label={t("dashboard.colExpDate")} value={l.expiration_date} />
                              <PassportField label={t("dashboard.colBarcode")} value={l.barcode} mono />
                              <PassportField label={t("dashboard.colBrutto")} value={l.weight_brutto_kg ? `${formatNumber(l.weight_brutto_kg, lang, 3)} ${t("dashboard.unitKg")}` : null} />
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
              <div className="p-4 text-center">
                <button type="button" onClick={loadMore} disabled={loading} className="min-h-[38px] rounded-[10px] border border-lp-line-2 px-4 text-[14px] font-bold transition hover:bg-lp-raised disabled:opacity-50">
                  {loading ? t("dashboard.detailLoading") : t("dashboard.loadMore", { shown: labels.length, total })}
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </Portal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const JOB_TONE: Record<string, Tone | "accent"> = { pending: "warn", sent: "accent", completed: "ok", error: "bad" };
const JOB_LABEL: Record<string, string> = { pending: "dashboard.statusPending", sent: "dashboard.statusSent", completed: "dashboard.statusCompleted", error: "dashboard.statusError" };

type FeedItem = { key: string; time: number; iso: string; kind: "server" | "log"; title: string; sub?: string; level?: string };

export default function Dashboard({ onNavigate }: { onNavigate?: (key: NavKey) => void }) {
  const { t, lang } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [today, setToday] = useState<StationsToday | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [chartMode, setChartMode] = useState<"24h" | "7d">("24h");
  const [feedFilter, setFeedFilter] = useState<"all" | "server" | "station" | "error">("all");
  const [drawer, setDrawer] = useState<{ id: number; name: string; number: string | null } | null>(null);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, list, td] = await Promise.all([
        api.statistics.get(),
        api.stations.list().catch(() => [] as Station[]),
        api.statistics.stationsToday().catch(() => null),
      ]);
      setStats(s);
      setStations(list);
      setToday(td);
      setError("");
      setFetchedAt(new Date());
    } catch (e: any) {
      setError(e?.message || t("dashboard.statsLoadError"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    for (const ev of (stats?.server_events ?? []).filter(Boolean)) {
      items.push({
        key: `ev-${ev.id}`, time: new Date(ev.created_at).getTime(), iso: ev.created_at, kind: "server",
        title: ev.action_display || ev.description || t("dashboard.eventFallback"),
        sub: ev.action_display && ev.description ? ev.description : undefined,
      });
    }
    for (const log of (stats?.recent_logs ?? []).filter(Boolean)) {
      items.push({ key: `log-${log.id}`, time: new Date(log.timestamp).getTime(), iso: log.timestamp, kind: "log", title: log.message, sub: log.station, level: log.level });
    }
    return items.sort((a, b) => b.time - a.time);
  }, [stats, t]);

  if (loading) return <p className="m-0 text-[14px] text-lp-ink-3">{t("dashboard.detailLoading")}</p>;
  if (error && !stats) return <p className="m-0 rounded-[14px] bg-lp-bad-bg px-4 py-3 text-[14px] font-bold text-lp-bad">■ {error}</p>;
  if (!stats) return null;

  const r = stats.readiness ?? {};
  const labelsToday: number = stats.labels_today ?? 0;
  const labelsYesterday: number = stats.labels_yesterday ?? 0;
  const deletedToday: number = stats.deleted_today ?? 0;
  const go = (key: NavKey) => onNavigate?.(key);

  // ── stations: problems (shared rule with the Stations page) and today's work ──
  const todayById = new Map((today?.stations ?? []).map((row) => [row.id, row]));
  const problems = stations
    .map((station) => ({ station, problem: stationProblem(station) }))
    .filter((x): x is { station: Station; problem: StationProblem } => x.problem !== null)
    .sort((a, b) => PROBLEMS.indexOf(a.problem) - PROBLEMS.indexOf(b.problem));
  const online = stations.filter((s) => s.is_online && !s.conflict_fingerprint).length;
  const inUse = stations.filter((s) => (s.seat_state ?? "active") !== "released");
  const stationRows = [...inUse].sort((a, b) => (todayById.get(b.id)?.labels ?? 0) - (todayById.get(a.id)?.labels ?? 0));

  const jobs: any[] = (stats.recent_jobs ?? []).filter(Boolean);
  const failedJobs = jobs.filter((j) => j.status === "error");
  const withoutTemplate: number = r.products_without_template ?? 0;
  const stale: number = r.stations_stale_sync ?? 0;

  // ── the four steps of a label ──
  const steps: Step[] = [
    {
      key: "catalog", n: 1, title: t("today.stepProducts"), ok: (r.products_count ?? 0) > 0,
      text: (r.products_count ?? 0) > 0 ? t("today.stepProductsOk", { n: formatNumber(r.products_count, lang) }) : t("today.stepProductsEmpty"),
      cta: t("today.openProducts"),
    },
    (r.templates_count ?? 0) > 0 && withoutTemplate > 0
      ? {
        // Templates exist but some products have none: they are assigned on the product card.
        key: "catalog" as NavKey, n: 2, title: t("today.stepTemplates"), ok: false,
        text: t("today.stepTemplatesMissing", { n: formatNumber(withoutTemplate, lang) }),
        cta: t("today.assignTemplates"),
      }
      : {
        key: "labels" as NavKey, n: 2, title: t("today.stepTemplates"), ok: (r.templates_count ?? 0) > 0,
        text: (r.templates_count ?? 0) === 0
          ? t("today.stepTemplatesEmpty")
          : t("today.stepTemplatesOk", { labels: r.templates_count ?? 0, barcodes: r.barcode_templates_count ?? 0 }),
        cta: (r.templates_count ?? 0) === 0 ? t("today.createTemplate") : t("today.openTemplates"),
      },
    {
      key: "stations", n: 3, title: t("today.stepStations"), ok: inUse.length > 0 && problems.length === 0,
      text: stations.length === 0
        ? t("today.stepStationsEmpty")
        : problems.length > 0
          ? t("today.stepStationsProblems", { online, total: stations.length, n: problems.length })
          : t("today.stepStationsOk", { online, total: stations.length }),
      cta: problems.length > 0 ? t("today.checkStations") : t("today.openStations"),
    },
    {
      key: "print_tasks", n: 4, title: t("today.stepPrint"), ok: failedJobs.length === 0,
      text: failedJobs.length > 0
        ? t("today.stepPrintFailed", { n: failedJobs.length })
        : t("today.stepPrintOk", { labels: formatNumber(labelsToday, lang), jobs: r.pending_jobs_count ?? 0 }),
      cta: t("today.openPrint"),
    },
  ];

  // ── what needs a decision, most urgent first; each thing once ──
  type Attention = { key: string; tone: Tone; icon: StationProblem | "template" | "job" | "sync"; title: string; why: string; action: string; to: NavKey };
  const attention: Attention[] = [
    ...problems.map(({ station, problem }) => ({
      key: `st-${station.station_uuid}`, tone: PROBLEM_TONE[problem], icon: problem,
      title: t(`today.att.${problem}`, { name: station.station_name, duration: sinceText(station.changed_at, t) }),
      why: t(`stp.p.${problem}.why`), action: t("today.toStations"), to: "stations" as NavKey,
    })),
    ...failedJobs.map((j) => ({
      key: `job-${j.id}`, tone: "bad" as Tone, icon: "job" as const,
      title: t("today.att.job", { id: j.id, product: j.nomenclature_name, station: j.station_name }),
      why: t("today.att.jobWhy"), action: t("today.openPrint"), to: "print_tasks" as NavKey,
    })),
    ...((r.templates_count ?? 0) === 0 && (r.products_count ?? 0) > 0 ? [{
      key: "tpl", tone: "warn" as Tone, icon: "template" as const,
      title: t("today.att.noTemplates"), why: t("today.att.noTemplatesWhy"), action: t("today.createTemplate"), to: "labels" as NavKey,
    }] : withoutTemplate > 0 ? [{
      key: "tpl", tone: "warn" as Tone, icon: "template" as const,
      title: t("today.att.template", { n: formatNumber(withoutTemplate, lang) }),
      why: t("today.att.templateWhy"), action: t("today.assignTemplates"), to: "catalog" as NavKey,
    }] : []),
    ...(stale > 0 ? [{
      key: "stale", tone: "warn" as Tone, icon: "sync" as const,
      title: t("today.att.stale", { n: stale }), why: t("today.att.staleWhy"), action: t("today.toStations"), to: "stations" as NavKey,
    }] : []),
  ].sort((a, b) => (a.tone === "bad" ? 0 : 1) - (b.tone === "bad" ? 0 : 1));
  const ATTENTION_LIMIT = 4;

  // ── KPI tiles ──
  let delta: { text: string; tone: string } = { text: t("today.sameAsYesterday"), tone: "text-lp-ink-3" };
  if (labelsYesterday > 0 && labelsToday !== labelsYesterday) {
    const pct = Math.round(((labelsToday - labelsYesterday) / labelsYesterday) * 100);
    delta = { text: t("dashboard.deltaPctVsYesterday", { value: `${pct > 0 ? "+" : ""}${pct}%` }), tone: pct >= 0 ? "text-lp-ok" : "text-lp-ink-3" };
  } else if (labelsYesterday === 0 && labelsToday > 0) {
    delta = { text: t("today.noneYesterday"), tone: "text-lp-ink-3" };
  }
  const deletedShare = labelsToday + deletedToday > 0 ? (deletedToday / (labelsToday + deletedToday)) * 100 : 0;
  const kpis = [
    { label: t("today.kpiLabels"), value: formatNumber(labelsToday, lang), unit: t("dashboard.unitPcs"), note: delta.text, noteTone: delta.tone },
    { label: t("today.kpiWeight"), value: formatNumber(stats.weight_today_kg ?? 0, lang, 1), unit: t("dashboard.unitKg"), note: t("today.kpiWeightNote"), noteTone: "text-lp-ink-3" },
    { label: t("today.kpiDeleted"), value: formatNumber(deletedToday, lang), unit: t("dashboard.unitPcs"), note: t("today.kpiDeletedNote", { pct: formatNumber(deletedShare, lang, 1), kg: formatNumber(stats.deleted_weight_today_kg ?? 0, lang, 1) }), noteTone: "text-lp-ink-3" },
    { label: t("today.kpiTotal"), value: formatNumber(stats.total_labels ?? 0, lang), unit: t("dashboard.unitPcs"), note: t("today.kpiTotalNote"), noteTone: "text-lp-ink-3" },
  ];

  const chartData: Pt[] = ((chartMode === "24h" ? stats.throughput_24h : stats.throughput_7d) ?? []).filter(Boolean);
  const topToday: any[] = (stats.top_products_today ?? []).filter(Boolean);
  const topMax = topToday[0]?.count || 1;
  const feedFiltered = feed.filter((it) =>
    feedFilter === "all" || (feedFilter === "server" ? it.kind === "server" : feedFilter === "station" ? it.kind === "log" : it.kind === "log" && it.level === "ERROR"));
  const detailFor = (id: number) => (stats.stations_detail ?? []).find((s: any) => s?.id === id);
  const date = new Date();

  const segmented = (active: boolean) =>
    cx("min-h-9 rounded-[9px] px-3 text-[13px] font-extrabold transition", active ? "bg-lp-surface text-lp-ink shadow-sm" : "text-lp-ink-3 hover:text-lp-ink");

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto flex max-w-[600px] flex-col gap-1">
          <span className="text-[13px] font-bold text-lp-coral">
            {date.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })}
            {fetchedAt ? ` · ${t("today.updatedAt", { time: timeOf(fetchedAt.toISOString(), lang) })}` : ""}
          </span>
          <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.02em]">{t("today.title")}</h1>
          <p className="m-0 text-[14px] text-lp-ink-2">{t("nav.homeDesc")}</p>
        </div>
        <button
          type="button"
          onClick={fetchAll}
          disabled={refreshing}
          className="min-h-[44px] rounded-[11px] border border-lp-line bg-lp-surface px-3.5 text-[14px] font-extrabold transition hover:bg-lp-raised disabled:opacity-60"
        >
          {refreshing ? "…" : t("dashboard.refresh")}
        </button>
        <button
          type="button"
          onClick={() => go("print_tasks")}
          className="flex min-h-[44px] items-center gap-2 rounded-[11px] bg-lp-accent px-[18px] text-[14px] font-extrabold text-[#fff] transition hover:brightness-110"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M7 8V3h10v5" /><rect x="3" y="8" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" /></svg>
          {t("today.sendToPrint")}
        </button>
      </div>

      {error && <p className="m-0 rounded-[12px] bg-lp-warn-bg px-4 py-2.5 text-[14px] font-bold text-lp-warn">▲ {error}</p>}

      <LabelPath steps={steps} onNavigate={onNavigate} />

      {attention.length > 0 && (
        <section aria-labelledby="attn-title" className={cx(card, "overflow-hidden")}>
          <div className="flex items-center gap-2.5 px-5 py-3.5">
            <h2 id="attn-title" className="m-0 text-[17px] font-extrabold">{t("stp.needsDecision")}</h2>
            <span className="rounded-full bg-lp-bad-bg px-2 py-px text-[12px] font-extrabold tabular-nums text-lp-bad">{attention.length}</span>
          </div>
          {attention.slice(0, ATTENTION_LIMIT).map((a) => (
            <div key={a.key} className="flex flex-wrap items-center gap-3.5 border-t border-lp-line px-5 py-3.5">
              <span className={cx("flex h-9 w-9 flex-none items-center justify-center rounded-[11px]", TONE_SOFT[a.tone], TONE_INK[a.tone])}>
                {a.icon === "template" || a.icon === "job" || a.icon === "sync"
                  ? <span aria-hidden="true" className="text-[15px] font-black">{a.tone === "bad" ? "!" : "?"}</span>
                  : <Icon name={a.icon} className="h-5 w-5" />}
              </span>
              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
                <span className="text-[14px] font-extrabold">{a.title}</span>
                <span className="text-[14px] text-lp-ink-2">{a.why}</span>
              </div>
              <button type="button" onClick={() => go(a.to)} className="min-h-[42px] rounded-[11px] border border-lp-line-2 bg-lp-surface px-4 text-[14px] font-extrabold transition hover:bg-lp-raised">
                {a.action}
              </button>
            </div>
          ))}
          {attention.length > ATTENTION_LIMIT && (
            <p className="m-0 border-t border-lp-line px-5 py-3 text-[14px] text-lp-ink-3">{t("today.moreAttention", { n: attention.length - ATTENTION_LIMIT })}</p>
          )}
        </section>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-[16px] border border-lp-line bg-lp-surface px-[18px] py-4">
            <span className="text-[13px] font-bold text-lp-ink-3">{k.label}</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[30px] font-extrabold tabular-nums tracking-[-0.02em]">{k.value}</span>
              <span className="font-bold text-lp-ink-3">{k.unit}</span>
            </div>
            <span className={cx("text-[13px] font-bold", k.noteTone)}>{k.note}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <div className="flex w-full min-w-0 flex-[2_1_620px] flex-col gap-4">
          <section aria-labelledby="volume-title" className={cx(card, "flex flex-col gap-3.5 px-5 py-[18px]")}>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 id="volume-title" className="m-0 text-[17px] font-extrabold">{t("dashboard.printVolume")}</h2>
              <span className="text-[14px] text-lp-ink-3">{chartMode === "24h" ? t("dashboard.last24Hours") : t("dashboard.last7Days")}</span>
              <div role="tablist" aria-label={t("dashboard.printVolume")} className="ml-auto flex gap-1 rounded-[11px] bg-lp-bg p-[3px]">
                {(["24h", "7d"] as const).map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={chartMode === m} onClick={() => setChartMode(m)} className={segmented(chartMode === m)}>
                    {m === "24h" ? t("dashboard.toggle24h") : t("dashboard.toggle7d")}
                  </button>
                ))}
              </div>
            </div>
            <VolumeChart data={chartData} mode={chartMode} lang={lang} t={t} />
          </section>

          <section aria-labelledby="st-title" className={cx(card, "overflow-hidden")}>
            <div className="flex flex-wrap items-baseline gap-2.5 px-5 py-4">
              <h2 id="st-title" className="m-0 text-[17px] font-extrabold">{t("nav.stations")}</h2>
              <span className="text-[14px] text-lp-ink-3">{t("today.stationsHint")}</span>
              <button type="button" onClick={() => go("stations")} className={cx(linkButton, "ml-auto")}>{t("today.allStations")}</button>
            </div>
            {stationRows.length === 0 ? (
              <p className="m-0 border-t border-lp-line px-5 py-6 text-center text-[14px] text-lp-ink-3">{t("dashboard.noStations")}</p>
            ) : (
              stationRows.map((s) => {
                const row = todayById.get(s.id);
                const problem = stationProblem(s);
                const tone: Tone = problem ? PROBLEM_TONE[problem] : "ok";
                const state = problem
                  ? t(`stp.p.${problem}.label`, { duration: sinceText(s.changed_at, t) }).toLowerCase()
                  : (row?.labels ?? 0) > 0 ? t("today.printing") : t("stp.onLink");
                return (
                  <button
                    key={s.station_uuid}
                    type="button"
                    onClick={() => setDrawer({ id: s.id, name: s.station_name, number: s.station_number })}
                    className="grid w-full grid-cols-[minmax(0,190px)_minmax(0,1fr)_88px_88px_14px] items-center gap-3.5 border-t border-lp-line px-5 py-3 text-left transition hover:bg-lp-raised max-sm:grid-cols-[minmax(0,1fr)_72px_14px]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className={cx("h-2.5 w-2.5 flex-none rounded-full", tone === "ok" ? "bg-lp-ok" : tone === "bad" ? "bg-lp-bad" : "bg-lp-warn")} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[14px] font-extrabold">{s.station_name}</span>
                        <span className={cx("text-[12px] font-bold", TONE_INK[tone])}>{state}</span>
                      </span>
                    </span>
                    <span className="truncate text-[14px] text-lp-ink-2 max-sm:hidden">{row?.last_product || "—"}</span>
                    <span className="flex flex-col">
                      <span className="text-[14px] font-extrabold tabular-nums">{formatNumber(row?.labels ?? 0, lang)}</span>
                      <span className="text-[12px] text-lp-ink-3">{t("today.labelsShort")}</span>
                    </span>
                    <span className="flex flex-col max-sm:hidden">
                      <span className="text-[14px] font-bold tabular-nums">{timeOf(row?.last_at, lang)}</span>
                      <span className="text-[12px] text-lp-ink-3">{t("today.lastLabel")}</span>
                    </span>
                    <span aria-hidden="true" className="text-lp-ink-3">›</span>
                  </button>
                );
              })
            )}
          </section>

          <section aria-labelledby="jobs-title" className={cx(card, "overflow-hidden")}>
            <div className="flex items-baseline gap-2.5 px-5 py-4">
              <h2 id="jobs-title" className="m-0 text-[17px] font-extrabold">{t("today.jobsTitle")}</h2>
              <button type="button" onClick={() => go("print_tasks")} className={cx(linkButton, "ml-auto")}>{t("today.allJobs")}</button>
            </div>
            {jobs.length === 0 ? (
              <p className="m-0 border-t border-lp-line px-5 py-6 text-center text-[14px] text-lp-ink-3">{t("dashboard.noJobs")}</p>
            ) : (
              jobs.map((j) => {
                const tone = JOB_TONE[j.status] ?? "off";
                return (
                  <div key={j.id} className="flex flex-wrap items-center gap-3 border-t border-lp-line px-5 py-3">
                    <span className="w-11 font-mono text-[12px] tabular-nums text-lp-ink-3">{timeOf(j.created_at, lang)}</span>
                    <span className="min-w-0 flex-[1_1_220px] text-[14px] font-bold">
                      {j.nomenclature_name} · {formatNumber(j.quantity ?? 0, lang)} {j.quantity_unit === "kg" ? t("dashboard.unitKg") : t("dashboard.unitPcs")}
                    </span>
                    <span className="w-[120px] truncate text-[14px] text-lp-ink-2">{j.station_name}</span>
                    <span className={cx("rounded-full px-2.5 py-0.5 text-[12px] font-extrabold", tone === "accent" ? "bg-lp-accent-bg text-lp-accent-ink" : cx(TONE_SOFT[tone as Tone], TONE_INK[tone as Tone]))}>
                      {t(JOB_LABEL[j.status] ?? "dashboard.statusPending")}
                    </span>
                  </div>
                );
              })
            )}
          </section>
        </div>

        <div className="flex w-full min-w-0 flex-[1_1_300px] flex-col gap-4">
          <section aria-labelledby="top-title" className={cx(card, "flex flex-col gap-3 px-5 py-[18px]")}>
            <h2 id="top-title" className="m-0 text-[17px] font-extrabold">{t("today.topToday")}</h2>
            {topToday.length === 0 ? (
              <p className="m-0 text-[14px] text-lp-ink-3">{t("dashboard.noPrintsToday")}</p>
            ) : (
              topToday.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2.5">
                  <span className="w-5 text-[14px] font-extrabold tabular-nums text-lp-ink-3">{i + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[14px] font-bold">{p.name}</span>
                    <div className="h-[5px] rounded-[3px] bg-lp-off-bg">
                      <div className="h-[5px] rounded-[3px] bg-lp-sky" style={{ width: `${Math.max(4, Math.round((p.count / topMax) * 100))}%` }} />
                    </div>
                  </div>
                  <span className="text-[14px] font-extrabold tabular-nums">{formatNumber(p.count, lang)}</span>
                </div>
              ))
            )}
          </section>

          <section aria-labelledby="feed-title" className={cx(card, "overflow-hidden")}>
            <div className="flex flex-col gap-2.5 px-5 pb-2.5 pt-4">
              <h2 id="feed-title" className="m-0 text-[17px] font-extrabold">{t("today.feedTitle")}</h2>
              <div role="tablist" aria-label={t("today.feedTitle")} className="flex gap-1 rounded-[11px] bg-lp-bg p-[3px]">
                {([["all", "dashboard.tabAll"], ["server", "dashboard.tabServer"], ["station", "dashboard.tabStations"], ["error", "dashboard.tabErrors"]] as const).map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={feedFilter === key} onClick={() => setFeedFilter(key)} className={cx(segmented(feedFilter === key), "flex-1 px-1")}>
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
            {feedFiltered.length === 0 ? (
              <p className="m-0 border-t border-lp-line px-5 py-6 text-center text-[14px] text-lp-ink-3">{t("dashboard.noActivity")}</p>
            ) : (
              <div className="max-h-[380px] overflow-y-auto">
                {feedFiltered.map((it) => (
                  <div key={it.key} className="flex gap-2.5 border-t border-lp-line px-5 py-2.5">
                    <span className={cx("mt-1.5 h-2 w-2 flex-none rounded-full", it.kind === "server" ? "bg-lp-accent" : it.level === "ERROR" ? "bg-lp-bad" : it.level === "WARNING" ? "bg-lp-warn" : "bg-lp-ok")} />
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[14px] font-bold">{it.title}</span>
                      <span className="text-[12px] text-lp-ink-3">{it.sub ? `${it.sub} · ` : ""}{timeOf(it.iso, lang)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="flex items-start gap-3 rounded-[18px] border border-dashed border-lp-line-2 px-5 py-4">
            <img src="/icons/logo.svg" alt="" width={28} height={28} className="mt-0.5 h-7 w-7 flex-none" />
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-extrabold">{t("today.howTitle")}</span>
              <span className="text-[14px] text-lp-ink-2">{t("today.howText")}</span>
            </div>
          </section>
        </div>
      </div>

      {drawer && <StationDrawer station={drawer} totals={detailFor(drawer.id)} onClose={() => setDrawer(null)} />}
    </div>
  );
}
