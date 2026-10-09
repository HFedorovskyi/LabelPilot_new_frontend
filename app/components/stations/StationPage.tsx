"use client";

// A station's own page (canvas «LabelPilot Server — редизайн», board «Станция — своя
// страница»), instead of the side panel: ← Станции and ‹ › to the neighbours, the station's
// state and its one main action, the decision card when something is wrong, and tabs:
// Статистика for any day or period, Этикетки (packs, boxes, pallets, deleted in colour, CSV),
// Журнал (what happened at the station) and Настройки.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { LicenseInfo } from "@/lib/api/license";
import {
    productionApi, type ContainerRow, type JournalEvent, type LabelLevel, type LabelPage, type PackRow, type Period, type StationStats,
} from "@/lib/api/production";
import { useTranslation, type Lang } from "@/lib/i18n";
import { stationProblem, type Station } from "@/lib/stations";
import { Callout, Settings } from "./StationPanel";
import { cx, download, formatNumber, Icon, PROBLEM_TONE, TONE_BG, TONE_DOT, TONE_INK, TONE_SOFT, TONE_SYMBOL, formatWeight, sinceText, whenText, type Tone } from "./shared";

type TFunc = (key: string, params?: Record<string, string | number | undefined>) => string;
type Tab = "stats" | "labels" | "journal" | "settings";
type Quick = "today" | "yesterday" | "week" | "month" | "custom";

const linkButton = "border-0 bg-transparent p-0 text-[14px] font-extrabold text-lp-accent-ink hover:underline";
const ghostButton = "min-h-[42px] rounded-[12px] border border-lp-line-2 bg-lp-surface px-4 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised disabled:opacity-50";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDay = (s: string) => new Date(`${s}T12:00:00`);
const addDays = (s: string, n: number) => { const d = parseDay(s); d.setDate(d.getDate() + n); return ymd(d); };
const todayYmd = () => ymd(new Date());

function quickPeriod(kind: Quick, current: Period): Period {
    const today = todayYmd();
    if (kind === "today") return { from: today, to: today };
    if (kind === "yesterday") return { from: addDays(today, -1), to: addDays(today, -1) };
    if (kind === "week") return { from: addDays(today, -6), to: today };
    if (kind === "month") return { from: addDays(today, -29), to: today };
    return current;
}

function periodLabel(p: Period, lang: Lang) {
    const fmt = (s: string, opts: Intl.DateTimeFormatOptions) => parseDay(s).toLocaleDateString(lang, opts);
    if (p.from === p.to) return fmt(p.from, { weekday: "long", day: "numeric", month: "long" });
    return `${fmt(p.from, { day: "numeric", month: "long" })} — ${fmt(p.to, { day: "numeric", month: "long", year: "numeric" })}`;
}

const timeOf = (iso: string | null | undefined, lang: Lang) => (iso ? new Date(iso).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" }) : "—");
const dateTimeOf = (iso: string | null | undefined, lang: Lang) =>
    (iso ? new Date(iso).toLocaleString(lang, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

function minutesText(minutes: number, t: TFunc) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h ? (m ? t("td.hMin", { h, m }) : t("td.h", { h })) : t("td.min", { n: m });
}

export default function StationPage({ station, siblings, license, isAdmin, host, onBack, onSelect, onChanged }: {
    station: Station; siblings: Station[]; license: LicenseInfo | null; isAdmin: boolean; host: string;
    onBack: () => void; onSelect: (uuid: string) => void; onChanged: () => void;
}) {
    const { t, lang } = useTranslation();
    const [tab, setTab] = useState<Tab>("stats");
    const [quick, setQuick] = useState<Quick>("today");
    const [period, setPeriod] = useState<Period>(() => quickPeriod("today", { from: todayYmd(), to: todayYmd() }));
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);
    const [menu, setMenu] = useState(false);
    const [dump, setDump] = useState<string | null>(null);

    const [stats, setStats] = useState<StationStats | null>(null);
    const [statsError, setStatsError] = useState("");
    useEffect(() => {
        let alive = true;
        setStats(null);
        const load = () => productionApi.stats(station.station_uuid, period)
            .then((s) => { if (alive) { setStats(s); setStatsError(""); } })
            .catch((e) => { if (alive) setStatsError(e instanceof Error ? e.message : String(e)); });
        void load();
        const id = setInterval(load, 60_000);
        return () => { alive = false; clearInterval(id); };
    }, [station.station_uuid, period]);
    const fault = stats?.fault ?? null;

    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        setNotice(null); setDump(null); setMenu(false);
        root.current?.closest("main")?.scrollTo({ top: 0 });
    }, [station.station_uuid]);

    const problem = stationProblem(station);
    const released = (station.seat_state ?? "active") === "released";
    const seats = license?.seats;
    const freeSeat = seats != null && (seats.limit == null || seats.active < seats.limit);
    const index = siblings.findIndex((s) => s.station_uuid === station.station_uuid);
    const neighbour = (step: number) => siblings[(index + step + siblings.length) % siblings.length];

    const run = async (operation: () => Promise<unknown>, done: string, confirmText?: string) => {
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(true);
        setNotice(null);
        try {
            await operation();
            setNotice({ tone: "ok", text: done });
            onChanged();
        } catch (e) {
            setNotice({ tone: "bad", text: t("stp.err", { message: e instanceof Error ? e.message : String(e) }) });
        } finally {
            setBusy(false);
        }
    };

    const tone: Tone = problem ? PROBLEM_TONE[problem] : released ? "off" : fault ? "bad" : "ok";
    const stateText = problem ? t(`stp.p.${problem}.label`, { duration: sinceText(station.changed_at, t) }).trim()
        : released ? t("stp.f.seatReleased") : fault ? fault.message : t("stp.onLink");
    const fileName = station.station_name.replace(/\s+/g, "_");
    const dataAt = station.data_pushed_at ?? station.last_sync_at;
    const pickQuick = (kind: Quick) => { setQuick(kind); if (kind !== "custom") setPeriod(quickPeriod(kind, period)); };

    return (
        <div ref={root} className="mx-auto flex w-full max-w-[1240px] flex-col gap-4">
            <nav aria-label={t("sp.nav")} className="lp-glass sticky top-0 z-10 flex items-center gap-2 rounded-[16px] px-2.5 py-2">
                <button type="button" onClick={onBack} className="flex min-h-[40px] items-center gap-1.5 rounded-[12px] px-3 text-[14px] font-extrabold text-lp-ink-2 transition hover:bg-lp-raised">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                    {t("nav.stations")}
                </button>
                {siblings.length > 1 && (
                    <div className="ml-auto flex items-center gap-1 text-[13px] font-extrabold text-lp-ink-3">
                        <button type="button" aria-label={t("sp.prev")} onClick={() => onSelect(neighbour(-1).station_uuid)} className="flex h-10 w-10 items-center justify-center rounded-[11px] hover:bg-lp-raised">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                        </button>
                        <span className="tabular-nums">{t("sp.position", { n: index + 1, total: siblings.length })}</span>
                        <button type="button" aria-label={t("sp.next")} onClick={() => onSelect(neighbour(1).station_uuid)} className="flex h-10 w-10 items-center justify-center rounded-[11px] hover:bg-lp-raised">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                        </button>
                    </div>
                )}
            </nav>

            <header className="flex flex-wrap items-center gap-4">
                <span className={cx("flex h-[60px] w-[60px] flex-none items-center justify-center rounded-[20px]", TONE_SOFT[tone], TONE_INK[tone])}><Icon name="station" className="h-7 w-7" /></span>
                <div className="mr-auto flex min-w-0 flex-col gap-1.5">
                    <div className="flex items-center gap-2.5">
                        <h1 className="m-0 text-[34px] font-extrabold leading-tight tracking-[-0.03em]">{station.station_name}</h1>
                        {station.station_number && <span className="rounded-[8px] bg-lp-off-bg px-2 py-0.5 font-mono text-[14px] font-semibold text-lp-ink-3">{station.station_number}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[14px] text-lp-ink-2">
                        <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-extrabold", TONE_SOFT[tone], TONE_INK[tone])}><i aria-hidden="true" className={cx("block h-2 w-2 rounded-full", TONE_DOT[tone])} />{stateText}</span>
                        <span>{dataAt ? t("sp.dataSent", { time: whenText(dataAt, lang, t) }) : t("sp.dataNever")}</span>
                        {station.station_ip && <span className="font-mono text-[13px]">{station.station_ip}:{station.station_port}</span>}
                    </div>
                </div>
                <div className="relative flex gap-2.5">
                    <button type="button" disabled={busy || problem !== null || released} onClick={() => run(() => api.stations.sync(station.station_uuid), t("stp.sent"))}
                        className="flex min-h-[46px] items-center gap-2 rounded-[13px] lp-btn-primary px-[18px] text-[14px] font-extrabold text-[#fff] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>
                        {t("stp.sendNow")}
                    </button>
                    <button type="button" aria-label={t("sp.more")} aria-expanded={menu} onClick={() => setMenu((v) => !v)} className={cx(ghostButton, "w-[46px] px-0 text-[18px]")}>⋯</button>
                    {menu && (
                        <div role="menu" className="absolute right-0 top-[54px] z-20 flex min-w-[290px] flex-col rounded-[16px] bg-lp-surface p-1.5 shadow-[0_30px_60px_-30px_rgba(10,20,40,.5)] ring-1 ring-lp-line">
                            <button type="button" role="menuitem" className="rounded-[10px] px-3 py-2.5 text-left text-[14px] font-bold hover:bg-lp-raised"
                                onClick={() => { setMenu(false); void run(async () => download(await api.stations.downloadIdentity(station.station_uuid), `identity_${fileName}.lpi`), t("stp.downloaded")); }}>{t("stp.fileIdentity")}</button>
                            <button type="button" role="menuitem" disabled={problem !== null && problem !== "offline"} className="rounded-[10px] px-3 py-2.5 text-left text-[14px] font-bold hover:bg-lp-raised disabled:opacity-50"
                                onClick={() => { setMenu(false); void run(async () => download(await api.stations.downloadUpdate(station.station_uuid), `update_${fileName}_${todayYmd()}.lps`), t("stp.downloaded")); }}>{t("stp.filePackage")}</button>
                            <button type="button" role="menuitem" className="rounded-[10px] px-3 py-2.5 text-left text-[14px] font-bold hover:bg-lp-raised"
                                onClick={async () => {
                                    setMenu(false);
                                    try { setDump(JSON.stringify(await api.stations.getFullDump(station.station_uuid), null, 2)); } catch (e) { setNotice({ tone: "bad", text: t("stp.err", { message: e instanceof Error ? e.message : String(e) }) }); }
                                }}>{t("stp.techData")}</button>
                        </div>
                    )}
                </div>
            </header>

            {notice && <p className={cx("m-0 rounded-[12px] px-3.5 py-2.5 text-[14px] font-bold", TONE_BG[notice.tone])}>{TONE_SYMBOL[notice.tone]} {notice.text}</p>}
            {dump && (
                <div className="lp-card flex flex-col gap-2 p-3">
                    <button type="button" onClick={() => setDump(null)} className={cx(linkButton, "self-end text-[13px]")}>{t("stp.hideTech")}</button>
                    <pre className="m-0 max-h-80 overflow-auto rounded-[12px] bg-lp-raised p-3 font-mono text-[11px] text-lp-ink-2">{dump}</pre>
                </div>
            )}
            <Callout station={station} problem={problem} released={released} freeSeat={freeSeat} license={license} isAdmin={isAdmin} busy={busy} host={host} run={run} />
            {fault && !problem && !released && (
                <div className="flex flex-col gap-1 rounded-[14px] bg-lp-bad-bg p-3.5">
                    <span className="text-[14px] font-extrabold text-lp-bad">■ {fault.message}</span>
                    <span className="text-[14px] text-lp-ink">{t(fault.component === "scale" ? "td.fix.scale" : "td.fix.printer")} {t("sp.faultSince", { time: timeOf(fault.since, lang) })}</span>
                </div>
            )}

            <div role="tablist" aria-label={t("sp.tabs")} className="flex gap-1 border-b border-lp-line-2">
                {(["stats", "labels", "journal", "settings"] as Tab[]).map((key) => (
                    <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                        className={cx("-mb-px border-b-[3px] px-4 py-3 text-[15px] font-extrabold transition", tab === key ? "border-lp-accent text-lp-ink" : "border-transparent text-lp-ink-3 hover:text-lp-ink")}>
                        {t(`sp.tab.${key}`)}
                    </button>
                ))}
            </div>

            {tab !== "settings" && (
                <PeriodBar station={station} quick={quick} period={period} pickQuick={pickQuick} setPeriod={(p) => { setQuick("custom"); setPeriod(p); }} t={t} lang={lang}
                    extra={tab === "stats" ? <a href={productionApi.labelsCsvUrl(station.station_uuid, period, { level: "pack" })} className={cx(linkButton, "ml-auto")}>{t("sp.csvPeriod")}</a> : null} />
            )}
            {tab === "stats" && <StatsTab stats={stats} error={statsError} t={t} lang={lang} />}
            {tab === "labels" && <LabelsTab station={station} period={period} t={t} lang={lang} />}
            {tab === "journal" && <JournalTab station={station} period={period} t={t} lang={lang} />}
            {tab === "settings" && (
                <div className="lp-card overflow-hidden">
                    <Settings station={station} isAdmin={isAdmin} license={license} busy={busy} run={run} onDeleted={onBack} />
                </div>
            )}
        </div>
    );
}

// ─── Period: quick choices, ‹ day ›, a calendar with the days the station printed ──

function PeriodBar({ station, quick, period, pickQuick, setPeriod, t, lang, extra }: {
    station: Station; quick: Quick; period: Period; pickQuick: (q: Quick) => void; setPeriod: (p: Period) => void; t: TFunc; lang: Lang; extra?: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const single = period.from === period.to;
    const step = (n: number) => {
        const len = single ? 1 : Math.round((parseDay(period.to).getTime() - parseDay(period.from).getTime()) / 86400000) + 1;
        setPeriod({ from: addDays(period.from, n * len), to: addDays(period.to, n * len) });
    };
    const future = period.to >= todayYmd();
    return (
        <div className="flex flex-wrap items-center gap-2.5">
            <div role="tablist" aria-label={t("sp.period")} className="flex gap-1 rounded-[12px] bg-lp-bg p-[3px]">
                {(["today", "yesterday", "week", "month", "custom"] as Quick[]).map((kind) => (
                    <button key={kind} type="button" role="tab" aria-selected={quick === kind} onClick={() => { pickQuick(kind); setOpen(kind === "custom"); }}
                        className={cx("min-h-9 whitespace-nowrap rounded-[9px] px-3 text-[13px] font-extrabold transition", quick === kind ? "bg-lp-surface text-lp-ink shadow-sm" : "text-lp-ink-3 hover:text-lp-ink")}>
                        {t(`sp.q.${kind}`)}
                    </button>
                ))}
            </div>
            <div className="relative">
                <div className="flex items-center gap-1 rounded-[14px] bg-lp-surface p-1 shadow-sm ring-1 ring-lp-line">
                    <button type="button" aria-label={t("sp.earlier")} onClick={() => step(-1)} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-lp-ink-2 hover:bg-lp-raised">‹</button>
                    <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex min-h-9 items-center gap-2 whitespace-nowrap rounded-[10px] bg-lp-raised px-3 text-[14px] font-extrabold">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
                        {periodLabel(period, lang)}
                    </button>
                    <button type="button" aria-label={t("sp.later")} disabled={future} onClick={() => step(1)} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-lp-ink-2 hover:bg-lp-raised disabled:opacity-40">›</button>
                </div>
                {open && <Calendar station={station} period={period} onPick={(p) => { setPeriod(p); }} onClose={() => setOpen(false)} t={t} lang={lang} />}
            </div>
            {extra}
        </div>
    );
}

function Calendar({ station, period, onPick, onClose, t, lang }: { station: Station; period: Period; onPick: (p: Period) => void; onClose: () => void; t: TFunc; lang: Lang }) {
    const [month, setMonth] = useState(() => period.to.slice(0, 7));
    const [worked, setWorked] = useState<Set<string>>(new Set());
    const [anchor, setAnchor] = useState<string | null>(null);
    const box = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let alive = true;
        productionApi.days(station.station_uuid, month).then((d) => { if (alive) setWorked(new Set(d.days)); }).catch(() => { });
        return () => { alive = false; };
    }, [station.station_uuid, month]);
    useEffect(() => {
        const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) onClose(); };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
    }, [onClose]);
    const first = parseDay(`${month}-01`);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const today = todayYmd();
    const shift = (n: number) => { const d = new Date(first); d.setMonth(d.getMonth() + n); setMonth(ymd(d).slice(0, 7)); };
    const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(lang, { weekday: "short" }));
    const pick = (day: string) => {
        if (!anchor) { setAnchor(day); onPick({ from: day, to: day }); return; }
        const [a, b] = anchor <= day ? [anchor, day] : [day, anchor];
        setAnchor(null);
        onPick({ from: a, to: b });
        onClose();
    };
    return (
        <div ref={box} role="dialog" aria-label={t("sp.calendar")} className="absolute left-0 top-[52px] z-30 w-[300px] rounded-[18px] bg-lp-surface p-3.5 shadow-[0_30px_60px_-30px_rgba(10,20,40,.5)] ring-1 ring-lp-line">
            <div className="mb-2 flex items-center justify-between font-extrabold">
                <button type="button" aria-label={t("sp.prevMonth")} onClick={() => shift(-1)} className={linkButton}>‹</button>
                <span>{(() => { const m = first.toLocaleDateString(lang, { month: "long", year: "numeric" }); return m.charAt(0).toUpperCase() + m.slice(1); })()}</span>
                <button type="button" aria-label={t("sp.nextMonth")} disabled={`${month}-01` > today} onClick={() => shift(1)} className={cx(linkButton, "disabled:opacity-40")}>›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[13px]">
                {weekdays.map((w) => <span key={w} className="text-[11px] font-bold text-lp-ink-3">{w}</span>)}
                {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
                {Array.from({ length: daysIn }, (_, i) => {
                    const day = `${month}-${String(i + 1).padStart(2, "0")}`;
                    const inRange = day >= period.from && day <= period.to;
                    const edge = day === period.from || day === period.to;
                    const later = day > today;
                    return (
                        <button key={day} type="button" disabled={later} onClick={() => pick(day)} aria-pressed={inRange}
                            className={cx("relative flex h-[34px] items-center justify-center rounded-[9px] font-bold transition disabled:opacity-30",
                                edge ? "bg-lp-accent text-[#fff]" : inRange ? "bg-lp-accent-bg text-lp-accent-ink" : "hover:bg-lp-raised")}>
                            {i + 1}
                            {worked.has(day) && !edge && <i aria-hidden="true" className="absolute bottom-[4px] block h-1 w-1 rounded-full bg-lp-ok" />}
                        </button>
                    );
                })}
            </div>
            <p className="m-0 mt-2.5 text-[12px] text-lp-ink-3">{anchor ? t("sp.calPickEnd") : t("sp.calHint")}</p>
        </div>
    );
}

// ─── Статистика ──────────────────────────────────────────────────────────────

function StatsTab({ stats, error, t, lang }: { stats: StationStats | null; error: string; t: TFunc; lang: Lang }) {
    if (error) return <p className="m-0 rounded-[12px] bg-lp-bad-bg px-4 py-3 text-[14px] font-bold text-lp-bad">■ {error}</p>;
    if (!stats) return <p className="m-0 text-[14px] text-lp-ink-3">{t("dashboard.detailLoading")}</p>;
    const { totals, work } = stats;
    const prev = totals.previous_labels;
    let compare = "";
    let compareTone = "text-lp-ink-3";
    if (prev > 0) {
        const pct = Math.round(((totals.labels - prev) / prev) * 100);
        compare = t(stats.single_day ? "sp.vsWeekday" : "sp.vsPeriod", { pct: `${pct > 0 ? "+" : ""}${pct} %` });
        compareTone = pct >= 0 ? "text-lp-ok" : "text-lp-bad";
    } else if (totals.labels > 0) {
        compare = t(stats.single_day ? "sp.vsWeekdayNone" : "sp.vsPeriodNone");
    }
    const max = Math.max(1, ...stats.series.map((p) => p.count));
    // One day: the hours around the work (today no further than this hour); a period: every day.
    const lastHour = stats.from === todayYmd() ? new Date().getHours() + 1 : 24;
    const worked = stats.series.map((p, i) => (p.count ? i : -1)).filter((i) => i >= 0);
    const series = stats.single_day
        ? stats.series.slice(worked.length ? Math.max(0, worked[0] - 1) : 6, Math.min(lastHour, worked.length ? worked[worked.length - 1] + 2 : 20))
        : stats.series;
    const deletedPct = totals.labels + totals.deleted > 0 ? (totals.deleted / (totals.labels + totals.deleted)) * 100 : 0;
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
                <Tile label={t("sp.k.packs")} value={formatNumber(totals.labels, lang)} unit={t("dashboard.unitPcs")} notes={[[compare, compareTone], [(totals.boxes || totals.pallets) ? t("sp.k.boxes", { b: totals.boxes, p: totals.pallets }) : "", "text-lp-ink-3"]]} />
                <Tile label={t("sp.k.kg")} value={formatNumber(totals.kg, lang, 1)} unit={t("dashboard.unitKg")} notes={[[totals.avg_kg ? t("sp.k.avg", { kg: formatWeight(totals.avg_kg, lang) }) : "", "text-lp-ink-3"]]} />
                <Tile label={t("sp.k.deleted")} value={formatNumber(totals.deleted, lang)} unit={t("dashboard.unitPcs")} notes={[[totals.deleted ? t("sp.k.deletedNote", { pct: formatNumber(deletedPct, lang, 1), kg: formatNumber(totals.deleted_kg, lang, 1) }) : "", "text-lp-bad"]]} />
                <Tile label={stats.single_day ? t("sp.k.worked") : t("sp.k.workedAvg")} value={work.first ? minutesText(work.minutes, t) : "—"} unit=""
                    notes={[[work.first ? (stats.single_day ? (work.stopped_minutes
                        ? t("sp.k.workedDay", { from: timeOf(work.first, lang), to: work.until ? t("sp.work.now") : timeOf(work.last, lang), stops: minutesText(work.stopped_minutes, t) })
                        : t("sp.k.workedDayNoStops", { from: timeOf(work.first, lang), to: timeOf(work.last, lang) })) : t("sp.k.workedDays", { n: work.days_worked })) : t("sp.k.noWork"), "text-lp-ink-3"]]} />
            </div>

            <section className="lp-card flex flex-col gap-3 p-[18px]">
                <div className="flex items-baseline gap-2.5"><h3 className="m-0 text-[16px] font-extrabold">{stats.single_day ? t("sp.byHour") : t("sp.byDay")}</h3><span className="text-[13px] font-bold text-lp-ink-3">{periodLabel({ from: stats.from, to: stats.to }, lang)}</span></div>
                <div aria-hidden="true" className="flex h-[170px] items-end gap-[5px]">
                    {series.map((p) => (
                        <div key={p.label} title={`${p.label}: ${p.count}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                            {p.count > 0 && <b className="text-[10px] font-extrabold text-lp-ink-3">{p.count}</b>}
                            <span className={cx("w-[70%] min-h-[2px] rounded-t-[5px]", p.count ? "bg-lp-accent" : "bg-lp-off-bg")} style={{ height: `${Math.round((p.count / max) * 100)}%` }} />
                        </div>
                    ))}
                </div>
                <div aria-hidden="true" className="flex gap-[5px] text-[11px] font-bold text-lp-ink-3">
                    {series.map((p) => <span key={p.label} className="flex-1 truncate text-center">{stats.single_day ? p.label : parseDay(p.label).toLocaleDateString(lang, { day: "numeric", month: "numeric" })}</span>)}
                </div>
                {stats.single_day && work.first && <WorkLine work={work} t={t} lang={lang} />}
            </section>

            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                <section className="lp-card flex flex-col gap-2 p-[18px]">
                    <div className="flex items-baseline gap-2.5"><h3 className="m-0 text-[16px] font-extrabold">{t("sp.byProduct")}</h3><span className="text-[13px] font-bold text-lp-ink-3">{t("sp.byProductUnit")}</span></div>
                    {stats.products.length === 0 ? <p className="m-0 text-[14px] text-lp-ink-3">{t("sp.empty")}</p> : (
                        <table className="w-full border-collapse text-[14px]">
                            <thead><tr className="text-left text-[12px] text-lp-ink-3"><th className="py-2 font-extrabold">{t("sp.col.product")}</th><th className="py-2 text-right font-extrabold">{t("dashboard.unitPcs")}</th><th className="py-2 text-right font-extrabold">{t("dashboard.unitKg")}</th><th className="py-2 text-right font-extrabold">{t("sp.col.avg")}</th></tr></thead>
                            <tbody>
                                {stats.products.map((p) => (
                                    <tr key={p.name} className="border-t border-lp-line">
                                        <td className="py-2.5 pr-2">{p.name}<span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-lp-off-bg"><span className="block h-full rounded-full bg-lp-accent" style={{ width: `${Math.round((p.pcs / Math.max(1, stats.products[0].pcs)) * 100)}%` }} /></span></td>
                                        <td className="py-2.5 text-right tabular-nums">{formatNumber(p.pcs, lang)}</td>
                                        <td className="py-2.5 text-right tabular-nums">{formatNumber(p.kg, lang, 1)}</td>
                                        <td className="py-2.5 text-right tabular-nums">{formatWeight(p.avg_kg, lang)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>
                <section className="lp-card flex flex-col gap-2 p-[18px]">
                    {stats.operator_output && (<>
                    <div className="flex items-baseline gap-2.5"><h3 className="m-0 text-[16px] font-extrabold">{t("sp.byOperator")}</h3><span className="text-[13px] font-bold text-lp-ink-3">{stats.single_day ? t("sp.byOperatorDay") : t("sp.byOperatorPeriod")}</span></div>
                    {stats.operators.length === 0 ? <p className="m-0 text-[14px] text-lp-ink-3">{t("sp.empty")}</p> : (
                        <table className="w-full border-collapse text-[14px]">
                            <thead><tr className="text-left text-[12px] text-lp-ink-3"><th className="py-2 font-extrabold">{t("sp.col.operator")}</th><th className="py-2 text-right font-extrabold">{t("dashboard.unitPcs")}</th><th className="py-2 text-right font-extrabold">{t("dashboard.unitKg")}</th><th className="py-2 text-right font-extrabold">{stats.single_day ? t("sp.col.shift") : t("sp.col.days")}</th></tr></thead>
                            <tbody>
                                {stats.operators.map((o) => (
                                    <tr key={o.name} className="border-t border-lp-line">
                                        <td className="py-2.5 pr-2">{o.name}</td>
                                        <td className="py-2.5 text-right tabular-nums">{formatNumber(o.pcs, lang)}</td>
                                        <td className="py-2.5 text-right tabular-nums">{formatNumber(o.kg, lang, 1)}</td>
                                        <td className="py-2.5 text-right tabular-nums">{stats.single_day ? `${timeOf(o.first, lang)}–${timeOf(o.last, lang)}` : o.days}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    </>)}
                    <h3 className={cx("m-0 text-[16px] font-extrabold", stats.operator_output && "mt-3")}>{t("sp.jobs")}</h3>
                    {stats.jobs.length === 0 ? <p className="m-0 text-[14px] text-lp-ink-3">{t("sp.noJobs")}</p> : (
                        <table className="w-full border-collapse text-[14px]">
                            <tbody>
                                {stats.jobs.map((j) => (
                                    <tr key={j.id} className="border-t border-lp-line">
                                        <td className="py-2.5 pr-2">№{j.id} · {j.product}</td>
                                        <td className="py-2.5 text-right tabular-nums">{t("td.job", { done: formatNumber(j.printed, lang), total: formatNumber(j.quantity, lang), unit: j.unit === "kg" ? t("dashboard.unitKg") : t("dashboard.unitPcs") })}</td>
                                        <td className={cx("py-2.5 text-right text-[13px] font-bold", j.status === "error" ? "text-lp-bad" : j.status === "completed" ? "text-lp-ok" : "text-lp-ink-2")}>
                                            {j.status === "completed" ? t("sp.jobDone", { time: timeOf(j.completed_at, lang) }) : t(`dashboard.status${j.status.charAt(0).toUpperCase()}${j.status.slice(1)}`)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>
        </div>
    );
}

function Tile({ label, value, unit, notes }: { label: string; value: string; unit: string; notes: [string, string][] }) {
    return (
        <section className="lp-card flex min-w-0 flex-col gap-1.5 px-[18px] py-4">
            <span className="text-[13px] font-bold text-lp-ink-3">{label}</span>
            <span className="text-[30px] font-extrabold leading-none tabular-nums tracking-[-0.03em]">{value} {unit && <small className="text-[14px] font-bold tracking-normal text-lp-ink-3">{unit}</small>}</span>
            {notes.filter(([text]) => text).map(([text, tone]) => <span key={text} className={cx("text-[13px] font-bold", tone)}>{text}</span>)}
        </section>
    );
}

function WorkLine({ work, t, lang }: { work: StationStats["work"]; t: TFunc; lang: Lang }) {
    const start = new Date(work.first!).getTime();
    const end = new Date(work.until ?? work.last!).getTime();
    const span = Math.max(1, end - start);
    let cursor = start;
    const parts: { kind: "work" | "idle" | "fault"; width: number }[] = [];
    for (const stop of work.stops) {
        const a = new Date(stop.from).getTime();
        const b = new Date(stop.to).getTime();
        parts.push({ kind: "work", width: ((a - cursor) / span) * 100 });
        parts.push({ kind: stop.kind, width: ((b - a) / span) * 100 });
        cursor = b;
    }
    if (end > cursor) parts.push({ kind: "work", width: ((end - cursor) / span) * 100 });
    const color = { work: "bg-lp-ok", idle: "bg-lp-warn", fault: "bg-lp-bad" };
    return (
        <div className="mt-1.5 flex flex-col gap-2">
            <div className="flex items-baseline gap-2.5"><h4 className="m-0 text-[14px] font-extrabold">{t("sp.workTitle")}</h4><span className="text-[13px] font-bold text-lp-ink-3">{timeOf(work.first, lang)} — {work.until ? t("sp.work.now") : timeOf(work.last, lang)}</span></div>
            <div aria-hidden="true" className="flex h-4 overflow-hidden rounded-[6px] bg-lp-off-bg">
                {parts.map((p, i) => <span key={i} className={color[p.kind]} style={{ width: `${Math.max(0, p.width)}%` }} />)}
            </div>
            <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12px] font-bold text-lp-ink-2">
                <li className="flex items-center gap-1.5"><i aria-hidden="true" className="block h-2.5 w-2.5 rounded-[3px] bg-lp-ok" />{t("sp.work.printing", { time: minutesText(work.minutes, t) })}</li>
                {work.stops.map((s) => (
                    <li key={s.from} className="flex items-center gap-1.5">
                        <i aria-hidden="true" className={cx("block h-2.5 w-2.5 rounded-[3px]", color[s.kind])} />
                        {s.kind === "fault"
                            ? t("sp.work.fault", { reason: s.reason, from: timeOf(s.from, lang), to: s.ongoing ? t("sp.work.now") : timeOf(s.to, lang) })
                            : t("sp.work.idle", { from: timeOf(s.from, lang), to: s.ongoing ? t("sp.work.now") : timeOf(s.to, lang), time: minutesText(s.minutes, t) })}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Этикетки ────────────────────────────────────────────────────────────────

function LabelsTab({ station, period, t, lang }: { station: Station; period: Period; t: TFunc; lang: Lang }) {
    const [level, setLevel] = useState<LabelLevel>("pack");
    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");
    const [onlyDeleted, setOnlyDeleted] = useState(false);
    const [page, setPage] = useState<LabelPage | null>(null);
    const [rows, setRows] = useState<(PackRow | ContainerRow)[]>([]);
    const [loadingMore, setLoadingMore] = useState(false);
    useEffect(() => { const id = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(id); }, [query]);
    const load = useCallback(async (offset: number) => {
        const next = await productionApi.labels(station.station_uuid, period, { level, q: debounced, deleted: onlyDeleted, offset });
        setPage(next);
        setRows((prev) => (offset === 0 ? next.rows : [...prev, ...next.rows]));
    }, [station.station_uuid, period, level, debounced, onlyDeleted]);
    useEffect(() => { setPage(null); void load(0).catch(() => setRows([])); }, [load]);
    const levels: { key: LabelLevel; dot: string }[] = [{ key: "pack", dot: "bg-lp-t-pack" }, { key: "box", dot: "bg-lp-t-box" }, { key: "pallet", dot: "bg-lp-t-pallet" }];
    const csv = productionApi.labelsCsvUrl(station.station_uuid, period, { level, q: debounced, deleted: onlyDeleted });
    const head = level === "pack"
        ? ["time", "product", "net", "batch", "operator", "barcode", "box"]
        : level === "box" ? ["closed", "box", "product", "packs", "net", "gross", "pallet"] : ["closedF", "pallet", "products", "boxes", "packs", "net", "gross"];
    const right = new Set(["net", "gross", "packs", "boxes"]);
    return (
        <div className="flex flex-col gap-3">
            <div role="tablist" aria-label={t("sp.levels")} className="flex flex-wrap gap-1.5">
                {levels.map(({ key, dot }) => (
                    <button key={key} type="button" role="tab" aria-selected={level === key} onClick={() => { setLevel(key); setOnlyDeleted(false); }}
                        className={cx("flex min-h-[44px] items-center gap-2 rounded-[14px] border px-4 text-[14px] font-extrabold transition", level === key ? "border-lp-accent text-lp-ink ring-1 ring-inset ring-lp-accent" : "border-lp-line-2 bg-lp-surface text-lp-ink-2 hover:bg-lp-raised")}>
                        <i aria-hidden="true" className={cx("block h-2.5 w-2.5 rounded-[3px]", dot)} />{t(`sp.lvl.${key}`)}
                        <b className={cx("text-[13px] tabular-nums", level === key ? "text-lp-accent-ink" : "text-lp-ink-3")}>{page ? formatNumber(page.counts[key], lang) : "…"}</b>
                    </button>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex min-h-[42px] flex-[1_1_280px] items-center gap-2 rounded-[12px] bg-lp-surface px-3 text-lp-ink-3 shadow-sm ring-1 ring-lp-line">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-[18px] w-[18px]" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                    <span className="sr-only">{t("sp.search")}</span>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(`sp.searchHint.${level}`)} className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-lp-ink outline-none" />
                </label>
                {page && page.deleted + (onlyDeleted ? 0 : 0) > 0 && level !== "pallet" && (
                    <div className="flex gap-1.5">
                        <button type="button" aria-pressed={!onlyDeleted} onClick={() => setOnlyDeleted(false)} className={cx("min-h-[38px] rounded-full border px-3.5 text-[13px] font-extrabold", !onlyDeleted ? "border-lp-ink bg-lp-ink text-lp-surface" : "border-lp-line-2 bg-lp-surface text-lp-ink-2")}>{t("sp.all")}</button>
                        <button type="button" aria-pressed={onlyDeleted} onClick={() => setOnlyDeleted(true)} className={cx("min-h-[38px] rounded-full border px-3.5 text-[13px] font-extrabold", onlyDeleted ? "border-lp-bad bg-lp-bad text-[#fff]" : "border-lp-bad/40 bg-lp-bad-bg text-lp-bad")}>{t("sp.deleted", { n: page.deleted })}</button>
                    </div>
                )}
                <a href={csv} className={cx(linkButton, "ml-auto")}>{t("sp.csv")}</a>
            </div>
            <section className="lp-card overflow-x-auto px-3 pb-3 pt-1.5">
                {level !== "pack" && page && page.counts[level] === 0 && page.total === 0 ? (
                    <p className="m-0 px-2 py-6 text-center text-[14px] text-lp-ink-3">{t("sp.noContainers")}</p>
                ) : (
                    <table className="w-full min-w-[760px] border-collapse text-[14px]">
                        <thead><tr>{head.map((h) => <th key={h} className={cx("border-b border-lp-line-2 px-2.5 py-2 text-[12px] font-extrabold text-lp-ink-3", right.has(h) ? "text-right" : "text-left")}>{t(`sp.col.${h}`)}</th>)}</tr></thead>
                        <tbody>
                            {rows.map((row) => level === "pack" ? <PackLine key={row.id} row={row as PackRow} t={t} lang={lang} /> : <ContainerLine key={row.id} row={row as ContainerRow} level={level} t={t} lang={lang} />)}
                            {page && rows.length === 0 && <tr><td colSpan={head.length} className="px-2.5 py-6 text-center text-lp-ink-3">{t("sp.empty")}</td></tr>}
                        </tbody>
                    </table>
                )}
                {page && rows.length < page.total && (
                    <div className="flex justify-center pt-3">
                        <button type="button" disabled={loadingMore} onClick={async () => { setLoadingMore(true); try { await load(rows.length); } finally { setLoadingMore(false); } }} className={ghostButton}>
                            {t("sp.more50", { shown: rows.length, total: page.total })}
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}

const cell = "border-b border-lp-line px-2.5 py-2.5";

function DeletedBadge({ at, female, lang, t }: { at: string | null; female: boolean; lang: Lang; t: TFunc }) {
    return <span className="ml-2 inline-flex whitespace-nowrap rounded-full bg-lp-bad/15 px-2 py-0.5 text-[12px] font-extrabold text-lp-bad">{t(female ? "sp.deletedAtF" : "sp.deletedAtM", { time: timeOf(at, lang) })}</span>;
}

function PackLine({ row, t, lang }: { row: PackRow; t: TFunc; lang: Lang }) {
    const del = row.deleted;
    const tint = del ? "bg-lp-bad/[.07] text-lp-bad" : "";
    return (
        <tr className={tint}>
            <td className={cx(cell, "font-mono", del && "shadow-[inset_3px_0_0_rgb(var(--lp-bad))]")}>{timeOf(row.at, lang)}</td>
            <td className={cell}>{row.product}{del && <DeletedBadge at={row.deleted_at} female lang={lang} t={t} />}</td>
            <td className={cx(cell, "text-right tabular-nums")}>{formatWeight(row.kg, lang)}</td>
            <td className={cx(cell, "font-mono")}>{row.batch || "—"}</td>
            <td className={cell}>{row.operator || "—"}</td>
            <td className={cx(cell, "font-mono")}>{row.barcode || "—"}</td>
            <td className={cx(cell, "font-mono")}>{row.box || "—"}</td>
        </tr>
    );
}

function ContainerLine({ row, level, t, lang }: { row: ContainerRow; level: LabelLevel; t: TFunc; lang: Lang }) {
    const del = row.deleted;
    const open = !row.closed;
    const count = level === "box" ? row.packs : row.boxes;
    return (
        <tr className={del ? "bg-lp-bad/[.07] text-lp-bad" : ""}>
            <td className={cx(cell, "font-mono", del && "shadow-[inset_3px_0_0_rgb(var(--lp-bad))]")}>{open ? <span className="rounded-full bg-lp-accent-bg px-2 py-0.5 text-[12px] font-extrabold text-lp-accent-ink">{t(level === "box" ? "sp.openM" : "sp.openF")}</span> : timeOf(row.closed_at, lang)}</td>
            <td className={cx(cell, "font-mono")}>{row.number}</td>
            <td className={cell}>{row.product || "—"}{del && <DeletedBadge at={row.deleted_at} female={level === "pallet"} lang={lang} t={t} />}</td>
            {level === "box" ? (
                <td className={cx(cell, "text-right tabular-nums")}>{open && row.capacity ? t("sp.ofCapacity", { n: count, cap: row.capacity }) : count}</td>
            ) : (
                <>
                    <td className={cx(cell, "text-right tabular-nums")}>{open && row.capacity ? t("sp.ofCapacity", { n: count, cap: row.capacity }) : count}</td>
                    <td className={cx(cell, "text-right tabular-nums")}>{row.packs}</td>
                </>
            )}
            <td className={cx(cell, "text-right tabular-nums")}>{formatNumber(row.kg, lang, 2)}</td>
            <td className={cx(cell, "text-right tabular-nums")}>{formatNumber(row.gross_kg, lang, 2)}</td>
            {level === "box" && <td className={cx(cell, "font-mono")}>{row.pallet || "—"}</td>}
        </tr>
    );
}

// ─── Журнал ──────────────────────────────────────────────────────────────────

const LOG_TONE: Record<string, Tone> = { ERROR: "bad", CRITICAL: "bad", WARNING: "warn", WARN: "warn", INFO: "off" };

function JournalTab({ station, period, t, lang }: { station: Station; period: Period; t: TFunc; lang: Lang }) {
    const [kind, setKind] = useState("all");
    const [data, setData] = useState<{ counts: Record<string, number>; events: JournalEvent[] } | null>(null);
    useEffect(() => {
        let alive = true;
        setData(null);
        productionApi.journal(station.station_uuid, period, kind).then((d) => { if (alive) setData(d); }).catch(() => { if (alive) setData({ counts: {}, events: [] }); });
        return () => { alive = false; };
    }, [station.station_uuid, period, kind]);
    const kinds = ["all", "errors", "printer", "scale", "seat"];
    const single = period.from === period.to;
    return (
        <div className="flex flex-col gap-3">
            <div role="group" aria-label={t("sp.journalFilter")} className="flex flex-wrap gap-1.5">
                {kinds.map((k) => (
                    <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                        className={cx("min-h-[38px] rounded-full border px-3.5 text-[13px] font-extrabold", kind === k ? "border-lp-ink bg-lp-ink text-lp-surface" : "border-lp-line-2 bg-lp-surface text-lp-ink-2 hover:bg-lp-raised")}>
                        {t(`sp.j.${k}`)}{k !== "all" && data?.counts[k] ? ` ${data.counts[k]}` : ""}
                    </button>
                ))}
            </div>
            <section className="lp-card px-4 py-1.5">
                {data === null ? <p className="m-0 py-4 text-[14px] text-lp-ink-3">{t("dashboard.detailLoading")}</p>
                    : data.events.length === 0 ? <p className="m-0 py-4 text-[14px] text-lp-ink-3">{t("sp.j.empty")}</p>
                        : data.events.map((e, i) => {
                            const tone = e.component === "seat" ? "off" : LOG_TONE[e.level.toUpperCase()] ?? "off";
                            const title = e.component === "seat" ? t(`stp.j.${e.message}`) : e.message;
                            return (
                                <div key={`${e.at}-${i}`} className="grid grid-cols-[minmax(64px,auto)_14px_minmax(0,1fr)_auto] items-start gap-2.5 border-b border-lp-line py-3 text-[14px] last:border-0">
                                    <span className="font-mono text-[13px] text-lp-ink-3">{single ? timeOf(e.at, lang) : dateTimeOf(e.at, lang)}</span>
                                    <i aria-hidden="true" className={cx("mt-[5px] block h-2.5 w-2.5 rounded-full", tone === "off" ? "bg-lp-ink-3" : TONE_DOT[tone])} />
                                    <div className="flex min-w-0 flex-col gap-0.5"><b className={cx("break-words font-bold", tone === "bad" && "text-lp-bad")}>{title}</b>{e.component === "seat" && <span className="text-[13px] text-lp-ink-2">{e.actor || t("stp.j.system")}</span>}</div>
                                    <span className="rounded-[8px] bg-lp-off-bg px-2 py-0.5 text-[12px] font-extrabold text-lp-ink-3">{t(`sp.c.${e.component}`) === `sp.c.${e.component}` ? e.component : t(`sp.c.${e.component}`)}</span>
                                </div>
                            );
                        })}
            </section>
        </div>
    );
}
