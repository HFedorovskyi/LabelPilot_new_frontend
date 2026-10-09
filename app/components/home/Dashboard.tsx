"use client";

// «Сегодня»: how the shift is going right now (canvas «LabelPilot Server — редизайн», board
// «Сегодня v3»). One status strip with what needs a decision, three summary tiles, a tile per
// line (state, product, job progress, rate, today's output; compact tiles and a filter when
// there are many lines), output by hour and by product. A line opens its panel; its page has
// the rest. A server that is not set up yet sees the steps to its first label instead.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { productionApi, type TodayData, type TodayLine, type PackRow } from "@/lib/api/production";
import { useTranslation, type Lang } from "@/lib/i18n";
import { stationProblem, type Station, type StationProblem } from "@/lib/stations";
import Portal from "../Portal";
import type { NavKey } from "../shell/Sidebar";
import PageTitle from "../shell/PageTitle";
import { cx, formatNumber, formatWeight, Icon, TONE_DOT, TONE_INK, TONE_SOFT, type Tone } from "../stations/shared";

type TFunc = (key: string, params?: Record<string, string | number | undefined>) => string;

const REFRESH_MS = 30_000;
/** A line that printed within this many minutes is printing; after that it is standing. */
const PRINTING_WITHIN_MIN = 10;
/** More lines than this switch to compact tiles with a filter. */
const MANY_LINES = 8;

const linkButton = "border-0 bg-transparent p-0 text-[14px] font-extrabold text-lp-accent-ink hover:underline";
const ghostButton = "min-h-[40px] rounded-[11px] border border-lp-line-2 bg-lp-surface px-3.5 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised";

type LineKind = "printing" | "stopped" | "idle" | "offline" | "fault" | "blocked";
type Line = TodayLine & { station: Station | null; problem: StationProblem | null; kind: LineKind; tone: Tone; state: string };

function minutesSince(iso: string | null, now: number) {
    return iso ? Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000)) : Infinity;
}

function durationText(minutes: number, t: TFunc) {
    if (minutes < 60) return t("td.min", { n: minutes });
    if (minutes >= 48 * 60) return t("stp.days", { n: Math.round(minutes / 1440) });
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? t("td.hMin", { h, m }) : t("td.h", { h });
}

function timeOf(iso: string | null | undefined, lang: Lang) {
    return iso ? new Date(iso).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" }) : "—";
}

function classify(raw: TodayLine, station: Station | null, now: number, t: TFunc): Line {
    const problem = station ? stationProblem(station) : null;
    const since = minutesSince(raw.last_at, now);
    let kind: LineKind;
    let state: string;
    if (problem && problem !== "offline") {
        kind = "blocked";
        state = t(`stp.p.${problem}.label`, { duration: "" }).trim();
    } else if (problem === "offline" || !raw.online) {
        kind = "offline";
        state = t("td.st.offline", { duration: durationText(minutesSince(raw.seen_at, now), t) });
    } else if (raw.fault) {
        kind = "fault";
        state = raw.fault.message;
    } else if (since <= PRINTING_WITHIN_MIN) {
        kind = "printing";
        state = t("td.st.printing");
    } else if (raw.labels > 0) {
        kind = "stopped";
        state = t("td.st.stopped", { duration: durationText(since, t) });
    } else {
        kind = "idle";
        state = t("td.st.notToday");
    }
    const tone: Tone = kind === "printing" ? "ok" : kind === "fault" || kind === "blocked" ? "bad" : kind === "offline" ? "warn" : "off";
    return { ...raw, station, problem, kind, tone, state };
}

const needsAttention = (line: Line) => line.kind === "fault" || line.kind === "offline" || line.kind === "blocked";

function whyText(line: Line, t: TFunc) {
    if (line.kind === "fault") return t(line.fault?.component === "scale" ? "td.fix.scale" : "td.fix.printer");
    if (line.problem) return t(`stp.p.${line.problem}.why`);
    return "";
}

export default function Dashboard({ onNavigate, onOpenStation }: { onNavigate?: (key: NavKey) => void; onOpenStation?: (uuid: string) => void }) {
    const { t, lang } = useTranslation();
    const [data, setData] = useState<TodayData | null>(null);
    const [stations, setStations] = useState<Station[]>([]);
    const [error, setError] = useState("");
    const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
    const [chart, setChart] = useState<"day" | "week">("day");
    const [filter, setFilter] = useState<"all" | "attn" | "ok" | "idle">("all");
    const [panel, setPanel] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [today, list] = await Promise.all([productionApi.today(), api.stations.list().catch(() => [] as Station[])]);
            setData(today);
            setStations(list);
            setError("");
            setFetchedAt(new Date());
        } catch (e) {
            setError(e instanceof Error ? e.message : t("dashboard.statsLoadError"));
        }
    }, [t]);

    useEffect(() => {
        void load();
        const id = setInterval(load, REFRESH_MS);
        return () => clearInterval(id);
    }, [load]);

    const now = fetchedAt?.getTime() ?? 0;
    const lines = useMemo<Line[]>(() => {
        if (!data) return [];
        const byUuid = new Map(stations.map((s) => [s.station_uuid, s]));
        const order: Record<LineKind, number> = { fault: 0, blocked: 1, offline: 2, printing: 3, stopped: 4, idle: 5 };
        return data.stations
            .map((raw) => classify(raw, byUuid.get(raw.uuid) ?? null, now, t))
            .sort((a, b) => order[a.kind] - order[b.kind] || b.labels - a.labels);
    }, [data, stations, now, t]);

    if (!data) {
        return error
            ? <p className="m-0 rounded-[14px] bg-lp-bad-bg px-4 py-3 text-[14px] font-bold text-lp-bad">■ {error}</p>
            : <p className="m-0 text-[14px] text-lp-ink-3">{t("dashboard.detailLoading")}</p>;
    }

    const go = (key: NavKey) => onNavigate?.(key);
    const setupIncomplete = data.setup.products === 0 || data.setup.stations === 0;
    const date = new Date();

    return (
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5">
            <PageTitle
                icon="home"
                eyebrow={<>{date.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })}{fetchedAt ? ` · ${t("today.updatedAt", { time: timeOf(fetchedAt.toISOString(), lang) })}` : ""}</>}
                title={t("today.title")}
                description={t("nav.homeDesc")}
            >
                <button type="button" onClick={() => go("print_tasks")} className="flex min-h-[44px] items-center gap-2 rounded-[11px] lp-btn-primary px-[18px] text-[14px] font-extrabold text-[#fff] transition hover:brightness-110">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    {t("td.newJob")}
                </button>
            </PageTitle>

            {error && <p className="m-0 rounded-[12px] bg-lp-warn-bg px-4 py-2.5 text-[14px] font-bold text-lp-warn">▲ {error}</p>}

            {setupIncomplete ? (
                <SetupCard data={data} t={t} go={go} lang={lang} />
            ) : (
                <>
                    <StatusStrip lines={lines} data={data} t={t} go={go} openLine={setPanel} />
                    <SummaryTiles data={data} lines={lines} t={t} lang={lang} go={go} />
                    <LinesSection lines={lines} filter={filter} setFilter={setFilter} openLine={setPanel} t={t} lang={lang} go={go} />
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                        <HourlyCard data={data} mode={chart} setMode={setChart} t={t} lang={lang} />
                        <ProductsCard data={data} t={t} lang={lang} go={go} />
                    </div>
                </>
            )}

            {panel && (() => {
                const line = lines.find((l) => l.uuid === panel);
                return line ? <LinePanel line={line} t={t} lang={lang} onClose={() => setPanel(null)} onOpenStation={onOpenStation} /> : null;
            })()}
        </div>
    );
}

// ─── New install: the steps to the first label ───────────────────────────────

function SetupCard({ data, t, go, lang }: { data: TodayData; t: TFunc; go: (key: NavKey) => void; lang: Lang }) {
    const steps = [
        { done: data.setup.products > 0, title: t("today.stepProducts"), text: data.setup.products > 0 ? t("today.stepProductsOk", { n: formatNumber(data.setup.products, lang) }) : t("today.stepProductsEmpty"), action: t("today.openProducts"), to: "catalog" as NavKey },
        { done: data.setup.products > 0 && data.setup.products_without_template === 0, title: t("today.stepTemplates"), text: data.setup.products_without_template > 0 ? t("today.stepTemplatesMissing", { n: formatNumber(data.setup.products_without_template, lang) }) : t("td.setup.templatesOk"), action: t("today.openTemplates"), to: "labels" as NavKey },
        { done: data.setup.stations > 0, title: t("td.setup.station"), text: t("td.setup.stationText"), action: t("td.setup.connect"), to: "stations" as NavKey },
        { done: false, title: t("td.setup.first"), text: t("td.setup.firstText"), action: t("today.openPrint"), to: "print_tasks" as NavKey },
    ];
    return (
        <section aria-labelledby="setup-title" className="lp-card flex flex-col gap-4 p-[22px]">
            <div className="flex flex-col gap-1">
                <h2 id="setup-title" className="m-0 text-[20px] font-extrabold">{t("td.setup.title")}</h2>
                <span className="text-[14px] text-lp-ink-2">{t("td.setup.lead")}</span>
            </div>
            <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3 p-0">
                {steps.map((step, i) => (
                    <li key={step.title} className="flex items-start gap-3 rounded-[16px] border border-lp-line bg-lp-raised p-3.5">
                        <span className={cx("flex h-8 w-8 flex-none items-center justify-center rounded-full text-[14px] font-extrabold", step.done ? "bg-lp-ok-bg text-lp-ok" : "bg-lp-accent-bg text-lp-accent-ink")}>{step.done ? "✓" : i + 1}</span>
                        <div className="flex min-w-0 flex-col gap-1">
                            <b className="text-[14px]">{step.title}</b>
                            <span className="text-[13px] text-lp-ink-2">{step.text}</span>
                            {!step.done && <button type="button" onClick={() => go(step.to)} className={cx(linkButton, "self-start text-[13px]")}>{step.action}</button>}
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}

// ─── One strip: all fine, or what needs a decision ───────────────────────────

function StatusStrip({ lines, data, t, go, openLine }: { lines: Line[]; data: TodayData; t: TFunc; go: (key: NavKey) => void; openLine: (uuid: string) => void }) {
    type Issue = { key: string; tone: Tone; title: string; why: string; action: string; run: () => void };
    const issues: Issue[] = [
        ...lines.filter(needsAttention).map((line) => ({
            key: line.uuid, tone: line.tone, title: `${line.name} — ${line.state}`,
            why: line.kind === "offline" ? t("stp.p.offline.why") : whyText(line, t),
            action: t("td.details"), run: () => openLine(line.uuid),
        })),
        ...data.jobs.failed.map((job) => ({
            key: `job-${job.id}`, tone: "bad" as Tone, title: t("td.att.job", { id: job.id, product: job.product }),
            why: job.error || t("today.att.jobWhy"), action: t("today.openPrint"), run: () => go("print_tasks"),
        })),
        ...(data.setup.products_without_template > 0 ? [{
            key: "tpl", tone: "warn" as Tone, title: t("today.att.template", { n: data.setup.products_without_template }),
            why: t("today.att.templateWhy"), action: t("today.assignTemplates"), run: () => go("catalog"),
        }] : []),
    ];
    const printing = lines.filter((l) => l.kind === "printing").length;
    const shown = issues.slice(0, 3);
    const bad = issues.some((i) => i.tone === "bad");
    return (
        <section aria-labelledby="strip-title" className="lp-card overflow-hidden">
            <div className="flex items-center gap-3.5 px-[18px] py-4">
                <span className={cx("flex h-11 w-11 flex-none items-center justify-center rounded-[14px]", issues.length === 0 ? "bg-lp-ok-bg text-lp-ok" : bad ? "bg-lp-bad-bg text-lp-bad" : "bg-lp-warn-bg text-lp-warn")}>
                    {issues.length === 0
                        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true"><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <h2 id="strip-title" className="m-0 text-[17px] font-extrabold">{issues.length === 0 ? t("td.allOk") : t("td.issues", { n: issues.length })}</h2>
                    <span className="text-[14px] text-lp-ink-2">{issues.length === 0 ? t("td.allOkSub", { n: printing, total: lines.length }) : t("td.issuesSub")}</span>
                </div>
            </div>
            {shown.map((issue) => (
                <div key={issue.key} className="flex flex-wrap items-center gap-3.5 border-t border-lp-line px-[18px] py-3">
                    <span aria-hidden="true" className={cx("h-2.5 w-2.5 flex-none rounded-full", TONE_DOT[issue.tone])} />
                    <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
                        <span className="text-[14px] font-extrabold">{issue.title}</span>
                        <span className="text-[13px] text-lp-ink-2">{issue.why}</span>
                    </div>
                    <button type="button" onClick={issue.run} className={ghostButton}>{issue.action}</button>
                </div>
            ))}
            {issues.length > shown.length && (
                <p className="m-0 border-t border-lp-line px-[18px] py-2.5 text-[13px] text-lp-ink-3">{t("today.moreAttention", { n: issues.length - shown.length })}</p>
            )}
        </section>
    );
}

// ─── Three tiles ─────────────────────────────────────────────────────────────

function SummaryTiles({ data, lines, t, lang, go }: { data: TodayData; lines: Line[]; t: TFunc; lang: Lang; go: (key: NavKey) => void }) {
    const { totals } = data;
    const nowHour = new Date(data.now).getHours();
    const hours = data.hourly.slice(0, nowHour + 1);
    const firstHour = Math.max(0, hours.findIndex((v) => v > 0));
    const bars = hours.slice(firstHour === -1 ? 0 : firstHour);
    const maxBar = Math.max(1, ...bars);
    let delta = t("td.sameAsYesterday");
    let deltaTone = "text-lp-ink-3";
    if (totals.yesterday_same_time > 0 && totals.labels !== totals.yesterday_same_time) {
        const pct = Math.round(((totals.labels - totals.yesterday_same_time) / totals.yesterday_same_time) * 100);
        delta = t("td.vsYesterday", { pct: `${pct > 0 ? "+" : ""}${pct} %`, time: timeOf(data.now, lang) });
        deltaTone = pct >= 0 ? "text-lp-ok" : "text-lp-ink-3";
    } else if (totals.yesterday_same_time === 0) {
        delta = t("td.noneYesterday");
    }
    const count = (kind: LineKind | LineKind[]) => lines.filter((l) => ([] as LineKind[]).concat(kind).includes(l.kind)).length;
    const printing = count("printing");
    const notes = [
        [count(["fault", "blocked"]), "td.note.problem"], [count("offline"), "td.note.offline"],
        [count("stopped"), "td.note.stopped"], [count("idle"), "td.note.idle"],
    ].filter(([n]) => (n as number) > 0).map(([n, key]) => t(key as string, { n: n as number }));
    const jobsPct = data.jobs.percent;
    return (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-label={t("td.out")} className="lp-card flex min-w-0 flex-col gap-1.5 p-[18px]">
                <span className="text-[13px] font-bold text-lp-ink-3">{t("td.out")}</span>
                <span className="text-[34px] font-extrabold leading-none tabular-nums tracking-[-0.03em]">{formatNumber(totals.labels, lang)} <small className="text-[15px] font-bold tracking-normal text-lp-ink-3">{t("dashboard.unitPcs")}</small></span>
                <span className="text-[14px] font-bold text-lp-ink-2">{t("td.netKg", { kg: formatNumber(totals.kg, lang, 1) })}</span>
                <div aria-hidden="true" className="mt-1 flex h-[38px] items-end gap-[3px]">
                    {bars.map((v, i) => (
                        <span key={i} className={cx("min-h-[2px] flex-1 rounded-t-[3px]", i === bars.length - 1 ? "bg-lp-accent" : "bg-lp-accent/35")} style={{ height: `${Math.max(6, Math.round((v / maxBar) * 100))}%` }} />
                    ))}
                </div>
                <span className={cx("text-[13px] font-bold", deltaTone)}>{delta}</span>
                {totals.deleted > 0 && <span className="text-[12px] text-lp-ink-3">{t("td.deletedNote", { n: formatNumber(totals.deleted, lang), kg: formatNumber(totals.deleted_kg, lang, 1) })}</span>}
            </section>
            <section aria-label={t("td.lines")} className="lp-card flex min-w-0 flex-col gap-1.5 p-[18px]">
                <span className="text-[13px] font-bold text-lp-ink-3">{t("td.lines")}</span>
                <span className="text-[34px] font-extrabold leading-none tabular-nums tracking-[-0.03em]">{t("td.linesOf", { n: printing, total: lines.length })} <small className="text-[15px] font-bold tracking-normal text-lp-ink-3">{t("td.linesPrinting")}</small></span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                    {lines.map((line) => (
                        <span key={line.uuid} title={`${line.name}: ${line.state}`} className="flex items-center gap-1.5 text-[12px] font-bold text-lp-ink-2">
                            <i aria-hidden="true" className={cx("block h-3 w-3 rounded-full", TONE_DOT[line.tone])} />
                            {lines.length <= MANY_LINES ? line.name : null}
                        </span>
                    ))}
                </div>
                {notes.length > 0 && <span className="text-[13px] font-bold text-lp-ink-3">{notes.join(" · ")}</span>}
            </section>
            <section aria-label={t("td.jobs")} className="lp-card flex min-w-0 flex-col gap-1.5 p-[18px]">
                <span className="text-[13px] font-bold text-lp-ink-3">{t("td.jobs")}</span>
                {jobsPct == null ? (
                    <span className="text-[15px] font-bold text-lp-ink-2">{t("td.jobsNone")}</span>
                ) : (
                    <>
                        <span className="text-[34px] font-extrabold leading-none tabular-nums tracking-[-0.03em]">{jobsPct}<small className="text-[15px] font-bold tracking-normal text-lp-ink-3"> {t("td.jobsPct")}</small></span>
                        <div aria-hidden="true" className="my-1.5 h-2.5 overflow-hidden rounded-full bg-lp-off-bg"><span className="block h-full rounded-full bg-lp-accent" style={{ width: `${jobsPct}%` }} /></div>
                        <span className="text-[14px] font-bold text-lp-ink-2">{t("td.jobsLine", { a: data.jobs.in_progress, b: data.jobs.waiting, c: data.jobs.done })}</span>
                    </>
                )}
                <button type="button" onClick={() => go("print_tasks")} className={cx(linkButton, "self-start")}>{t("td.allJobs")}</button>
            </section>
        </div>
    );
}

// ─── Lines ───────────────────────────────────────────────────────────────────

function LinesSection({ lines, filter, setFilter, openLine, t, lang, go }: {
    lines: Line[]; filter: "all" | "attn" | "ok" | "idle"; setFilter: (f: "all" | "attn" | "ok" | "idle") => void;
    openLine: (uuid: string) => void; t: TFunc; lang: Lang; go: (key: NavKey) => void;
}) {
    const many = lines.length > MANY_LINES;
    const attention = lines.filter(needsAttention);
    const rest = lines.filter((l) => !needsAttention(l));
    const idle = lines.filter((l) => l.kind === "stopped" || l.kind === "idle");
    const chips: { key: typeof filter; label: string; dot: string }[] = [
        { key: "all", label: t("td.f.all", { n: lines.length }), dot: "bg-lp-ink-3" },
        { key: "attn", label: t("td.f.attn", { n: attention.length }), dot: "bg-lp-bad" },
        { key: "ok", label: t("td.f.ok", { n: lines.filter((l) => l.kind === "printing").length }), dot: "bg-lp-ok" },
        { key: "idle", label: t("td.f.idle", { n: idle.length }), dot: "bg-lp-off" },
    ];
    const big = !many ? lines : filter === "all" || filter === "attn" ? attention : [];
    const compact = !many ? [] : filter === "all" ? rest : filter === "ok" ? lines.filter((l) => l.kind === "printing") : filter === "idle" ? idle : [];
    return (
        <section aria-labelledby="lines-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-2.5">
                <h2 id="lines-title" className="m-0 text-[20px] font-extrabold tracking-[-0.01em]">{t("td.linesTitle")}</h2>
                <span className="text-[14px] text-lp-ink-3">{t("td.linesHint")}</span>
                <button type="button" onClick={() => go("stations")} className={cx(linkButton, "ml-auto")}>{t("today.allStations")}</button>
            </div>
            {lines.length === 0 && <p className="m-0 lp-card px-5 py-6 text-center text-[14px] text-lp-ink-3">{t("dashboard.noStations")}</p>}
            {many && (
                <div role="group" aria-label={t("td.f.label")} className="flex flex-wrap gap-2">
                    {chips.map((chip) => (
                        <button key={chip.key} type="button" aria-pressed={filter === chip.key} onClick={() => setFilter(chip.key)}
                            className={cx("flex min-h-[38px] items-center gap-2 rounded-full border px-3.5 text-[13px] font-extrabold transition",
                                filter === chip.key ? "border-lp-ink bg-lp-ink text-lp-surface" : "border-lp-line-2 bg-lp-surface text-lp-ink-2 hover:bg-lp-raised")}>
                            <i aria-hidden="true" className={cx("block h-2 w-2 rounded-full", chip.dot)} />{chip.label}
                        </button>
                    ))}
                </div>
            )}
            {big.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(310px,100%),1fr))] gap-3.5">
                    {big.map((line) => <LineTile key={line.uuid} line={line} t={t} lang={lang} onOpen={() => openLine(line.uuid)} />)}
                </div>
            )}
            {compact.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(230px,100%),1fr))] gap-2.5">
                    {compact.map((line) => <MiniTile key={line.uuid} line={line} t={t} lang={lang} onOpen={() => openLine(line.uuid)} />)}
                </div>
            )}
        </section>
    );
}

function jobText(line: Line, t: TFunc, lang: Lang) {
    const job = line.job;
    if (!job) return "";
    const unit = job.unit === "kg" ? t("dashboard.unitKg") : t("dashboard.unitPcs");
    return t("td.job", { done: formatNumber(job.printed, lang), total: formatNumber(job.quantity, lang), unit });
}

function etaText(line: Line, t: TFunc) {
    if (line.kind === "fault") return t("td.paused");
    if (line.kind === "offline") return t("td.etaWait");
    if (line.job?.eta_minutes == null) return "";
    return t("td.eta", { time: durationText(line.job.eta_minutes, t) });
}

/** Labels per hour: the last 8 hours on a tile; the whole day so far, full width, in the panel. */
function Spark({ values, tone, height = 22, wide = false }: { values: number[]; tone: Tone; height?: number; wide?: boolean }) {
    const nowHour = new Date().getHours();
    const first = wide ? Math.max(0, Math.min(nowHour, values.findIndex((v) => v > 0))) : Math.max(0, nowHour - 7);
    const slice = values.slice(first, nowHour + 1);
    const max = Math.max(1, ...slice);
    // The panel's day chart is history, not state: a fault now does not paint the morning red.
    const fill = wide ? "bg-lp-accent" : TONE_DOT[tone === "off" ? "ok" : tone];
    const bar = (v: number) => cx("min-h-[2px] rounded-[2px]", wide ? "flex-1" : "w-[5px]", v ? fill : "bg-lp-off-bg");
    return (
        <span aria-hidden="true" className={cx("flex flex-col gap-1", wide && "w-full")}>
            <span className={cx("flex items-end", wide ? "gap-1" : "gap-[2px]")} style={{ height }}>
                {slice.map((v, i) => <span key={i} title={`${String(first + i).padStart(2, "0")}: ${v}`} className={bar(v)} style={{ height: `${Math.round((v / max) * 100)}%` }} />)}
            </span>
            {wide && (
                <span className="flex gap-1 text-[10px] font-bold text-lp-ink-3">
                    {slice.map((_, i) => <span key={i} className="flex-1 text-center">{(first + i) % 2 === 0 ? String(first + i).padStart(2, "0") : ""}</span>)}
                </span>
            )}
        </span>
    );
}

function LineTile({ line, t, lang, onOpen }: { line: Line; t: TFunc; lang: Lang; onOpen: () => void }) {
    const job = line.job;
    const pct = job && job.quantity ? Math.min(100, Math.round((job.printed / job.quantity) * 100)) : 0;
    const why = line.kind === "fault" || line.kind === "offline" || line.kind === "blocked" ? (line.kind === "offline" ? t("td.offlineShort") : whyText(line, t)) : "";
    return (
        <button type="button" onClick={onOpen} aria-label={t("td.lineAria", { name: line.name, state: line.state })}
            className={cx("flex flex-col gap-2.5 rounded-[22px] border bg-lp-surface p-4 text-left shadow-[var(--lp-shadow,0_18px_40px_-26px_rgba(16,24,40,.32))] transition hover:-translate-y-px",
                line.tone === "bad" ? "border-lp-bad/45" : line.tone === "warn" ? "border-lp-warn/50" : "border-transparent lp-card")}>
            <div className="flex items-center gap-2.5">
                <span className={cx("flex h-9 w-9 flex-none items-center justify-center rounded-[12px]", TONE_SOFT[line.tone], TONE_INK[line.tone])}>
                    <Icon name={line.kind === "offline" ? "offline" : line.kind === "blocked" && line.problem ? line.problem : "station"} className="h-5 w-5" />
                </span>
                <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[16px] font-extrabold">{line.name}</span>
                    <span className={cx("truncate text-[13px] font-bold", line.tone === "off" ? "text-lp-ink-3" : TONE_INK[line.tone])}>{line.state}</span>
                </div>
                {line.operator && <span className="ml-auto truncate text-right text-[12px] font-bold text-lp-ink-3">{line.operator}</span>}
            </div>
            <span className="text-[15px] font-extrabold leading-snug">{line.job?.product || line.last_product || "—"}</span>
            {job ? (
                <>
                    <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-lp-off-bg"><span className="block h-full rounded-full bg-lp-accent" style={{ width: `${pct}%` }} /></span>
                    <span className="flex justify-between gap-2 text-[13px] font-bold text-lp-ink-2"><span>{jobText(line, t, lang)}</span><span>{etaText(line, t)}</span></span>
                </>
            ) : (
                <span className="text-[13px] text-lp-ink-3">{line.labels > 0 ? t("td.noJob") : t("td.noJobIdle")}</span>
            )}
            {why && <span className="text-[13px] font-bold text-lp-ink-2">{why}</span>}
            <div className="flex items-end gap-2.5 border-t border-lp-line pt-2">
                <div className="flex flex-1 flex-col">
                    <b className="text-[17px] font-extrabold tabular-nums">{t("td.todayOut", { pcs: formatNumber(line.labels, lang), kg: formatNumber(line.kg, lang, 1) })}</b>
                    <span className="text-[12px] font-bold text-lp-ink-3">{line.last_at ? t("td.todaySub", { time: timeOf(line.last_at, lang) }) : t("td.todaySubNone")}</span>
                </div>
                <div className="flex flex-col items-end gap-1 text-[12px] font-extrabold text-lp-ink-2">
                    <span>{line.rate > 0 && line.kind !== "offline" ? t("td.rate", { n: line.rate }) : ""}</span>
                    <Spark values={line.hourly} tone={line.tone} />
                </div>
            </div>
        </button>
    );
}

function MiniTile({ line, t, lang, onOpen }: { line: Line; t: TFunc; lang: Lang; onOpen: () => void }) {
    const job = line.job;
    const pct = job && job.quantity ? Math.min(100, Math.round((job.printed / job.quantity) * 100)) : 0;
    return (
        <button type="button" onClick={onOpen} aria-label={t("td.lineAria", { name: line.name, state: line.state })}
            className="lp-card flex flex-col gap-1.5 rounded-[16px] px-3.5 py-3 text-left transition hover:-translate-y-px">
            <span className="flex items-center gap-2">
                <i aria-hidden="true" className={cx("block h-2.5 w-2.5 flex-none rounded-full", TONE_DOT[line.tone])} />
                <b className="truncate text-[14px] font-extrabold">{line.name}</b>
                <span className="ml-auto text-[13px] font-extrabold tabular-nums text-lp-ink-2">{formatNumber(line.labels, lang)} {t("dashboard.unitPcs")}</span>
            </span>
            <span className="truncate text-[13px] font-bold text-lp-ink-2">{line.job?.product || line.last_product || "—"}</span>
            {job && <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-lp-off-bg"><span className="block h-full rounded-full bg-lp-accent" style={{ width: `${pct}%` }} /></span>}
            <span className="flex justify-between gap-2 text-[12px] font-bold text-lp-ink-3">
                <span className="truncate">{job ? jobText(line, t, lang) : line.state}</span>
                <span>{line.kind === "printing" ? t("td.rate", { n: line.rate }) : ""}</span>
            </span>
        </button>
    );
}

// ─── Output by hour / by day, and by product ─────────────────────────────────

function HourlyCard({ data, mode, setMode, t, lang }: { data: TodayData; mode: "day" | "week"; setMode: (m: "day" | "week") => void; t: TFunc; lang: Lang }) {
    const nowHour = new Date(data.now).getHours();
    let cols: { label: string; now: number; prev: number }[];
    if (mode === "day") {
        const active = data.hourly.map((v, h) => v + data.hourly_yesterday[h]);
        const first = Math.max(0, Math.min(active.findIndex((v) => v > 0), nowHour));
        const last = Math.max(nowHour, 23 - [...active].reverse().findIndex((v) => v > 0));
        cols = Array.from({ length: Math.max(1, last - first + 1) }, (_, i) => first + i)
            .map((h) => ({ label: String(h).padStart(2, "0"), now: h <= nowHour ? data.hourly[h] : 0, prev: data.hourly_yesterday[h] }));
    } else {
        cols = data.week.map((d) => ({ label: new Date(`${d.date}T12:00:00`).toLocaleDateString(lang, { weekday: "short", day: "numeric" }), now: d.count, prev: d.previous }));
    }
    const max = Math.max(1, ...cols.flatMap((c) => [c.now, c.prev]));
    return (
        <section aria-labelledby="hourly-title" className="lp-card flex flex-col gap-3 p-[18px]">
            <div className="flex flex-wrap items-center gap-2.5">
                <h3 id="hourly-title" className="m-0 text-[16px] font-extrabold">{mode === "day" ? t("td.hourly") : t("td.daily")}</h3>
                <div role="tablist" aria-label={t("td.hourly")} className="ml-auto flex gap-1 rounded-[11px] bg-lp-bg p-[3px]">
                    {(["day", "week"] as const).map((m) => (
                        <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                            className={cx("min-h-9 rounded-[9px] px-3 text-[13px] font-extrabold transition", mode === m ? "bg-lp-surface text-lp-ink shadow-sm" : "text-lp-ink-3 hover:text-lp-ink")}>
                            {m === "day" ? t("td.tabToday") : t("td.tabWeek")}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex gap-3.5 text-[12px] font-bold text-lp-ink-2">
                <span className="flex items-center gap-1.5"><i aria-hidden="true" className="block h-2.5 w-2.5 rounded-[3px] bg-lp-accent" />{mode === "day" ? t("td.legendToday") : t("td.legendWeek")}</span>
                <span className="flex items-center gap-1.5"><i aria-hidden="true" className="block h-2.5 w-2.5 rounded-[3px] bg-lp-off-bg ring-1 ring-lp-line-2" />{mode === "day" ? t("td.legendYesterday") : t("td.legendPrevWeek")}</span>
            </div>
            <div aria-hidden="true" className="flex h-[150px] items-end gap-1.5">
                {cols.map((c, i) => (
                    <div key={i} title={`${c.label}: ${c.now} / ${c.prev}`} className="flex h-full flex-1 items-end justify-center gap-[2px]">
                        <span className="min-h-[2px] w-[42%] rounded-t-[4px] bg-lp-off-bg" style={{ height: `${Math.round((c.prev / max) * 100)}%` }} />
                        <span className="min-h-[2px] w-[42%] rounded-t-[4px] bg-lp-accent" style={{ height: `${Math.round((c.now / max) * 100)}%` }} />
                    </div>
                ))}
            </div>
            <div aria-hidden="true" className="flex gap-1.5 text-[11px] font-bold text-lp-ink-3">
                {cols.map((c, i) => <span key={i} className="flex-1 truncate text-center">{c.label}</span>)}
            </div>
            <p className="sr-only">{t("td.chartSr", { now: cols.reduce((s, c) => s + c.now, 0), prev: cols.reduce((s, c) => s + c.prev, 0) })}</p>
        </section>
    );
}

function ProductsCard({ data, t, lang, go }: { data: TodayData; t: TFunc; lang: Lang; go: (key: NavKey) => void }) {
    const top = data.products.slice(0, 6);
    const max = Math.max(1, ...top.map((p) => p.pcs));
    return (
        <section aria-labelledby="products-title" className="lp-card flex flex-col gap-3 p-[18px]">
            <div className="flex items-center gap-2.5">
                <h3 id="products-title" className="m-0 text-[16px] font-extrabold">{t("td.products")}</h3>
                <span className="ml-auto text-[13px] font-bold text-lp-ink-3">{t("td.productsUnit")}</span>
            </div>
            {top.length === 0 ? (
                <p className="m-0 text-[14px] text-lp-ink-3">{t("td.noProducts")}</p>
            ) : top.map((p) => (
                <div key={p.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                    <span className="truncate text-[14px] font-bold">{p.name}</span>
                    <span className="text-right text-[13px] font-extrabold tabular-nums text-lp-ink-2">{formatNumber(p.pcs, lang)} · {formatNumber(p.kg, lang, 1)} {t("dashboard.unitKg")}</span>
                    <span aria-hidden="true" className="col-span-2 h-1.5 overflow-hidden rounded-full bg-lp-off-bg"><span className="block h-full rounded-full bg-lp-coral" style={{ width: `${Math.round((p.pcs / max) * 100)}%` }} /></span>
                </div>
            ))}
            {data.products.length > top.length && <span className="text-[13px] text-lp-ink-3">{t("td.moreProducts", { n: data.products.length - top.length })}</span>}
            <button type="button" onClick={() => go("catalog")} className={cx(linkButton, "self-start")}>{t("td.allProducts")}</button>
        </section>
    );
}

// ─── A line's panel ──────────────────────────────────────────────────────────

function LinePanel({ line, t, lang, onClose, onOpenStation }: { line: Line; t: TFunc; lang: Lang; onClose: () => void; onOpenStation?: (uuid: string) => void }) {
    const [recent, setRecent] = useState<PackRow[] | null>(null);
    const today = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }, []);
    useEffect(() => {
        let alive = true;
        productionApi.labels(line.uuid, { from: today, to: today }, { level: "pack", limit: 6 })
            .then((page) => { if (alive) setRecent(page.rows as PackRow[]); })
            .catch(() => { if (alive) setRecent([]); });
        return () => { alive = false; };
    }, [line.uuid, today]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    const why = line.kind === "offline" ? t("stp.p.offline.why") : whyText(line, t);
    const facts: [string, string][] = [
        [t("td.panel.now"), line.job?.product || line.last_product || "—"],
        ...(line.job ? [[t("td.panel.job"), `${jobText(line, t, lang)}${etaText(line, t) ? ` · ${etaText(line, t)}` : ""}`] as [string, string]] : []),
        ...(line.operator ? [[t("td.panel.operator"), line.operator] as [string, string]] : []),
        [t("td.panel.today"), t("td.todayOut", { pcs: formatNumber(line.labels, lang), kg: formatNumber(line.kg, lang, 1) })],
        [t("td.panel.rate"), t("td.rate", { n: line.rate })],
    ];
    return (
        <Portal>
            <div className="fixed inset-0 z-40 bg-[rgba(12,18,32,.36)]" onClick={onClose} />
            <aside role="dialog" aria-modal="true" aria-labelledby="line-panel-title"
                className="fixed bottom-3 right-3 top-3 z-50 flex w-[min(460px,calc(100vw-24px))] flex-col gap-3.5 overflow-y-auto rounded-[24px] bg-lp-surface p-5 shadow-[0_30px_80px_-30px_rgba(10,20,40,.55)]">
                <div className="flex items-start gap-3">
                    <span className={cx("flex h-10 w-10 flex-none items-center justify-center rounded-[12px]", TONE_SOFT[line.tone], TONE_INK[line.tone])}><Icon name="station" className="h-5 w-5" /></span>
                    <div className="mr-auto flex min-w-0 flex-col gap-0.5">
                        <h2 id="line-panel-title" className="m-0 text-[22px] font-extrabold">{line.name}</h2>
                        <span className={cx("text-[14px] font-bold", line.tone === "off" ? "text-lp-ink-3" : TONE_INK[line.tone])}>{line.state}</span>
                    </div>
                    <button type="button" onClick={onClose} aria-label={t("stp.close")} className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-lp-line text-lp-ink-2 hover:bg-lp-raised"><Icon name="close" className="h-4 w-4" /></button>
                </div>
                {why && <p className="m-0 rounded-[14px] bg-lp-raised px-3.5 py-3 text-[14px] font-bold text-lp-ink-2">{why}</p>}
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[14px]">
                    {facts.map(([k, v]) => (
                        <React.Fragment key={k}><dt className="font-bold text-lp-ink-3">{k}</dt><dd className="m-0 font-extrabold">{v}</dd></React.Fragment>
                    ))}
                </dl>
                <Spark values={line.hourly} tone={line.tone} height={70} wide />
                <div className="flex flex-col">
                    <b className="mb-1 text-[14px]">{t("td.panel.recent")}</b>
                    {recent === null ? <span className="text-[13px] text-lp-ink-3">{t("dashboard.detailLoading")}</span>
                        : recent.length === 0 ? <span className="text-[13px] text-lp-ink-3">{t("td.panel.none")}</span>
                            : recent.map((r) => (
                                <div key={r.id} className={cx("grid grid-cols-[52px_minmax(0,1fr)_auto] gap-2.5 border-t border-lp-line py-2 text-[13px]", r.deleted && "text-lp-bad")}>
                                    <span className="font-mono text-lp-ink-3">{timeOf(r.at, lang)}</span>
                                    <span className="truncate">{r.product}</span>
                                    <span className="font-extrabold tabular-nums">{formatWeight(r.kg, lang)} {t("dashboard.unitKg")}</span>
                                </div>
                            ))}
                </div>
                <div className="mt-auto flex flex-wrap gap-2.5">
                    <a href={productionApi.labelsCsvUrl(line.uuid, { from: today, to: today }, { level: "pack" })} className={cx(ghostButton, "inline-flex items-center no-underline")}>{t("td.panel.csv")}</a>
                    {onOpenStation && <button type="button" onClick={() => onOpenStation(line.uuid)} className={ghostButton}>{t("td.panel.open")}</button>}
                </div>
            </aside>
        </Portal>
    );
}

