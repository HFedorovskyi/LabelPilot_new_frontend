"use client";

// Print: jobs that tell a station what to print, how much and where. A new job is one row on
// top; the list shows each job's stage and the progress the station reports, with one action
// where a hand is needed. Details open in the side panel (canvas «LabelPilot Server —
// редизайн», board Print v2).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n";
import { stationDelivery, type Delivery, type Station } from "@/lib/stations";
import { ACTIVE_STATUSES, DONE_DAYS, jobMatches, jobStage, STAGES, type PrintJob } from "@/lib/printJobs";
import type { NavKey } from "@/app/components/shell/Sidebar";
import PageTitle from "@/app/components/shell/PageTitle";
import { cx, download } from "@/app/components/stations/shared";
import JobPanel from "./JobPanel";
import {
    amountText, errorMessage, failureText, localDate, primaryButton, progressPercent, reasonText,
    rowButton, STAGE_DOT, STAGE_INK, stageText, linkButton,
} from "./shared";

type Product = { id: number; name: string; article: string };
type Tab = "active" | "done" | "all";
type Message = { ok: boolean; text: string };
type Draft = {
    product: Product | null;
    productText: string;
    qty: string;
    unit: PrintJob["quantity_unit"];
    station: string;
    batch: string;
    date: string;
};

const SUGGESTIONS = 6;
const emptyDraft = (): Draft => ({ product: null, productText: "", qty: "", unit: "pcs", station: "", batch: "", date: localDate() });
const parseQty = (text: string) => Number.parseFloat(text.replace(",", ".").trim());
/** Finished jobs list newest first; 0 for the rest, which keep their order by number. */
const doneTime = (job: PrintJob) => (jobStage(job) === "done" ? Date.parse(job.completed_at ?? job.updated_at) : 0);

/** An error whose message is already a full sentence for the user. */
class Shown extends Error { }

export default function PrintPage({ onNavigate, onJobsChanged }: { onNavigate: (tab: NavKey) => void; onJobsChanged?: () => void }) {
    const { t, lang } = useTranslation();
    const [activeJobs, setActiveJobs] = useState<PrintJob[] | null>(null);
    const [doneJobs, setDoneJobs] = useState<PrintJob[]>([]);
    const [stations, setStations] = useState<Station[] | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [tab, setTab] = useState<Tab>("active");
    const [query, setQuery] = useState("");
    const [panelId, setPanelId] = useState<number | null>(null);
    const [message, setMessage] = useState<Message | null>(null);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [moreOpen, setMoreOpen] = useState(false);
    const qtyInput = useRef<HTMLInputElement>(null);
    const activeIds = useRef<Set<number>>(new Set());

    const loadDone = useCallback(
        () => api.printJobs.list({ status: "completed", recent_days: DONE_DAYS }).then(setDoneJobs).catch(() => { }),
        [],
    );
    const loadActive = useCallback(async () => {
        try {
            const list = await api.printJobs.list({ status: ACTIVE_STATUSES });
            const ids = new Set(list.map((job) => job.id));
            // A job that left the list was completed (or deleted): load the finished ones first,
            // so a completed job never vanishes from the page for a moment.
            const left = [...activeIds.current].some((id) => !ids.has(id));
            activeIds.current = ids;
            if (left) await loadDone();
            setActiveJobs(list);
        } catch {
            setActiveJobs((prev) => prev ?? []);
        }
    }, [loadDone]);
    const loadStations = useCallback(() => api.stations.list().then(setStations).catch(() => { }), []);

    useEffect(() => {
        void loadActive();
        void loadDone();
        void loadStations();
        api.nomenclature.list()
            .then((list: Product[]) => setProducts(list.map(({ id, name, article }) => ({ id, name, article }))))
            .catch(() => { });
        const fast = setInterval(loadActive, 5000);
        const slow = setInterval(() => { void loadStations(); void loadDone(); }, 30000);
        return () => { clearInterval(fast); clearInterval(slow); };
    }, [loadActive, loadDone, loadStations]);

    const refresh = useCallback(() => {
        void loadActive();
        void loadDone();
        onJobsChanged?.();
    }, [loadActive, loadDone, onJobsChanged]);

    const stationById = useMemo(() => new Map((stations ?? []).map((s) => [s.id, s])), [stations]);
    /** null until the stations are loaded, so rows do not flash "waits for a decision". */
    const deliveryOf = (stationId: number): Delivery | null => {
        if (stations === null) return null;
        const station = stationById.get(stationId);
        return station ? stationDelivery(station) : "blocked";
    };

    const jobs = useMemo(() => {
        const byId = new Map<number, PrintJob>();
        for (const job of [...doneJobs, ...(activeJobs ?? [])]) byId.set(job.id, job);
        return [...byId.values()];
    }, [activeJobs, doneJobs]);
    const inWork = jobs.filter((job) => jobStage(job) !== "done");
    const finished = jobs.filter((job) => jobStage(job) === "done");
    const q = query.trim().toLowerCase();
    const rows = (tab === "active" ? inWork : tab === "done" ? finished : jobs)
        .filter((job) => jobMatches(job, q))
        .sort((a, b) => STAGES.indexOf(jobStage(a)) - STAGES.indexOf(jobStage(b)) || doneTime(b) - doneTime(a) || b.id - a.id);
    const unsent = inWork.filter((job) => jobStage(job) === "unsent" && (deliveryOf(job.station) === "network" || deliveryOf(job.station) === "file"));
    const unsentOnline = unsent.filter((job) => deliveryOf(job.station) === "network");

    const selected = panelId === null ? null : jobs.find((job) => job.id === panelId) ?? null;
    useEffect(() => {
        // The open job was deleted (here or elsewhere): close its panel.
        if (panelId !== null && activeJobs !== null && !selected) setPanelId(null);
    }, [panelId, activeJobs, selected]);

    // ── actions ──────────────────────────────────────────────────────────────
    const act = async (operation: () => Promise<string>) => {
        setBusy(true);
        setMessage(null);
        try {
            setMessage({ ok: true, text: await operation() });
        } catch (e) {
            setMessage({ ok: false, text: e instanceof Shown ? e.message : t("prt.err", { message: errorMessage(e) }) });
        } finally {
            setBusy(false);
            refresh();
        }
    };
    const sendJob = async (job: PrintJob): Promise<string> => {
        try {
            await api.printJobs.sendToStation(job.id);
        } catch (e) {
            throw new Shown(t("prt.sendFailed", { id: job.id, reason: reasonText(errorMessage(e), job.station_name, t) }));
        }
        return t("prt.done.sent", { id: job.id, station: job.station_name });
    };
    const fileJob = async (job: PrintJob): Promise<string> => {
        download(await api.printJobs.downloadForUsb(job.id), `job_${job.id}.lpj`);
        return t("prt.done.file", { id: job.id });
    };
    const send = (job: PrintJob) => act(() => sendJob(job));
    const toFile = (job: PrintJob) => act(() => fileJob(job));
    const sendAll = () => act(async () => {
        let sent = 0;
        for (const job of unsentOnline) {
            try {
                await api.printJobs.sendToStation(job.id);
                sent += 1;
            } catch {
                // The row shows why this one failed.
            }
        }
        if (sent < unsentOnline.length) throw new Shown(t("prt.sentSome", { sent, total: unsentOnline.length }));
        return t("prt.sentAll", { count: sent });
    });
    const bundle = () => act(async () => {
        download(await api.printJobs.downloadUsbBundle(), `print_jobs_${localDate()}.lpj`);
        return t("prt.done.bundle");
    });
    const markDone = (job: PrintJob) => act(async () => {
        await api.printJobs.update(job.id, { status: "completed" });
        return t("prt.done.completed", { id: job.id });
    });
    const remove = (job: PrintJob) => act(async () => {
        await api.printJobs.delete(job.id);
        setPanelId(null);
        return t("prt.done.deleted", { id: job.id });
    });
    const repeat = (job: PrintJob) => {
        setDraft({
            product: products.find((p) => p.id === job.nomenclature) ?? { id: job.nomenclature, name: job.nomenclature_name, article: job.nomenclature_article },
            productText: "",
            qty: String(job.quantity),
            unit: job.quantity_unit,
            station: String(job.station),
            batch: job.batch_number,
            date: localDate(),
        });
        setMoreOpen(Boolean(job.batch_number));
        setPanelId(null);
        setMessage(null);
        qtyInput.current?.focus();
    };

    // ── composer ─────────────────────────────────────────────────────────────
    const station = draft.station ? stationById.get(Number(draft.station)) ?? null : null;
    const way = station ? stationDelivery(station) : null;
    const qty = parseQty(draft.qty);
    const wholeNeeded = draft.unit === "pcs" && Number.isFinite(qty) && !Number.isInteger(qty);
    const ready = draft.product !== null && station !== null && Number.isFinite(qty) && qty > 0 && !wholeNeeded && Boolean(draft.date);
    const hint = wholeNeeded
        ? { text: t("prt.hint.wholePcs"), warn: true }
        : station && way
            ? { text: t(`prt.hint.${way}`, { name: station.station_name }), warn: way !== "network" }
            : { text: t("prt.hint.none"), warn: false };
    const selectable = (stations ?? []).filter((s) => (s.seat_state ?? "active") !== "released");

    const create = () => act(async () => {
        if (!ready || !draft.product || !station || !way) return "";
        const job: PrintJob = await api.printJobs.create({
            station: station.id,
            nomenclature: draft.product.id,
            quantity: qty,
            quantity_unit: draft.unit,
            batch_number: draft.batch.trim(),
            marking_date: draft.date,
        });
        setDraft((d) => ({ ...d, product: null, productText: "", qty: "" }));
        setTab("active");
        if (way === "network") {
            await sendJob(job);
            return t("prt.flash.sent", { id: job.id, station: station.station_name });
        }
        if (way === "file") {
            await fileJob(job);
            return t("prt.flash.file", { id: job.id });
        }
        return t("prt.flash.saved", { id: job.id, station: station.station_name });
    });

    const tabs: { id: Tab; label: string; count: number }[] = [
        { id: "active", label: t("prt.tab.active"), count: inWork.length },
        { id: "done", label: t("prt.tab.done"), count: finished.length },
        { id: "all", label: t("prt.tab.all"), count: jobs.length },
    ];
    const emptyText = q ? t("prt.empty.search") : t(`prt.empty.${tab}`, { days: DONE_DAYS });
    // With the side panel open the list is narrow: the station moves under the product name.
    const compact = selected !== null;
    const columns = compact
        ? "grid grid-cols-[132px_minmax(0,1fr)_130px_104px] gap-3.5"
        : "grid grid-cols-[150px_minmax(0,1fr)_120px_170px_112px] gap-3.5";

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
            <PageTitle icon="print_tasks" eyebrow={t("nav.groupProduction")} title={t("nav.print_tasks")} description={t("nav.print_tasksDesc")} />

            <section aria-labelledby="print-new" className="flex flex-col gap-2.5 lp-card px-[18px] py-4">
                <h2 id="print-new" className="m-0 text-[16px] font-extrabold">{t("prt.new")}</h2>
                <div className="flex flex-wrap items-end gap-2.5">
                    <ProductPicker
                        products={products}
                        product={draft.product}
                        text={draft.productText}
                        onText={(productText) => setDraft((d) => ({ ...d, product: null, productText }))}
                        onPick={(product) => {
                            setDraft((d) => ({ ...d, product, productText: "" }));
                            qtyInput.current?.focus();
                        }}
                    />
                    <div className="flex min-w-0 flex-[1_1_150px] flex-col gap-1">
                        <label htmlFor="print-qty" className="text-[12px] font-bold text-lp-ink-3">{t("prt.qty")}</label>
                        <div className="flex gap-1.5">
                            <input
                                id="print-qty"
                                ref={qtyInput}
                                inputMode="decimal"
                                placeholder="0"
                                value={draft.qty}
                                onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
                                className="min-h-[44px] w-full min-w-0 flex-1 rounded-[10px] border border-lp-line-2 bg-lp-surface px-3 text-[16px] font-extrabold tabular-nums text-lp-ink outline-none focus:border-lp-accent"
                            />
                            <div role="group" aria-label={t("prt.unitLabel")} className="flex flex-none gap-[3px] rounded-[11px] bg-lp-bg p-[3px]">
                                {(["pcs", "kg"] as const).map((unit) => (
                                    <button
                                        key={unit}
                                        type="button"
                                        aria-pressed={draft.unit === unit}
                                        onClick={() => setDraft((d) => ({ ...d, unit }))}
                                        className={cx(
                                            "min-h-[38px] min-w-[40px] rounded-[9px] border-0 text-[13px] font-extrabold",
                                            draft.unit === unit ? "bg-lp-surface text-lp-ink shadow-sm" : "bg-transparent text-lp-ink-3",
                                        )}
                                    >
                                        {t(`prt.unit.${unit}`)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex min-w-0 flex-[2_1_200px] flex-col gap-1">
                        <label htmlFor="print-station" className="text-[12px] font-bold text-lp-ink-3">{t("prt.station")}</label>
                        <select
                            id="print-station"
                            value={draft.station}
                            onChange={(e) => setDraft((d) => ({ ...d, station: e.target.value }))}
                            className="min-h-[44px] w-full rounded-[10px] border border-lp-line-2 bg-lp-surface px-2.5 text-[14px] font-bold text-lp-ink outline-none focus:border-lp-accent"
                        >
                            <option value="">{t("prt.chooseStation")}</option>
                            {selectable.map((s) => (
                                <option key={s.id} value={s.id}>{t(`prt.opt.${stationDelivery(s)}`, { name: s.station_name })}</option>
                            ))}
                        </select>
                    </div>
                    <button type="button" onClick={create} disabled={!ready || busy} className={cx(primaryButton, "flex-none")}>
                        {t(`prt.create.${way ?? "network"}`)}
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
                    <span className={cx("font-bold", hint.warn ? "text-lp-warn" : "text-lp-ink-3")}>{hint.text}</span>
                    <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className={linkButton}>
                        {moreOpen ? t("prt.less") : t("prt.more")}
                    </button>
                </div>
                {moreOpen && (
                    <div className="flex flex-wrap gap-2.5">
                        <div className="flex flex-[0_1_220px] flex-col gap-1">
                            <label htmlFor="print-batch" className="text-[12px] font-bold text-lp-ink-3">{t("prt.batch")}</label>
                            <input
                                id="print-batch"
                                value={draft.batch}
                                maxLength={100}
                                onChange={(e) => setDraft((d) => ({ ...d, batch: e.target.value }))}
                                placeholder={t("prt.batchPlaceholder")}
                                className="min-h-[40px] w-full rounded-[10px] border border-lp-line-2 bg-lp-surface px-2.5 font-mono text-[14px] text-lp-ink outline-none focus:border-lp-accent"
                            />
                        </div>
                        <div className="flex flex-[0_1_200px] flex-col gap-1">
                            <label htmlFor="print-date" className="text-[12px] font-bold text-lp-ink-3">{t("prt.date")}</label>
                            <input
                                id="print-date"
                                type="date"
                                value={draft.date}
                                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                                className="min-h-[40px] w-full rounded-[10px] border border-lp-line-2 bg-lp-surface px-2 text-[14px] text-lp-ink outline-none focus:border-lp-accent"
                            />
                        </div>
                    </div>
                )}
            </section>

            {message && message.text && (
                <p role="status" className={cx("m-0 rounded-[12px] px-4 py-3 text-[14px] font-bold", message.ok ? "bg-lp-ok-bg text-lp-ok" : "bg-lp-bad-bg text-lp-bad")}>
                    {message.ok ? "●" : "■"} {message.text}
                </p>
            )}

            <div className="flex flex-col items-start gap-4 lg:flex-row">
                <section aria-labelledby="print-list" className="w-full min-w-0 flex-1 overflow-hidden lp-card">
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 px-[18px] py-3.5">
                        <h2 id="print-list" className="m-0 text-[16px] font-extrabold">{t("prt.jobs")}</h2>
                        <div role="tablist" aria-label={t("prt.tabsLabel")} className="flex max-w-full gap-1 overflow-x-auto rounded-[11px] bg-lp-bg p-[3px]">
                            {tabs.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === item.id}
                                    onClick={() => setTab(item.id)}
                                    className={cx(
                                        "min-h-[36px] whitespace-nowrap rounded-[9px] border-0 px-3 text-[13px] font-extrabold",
                                        tab === item.id ? "bg-lp-surface text-lp-ink shadow-sm" : "bg-transparent text-lp-ink-3",
                                    )}
                                >
                                    {item.label} <span className="font-bold tabular-nums text-lp-ink-3">{item.count}</span>
                                </button>
                            ))}
                        </div>
                        <div className="relative ml-auto min-w-[150px] flex-[0_1_220px]">
                            <label htmlFor="print-search" className="sr-only">{t("prt.search")}</label>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-lp-ink-3">
                                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                            </svg>
                            <input
                                id="print-search"
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t("prt.search")}
                                className="min-h-[40px] w-full rounded-[10px] border border-lp-line bg-lp-bg pl-9 pr-3 text-[14px] text-lp-ink outline-none focus:border-lp-accent"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <div className={compact ? "min-w-[540px]" : "min-w-[680px]"}>
                            <div className={cx(columns, "border-t border-lp-line bg-lp-raised px-[18px] py-[9px] text-[12px] font-bold text-lp-ink-3")}>
                                <span>{t("prt.col.state")}</span>
                                <span>{t("prt.col.what")}</span>
                                {!compact && <span>{t("prt.col.station")}</span>}
                                <span>{t("prt.col.qty")}</span>
                                <span />
                            </div>
                            {activeJobs === null ? (
                                <p className="m-0 border-t border-lp-line px-[18px] py-7 text-center text-lp-ink-3">…</p>
                            ) : rows.length === 0 ? (
                                <p className="m-0 border-t border-lp-line px-[18px] py-7 text-center text-lp-ink-3">{emptyText}</p>
                            ) : rows.map((job) => {
                                const stage = jobStage(job);
                                const delivery = deliveryOf(job.station);
                                const percent = progressPercent(job);
                                const needsHand = stage === "unsent" || stage === "error";
                                const blocked = needsHand && delivery === "blocked";
                                const detail = blocked
                                    ? t("prt.waitsSeat")
                                    : job.batch_number
                                        ? t("prt.subBatch", { article: job.nomenclature_article, batch: job.batch_number })
                                        : t("prt.sub", { article: job.nomenclature_article });
                                // The failure text names the station already.
                                const sub = stage === "error" ? failureText(job, t, lang) : compact ? `${job.station_name} · ${detail}` : detail;
                                return (
                                    <div
                                        key={job.id}
                                        className={cx(columns, "items-center border-t border-lp-line px-[18px] py-3", panelId === job.id ? "bg-lp-accent-bg" : "hover:bg-lp-raised")}
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span className={cx("h-2 w-2 flex-none rounded-full", STAGE_DOT[stage])} />
                                            <span className={cx("text-[13px] font-bold", STAGE_INK[stage])}>{stageText(job, t, lang)}</span>
                                        </span>
                                        <span className="flex min-w-0 flex-col">
                                            <button
                                                type="button"
                                                onClick={() => setPanelId(job.id)}
                                                className="truncate border-0 bg-transparent p-0 text-left text-[14px] font-extrabold text-lp-ink hover:underline"
                                            >
                                                {job.nomenclature_name}
                                            </button>
                                            <span
                                                title={sub}
                                                className={cx("truncate text-[12px] tabular-nums", stage === "error" ? "text-lp-bad" : blocked ? "text-lp-warn" : "text-lp-ink-3")}
                                            >
                                                {sub}
                                            </span>
                                        </span>
                                        {!compact && <span className="truncate text-[14px] text-lp-ink-2">{job.station_name}</span>}
                                        <span className="flex flex-col gap-1">
                                            <span className="text-[14px] font-extrabold tabular-nums">{amountText(job, t, lang)}</span>
                                            {percent !== null && (
                                                <span className="h-1 rounded-sm bg-lp-off-bg" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                                                    <span className="block h-1 rounded-sm bg-lp-accent" style={{ width: `${percent}%` }} />
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-right">
                                            {needsHand && delivery === "network" && (
                                                <button type="button" disabled={busy} onClick={() => send(job)} className={rowButton}>
                                                    {stage === "error" ? t("prt.act.retry") : t("prt.act.send")}
                                                </button>
                                            )}
                                            {needsHand && delivery === "file" && (
                                                <button type="button" disabled={busy} onClick={() => toFile(job)} className={rowButton}>
                                                    {t("prt.act.file")}
                                                </button>
                                            )}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {((unsent.length > 0 && tab !== "done") || tab !== "active") && (
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-lp-line bg-lp-raised px-[18px] py-3 text-[13px]">
                            {unsentOnline.length > 0 && tab !== "done" && (
                                <button type="button" disabled={busy} onClick={sendAll} className={linkButton}>
                                    {t("prt.sendAll", { count: unsentOnline.length })}
                                </button>
                            )}
                            {unsent.length > 0 && tab !== "done" && (
                                <button type="button" disabled={busy} onClick={bundle} className={linkButton}>
                                    {t("prt.bundle")}
                                </button>
                            )}
                            {tab !== "active" && <span className="ml-auto text-lp-ink-3">{t("prt.retention", { days: DONE_DAYS })}</span>}
                        </div>
                    )}
                </section>

                {selected && (
                    <JobPanel
                        key={selected.id}
                        job={selected}
                        delivery={deliveryOf(selected.station)}
                        busy={busy}
                        onClose={() => setPanelId(null)}
                        onSend={() => send(selected)}
                        onFile={() => toFile(selected)}
                        onRepeat={() => repeat(selected)}
                        onMarkDone={() => markDone(selected)}
                        onDelete={() => remove(selected)}
                        onOpenStations={() => onNavigate("stations")}
                    />
                )}
            </div>
        </div>
    );
}

// ─── Product search in the new-job row ───────────────────────────────────────

function ProductPicker({ products, product, text, onText, onPick }: {
    products: Product[];
    product: Product | null;
    text: string;
    onText: (text: string) => void;
    onPick: (product: Product) => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const needle = text.trim().toLowerCase();
    const matches = needle
        ? products.filter((p) => p.name.toLowerCase().includes(needle) || p.article.toLowerCase().includes(needle)).slice(0, SUGGESTIONS)
        : [];
    const showList = open && !product && needle.length > 0;

    const pick = (choice: Product) => {
        onPick(choice);
        setOpen(false);
    };
    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showList) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((i) => Math.min(i + 1, matches.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && matches[highlight]) {
            e.preventDefault();
            pick(matches[highlight]);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    };

    return (
        <div className="relative flex min-w-0 flex-[3_1_260px] flex-col gap-1">
            <label htmlFor="print-product" className="text-[12px] font-bold text-lp-ink-3">{t("prt.product")}</label>
            <input
                id="print-product"
                type="search"
                role="combobox"
                aria-expanded={showList}
                aria-controls="print-product-list"
                aria-autocomplete="list"
                autoComplete="off"
                value={product ? `${product.name} · ${product.article}` : text}
                onChange={(e) => {
                    onText(e.target.value);
                    setHighlight(0);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={onKeyDown}
                placeholder={t("prt.productPlaceholder")}
                className={cx(
                    "min-h-[44px] w-full rounded-[10px] border bg-lp-surface px-3 text-[14px] font-bold text-lp-ink outline-none focus:border-lp-accent",
                    product ? "border-lp-accent" : "border-lp-line-2",
                )}
            />
            {showList && (
                <div id="print-product-list" role="listbox" className="absolute left-0 right-0 top-[72px] z-10 overflow-hidden rounded-[12px] border border-lp-line-2 bg-lp-surface shadow-[0_12px_30px_rgba(18,23,34,0.14)]">
                    {matches.length === 0 ? (
                        <div className="px-3 py-2.5 text-[14px] text-lp-ink-3">{t("prt.noProducts")}</div>
                    ) : matches.map((choice, i) => (
                        <button
                            key={choice.id}
                            type="button"
                            role="option"
                            aria-selected={i === highlight}
                            // mousedown keeps the input focused, so the blur does not close the list first
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pick(choice)}
                            onMouseEnter={() => setHighlight(i)}
                            className={cx(
                                "flex min-h-[40px] w-full items-center gap-2.5 border-0 border-t border-lp-line px-3 text-left first:border-t-0",
                                i === highlight ? "bg-lp-accent-bg" : "bg-transparent",
                            )}
                        >
                            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-lp-ink">{choice.name}</span>
                            <span className="font-mono text-[12px] text-lp-ink-3">{choice.article}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
