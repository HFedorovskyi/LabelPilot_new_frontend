"use client";

// Stations: the computers with scales and printers on the floor. One focal block on top —
// the stations that need a decision, each once, with the reason and one action — then the
// working stations as quiet tiles, and stations without a seat folded away. Details and
// editing open in the side panel (canvas «LabelPilot Server — редизайн», board Stations).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type StationsToday } from "@/lib/api/client";
import { apiHost } from "@/lib/api/base";
import { licenseApi, type LicenseInfo } from "@/lib/api/license";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { useTranslation } from "@/lib/i18n";
import PageTitle from "@/app/components/shell/PageTitle";
import { PROBLEMS, stationProblem, type Station, type StationProblem } from "@/lib/stations";
import StationPanel, { type TodayRow } from "@/app/components/stations/StationPanel";
import {
    Bars, cx, formatNumber, Icon, PROBLEM_TONE, sinceText, TONE_INK, TONE_SOFT, whenText,
} from "@/app/components/stations/shared";

type PanelState = { mode: "station"; uuid: string } | { mode: "add" } | { mode: "legend" } | null;

const TILE_HOURS = 9;

export default function StationsPage() {
    const { t, lang } = useTranslation();
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const [stations, setStations] = useState<Station[] | null>(null);
    const [today, setToday] = useState<StationsToday | null>(null);
    const [license, setLicense] = useState<LicenseInfo | null>(null);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const [panel, setPanel] = useState<PanelState>(null);
    const [unusedOpen, setUnusedOpen] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [host, setHost] = useState(() => apiHost("localhost"));
    const reportInput = useRef<HTMLInputElement>(null);

    const loadStations = useCallback(async () => {
        try {
            setStations(await api.stations.list());
            setUpdatedAt(new Date());
        } catch {
            setStations((prev) => prev ?? []);
        }
    }, []);
    const loadToday = useCallback(() => api.statistics.stationsToday().then(setToday).catch(() => { }), []);
    const loadLicense = useCallback(() => licenseApi.get().then(setLicense).catch(() => { }), []);

    useEffect(() => {
        loadStations();
        loadToday();
        loadLicense();
        setHost(apiHost());
        api.stations.getServerIp().then((d: { ip?: string }) => d?.ip && setHost(apiHost(d.ip))).catch(() => { });
        const fast = setInterval(loadStations, 5000);
        const slow = setInterval(() => { loadToday(); loadLicense(); }, 30000);
        return () => { clearInterval(fast); clearInterval(slow); };
    }, [loadStations, loadToday, loadLicense]);

    const refresh = useCallback(() => { loadStations(); loadLicense(); loadToday(); }, [loadStations, loadLicense, loadToday]);

    const todayById = useMemo(() => {
        const map = new Map<number, TodayRow>();
        for (const row of today?.stations ?? []) map.set(row.id, row);
        return map;
    }, [today]);

    const list = stations ?? [];
    const problems = list
        .map((station) => ({ station, problem: stationProblem(station) }))
        .filter((x): x is { station: Station; problem: StationProblem } => x.problem !== null)
        .sort((a, b) => PROBLEMS.indexOf(a.problem) - PROBLEMS.indexOf(b.problem));
    const working = list.filter((s) => stationProblem(s) === null && (s.seat_state ?? "active") !== "released");
    const unused = list.filter((s) => stationProblem(s) === null && s.seat_state === "released");
    const online = list.filter((s) => s.is_online && !s.conflict_fingerprint).length;
    const printedToday = (today?.stations ?? []).reduce((sum, row) => sum + row.labels, 0);
    const totalHourly = (today?.hours ?? []).map((_, i) => (today?.stations ?? []).reduce((sum, row) => sum + (row.hourly[i] ?? 0), 0));
    const seats = license?.seats ?? null;
    const freeSeat = seats != null && (seats.limit == null || seats.active < seats.limit);

    const selected = panel?.mode === "station" ? list.find((s) => s.station_uuid === panel.uuid) ?? null : null;
    useEffect(() => {
        // The open station was deleted (here or elsewhere): close its panel.
        if (panel?.mode === "station" && stations && !selected) setPanel(null);
    }, [panel, stations, selected]);

    const openStation = (uuid: string) => setPanel({ mode: "station", uuid });

    const act = async (operation: () => Promise<unknown>, done: string) => {
        setMessage(null);
        try {
            await operation();
            setMessage({ ok: true, text: done });
            refresh();
        } catch (e) {
            setMessage({ ok: false, text: t("stp.err", { message: e instanceof Error ? e.message : String(e) }) });
        }
    };

    const problemAction = (station: Station, problem: StationProblem): { label: string; run: () => void } => {
        if (problem === "unlisted" && isAdmin && license?.seat_list?.sync_enabled) {
            return { label: t("stp.p.unlisted.action"), run: () => act(() => licenseApi.syncSeatList(), t("stp.done.sync")) };
        }
        if (problem === "pending" && isAdmin && freeSeat) {
            return { label: t("stp.p.pending.actionFree"), run: () => act(() => api.stations.activateSeat(station.station_uuid), t("stp.done.activate")) };
        }
        return { label: t(`stp.p.${problem}.action`), run: () => openStation(station.station_uuid) };
    };

    const uploadReport = async (file: File) => {
        await act(() => api.stations.uploadReport(file), t("stp.reportUploaded"));
    };

    const tileBars = (row: TodayRow | undefined) => {
        const values = row?.hourly ?? [];
        const window = values.slice(-TILE_HOURS);
        return [...Array(Math.max(0, TILE_HOURS - window.length)).fill(0), ...window];
    };

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-[22px]">
            <PageTitle
                icon="stations"
                eyebrow={updatedAt
                    ? t("stp.eyebrow", { time: updatedAt.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" }) })
                    : t("nav.groupProduction")}
                title={t("nav.stations")}
                description={t("nav.stationsDesc")}
            >
                <button
                    type="button"
                    onClick={() => setPanel({ mode: "add" })}
                    className="flex min-h-[44px] items-center gap-2 rounded-[11px] lp-btn-primary px-[18px] text-[14px] font-extrabold text-[#fff] transition hover:brightness-110"
                >
                    <Icon name="plus" className="h-5 w-5" />
                    {t("stp.connect")}
                </button>
            </PageTitle>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-3">
                <div className="flex flex-col gap-2.5 lp-card px-[18px] py-4">
                    <span className="text-[13px] font-bold text-lp-ink-3">{t("stp.kpiOnline")}</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-[30px] font-extrabold tabular-nums tracking-[-0.02em]">{online}</span>
                        <span className="font-bold text-lp-ink-3">{t("stp.kpiOnlineOf", { total: list.length })}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5" aria-hidden="true">
                        {[...list].sort((a, b) => Number(a.station_number ?? 0) - Number(b.station_number ?? 0)).map((s) => {
                            const conflict = Boolean(s.conflict_fingerprint);
                            const on = s.is_online && !conflict;
                            return (
                                <span
                                    key={s.station_uuid}
                                    title={`${s.station_number ?? ""} · ${s.station_name}`}
                                    className={cx("h-3.5 w-3.5 rounded-full border-2", conflict ? "border-lp-bad bg-lp-bad" : on ? "border-lp-ok bg-lp-ok" : "border-lp-line-2")}
                                />
                            );
                        })}
                    </div>
                </div>
                <div className="flex flex-col gap-2.5 lp-card px-[18px] py-4">
                    <span className="text-[13px] font-bold text-lp-ink-3">{t("stp.kpiPrinted")}</span>
                    <div className="flex items-end justify-between gap-3">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-[30px] font-extrabold tabular-nums tracking-[-0.02em]">{formatNumber(printedToday, lang)}</span>
                            <span className="font-bold text-lp-ink-3">{t("stp.kpiLabels")}</span>
                        </div>
                        <Bars values={tileBars({ labels: 0, weight_kg: 0, last_at: null, last_product: "", hourly: totalHourly })} height={34} now={TILE_HOURS - 1} width={7} />
                    </div>
                </div>
                <div className="flex flex-col gap-2.5 lp-card px-[18px] py-4">
                    <span className="text-[13px] font-bold text-lp-ink-3">{t("stp.kpiSeats")}</span>
                    {seats ? (
                        <>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-[30px] font-extrabold tabular-nums tracking-[-0.02em]">{seats.active}</span>
                                <span className="font-bold text-lp-ink-3">
                                    {seats.limit == null ? t("stp.kpiSeatsUnlimited") : t("stp.kpiSeatsOf", { limit: seats.limit })}
                                </span>
                            </div>
                            {seats.limit != null && seats.limit <= 40 && (
                                <div className="flex gap-1" aria-hidden="true">
                                    {Array.from({ length: seats.limit }, (_, i) => (
                                        <span key={i} className={cx("h-2 flex-1 rounded-[3px]", i < seats.active ? "bg-lp-accent" : "bg-lp-off-bg")} />
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <span className="text-[14px] font-bold text-lp-ink-2">{t("stp.kpiNoLicense")}</span>
                    )}
                </div>
            </div>

            {message && (
                <p className={cx("m-0 rounded-[12px] px-4 py-3 text-[14px] font-bold", message.ok ? "bg-lp-ok-bg text-lp-ok" : "bg-lp-bad-bg text-lp-bad")}>
                    {message.ok ? "●" : "■"} {message.text}
                </p>
            )}

            <div className="flex flex-col items-start gap-4 lg:flex-row">
                <div className="flex w-full min-w-0 flex-1 flex-col gap-[22px]">
                    {stations === null ? (
                        <p className="m-0 text-[14px] text-lp-ink-3">…</p>
                    ) : list.length === 0 ? (
                        <div className="flex flex-col items-start gap-3 rounded-[16px] border border-dashed border-lp-line-2 p-6">
                            <span className="text-[16px] font-extrabold">{t("stp.emptyTitle")}</span>
                            <span className="text-[14px] text-lp-ink-2">{t("stp.empty")}</span>
                        </div>
                    ) : (
                        <>
                            {problems.length > 0 ? (
                                <section aria-labelledby="stations-decide" className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <h2 id="stations-decide" className="m-0 text-[18px] font-extrabold">{t("stp.needsDecision")}</h2>
                                        <span className="rounded-full bg-lp-bad-bg px-2 py-px text-[12px] font-extrabold tabular-nums text-lp-bad">{problems.length}</span>
                                    </div>
                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-3">
                                        {problems.map(({ station, problem }) => {
                                            const tone = PROBLEM_TONE[problem];
                                            const action = problemAction(station, problem);
                                            const isOpen = selected?.station_uuid === station.station_uuid;
                                            return (
                                                <div
                                                    key={station.station_uuid}
                                                    className={cx(
                                                        "flex flex-col gap-2.5 rounded-[20px] border bg-lp-surface p-4 shadow-[var(--lp-shadow)]",
                                                        isOpen ? "border-lp-accent ring-1 ring-lp-accent" : "border-lp-line",
                                                    )}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span className={cx("flex h-11 w-11 flex-none items-center justify-center rounded-[12px]", TONE_SOFT[tone], TONE_INK[tone])}>
                                                            <Icon name={problem} />
                                                        </span>
                                                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                            <span className="truncate text-[16px] font-extrabold">{station.station_name}</span>
                                                            <span className={cx("text-[14px] font-extrabold", TONE_INK[tone])}>
                                                                {t(`stp.p.${problem}.label`, { duration: sinceText(station.changed_at, t) })}
                                                            </span>
                                                        </div>
                                                        <span className="font-mono text-[12px] tabular-nums text-lp-ink-3">{station.station_number}</span>
                                                    </div>
                                                    <span className="text-[14px] text-lp-ink-2">
                                                        {problem === "pending" && freeSeat ? t("stp.p.pending.whyFree") : t(`stp.p.${problem}.why`)}
                                                    </span>
                                                    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
                                                        <button
                                                            type="button"
                                                            onClick={action.run}
                                                            className="min-h-[40px] rounded-[10px] border border-lp-line-2 bg-lp-surface px-3.5 text-[14px] font-extrabold transition hover:bg-lp-raised"
                                                        >
                                                            {action.label}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openStation(station.station_uuid)}
                                                            className="border-0 bg-transparent p-0 text-[14px] font-bold text-lp-accent-ink hover:underline"
                                                        >
                                                            {t("stp.more")}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            ) : (
                                <p className="m-0 rounded-[16px] bg-lp-ok-bg px-[18px] py-4 text-[15px] font-extrabold text-lp-ok">● {t("stp.allGood")}</p>
                            )}

                            {working.length > 0 && (
                                <section aria-labelledby="stations-working" className="flex flex-col gap-3">
                                    <h2 id="stations-working" className="m-0 text-[18px] font-extrabold">
                                        {t("stp.working")} <span className="font-bold tabular-nums text-lp-ink-3">{working.length}</span>
                                    </h2>
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-3">
                                        {working.map((station) => {
                                            const row = todayById.get(station.id);
                                            const isOpen = selected?.station_uuid === station.station_uuid;
                                            return (
                                                <button
                                                    key={station.station_uuid}
                                                    type="button"
                                                    onClick={() => openStation(station.station_uuid)}
                                                    aria-pressed={isOpen}
                                                    className={cx(
                                                        "lp-lift flex flex-col gap-2.5 rounded-[20px] border bg-lp-surface px-4 py-3.5 text-left shadow-[var(--lp-shadow)] hover:border-lp-line-2",
                                                        isOpen ? "border-lp-accent ring-1 ring-lp-accent" : "border-lp-line",
                                                    )}
                                                >
                                                    <span className="flex w-full items-center gap-2.5">
                                                        <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-lp-accent-bg text-lp-accent-ink">
                                                            <Icon name="station" />
                                                        </span>
                                                        <span className="flex min-w-0 flex-1 flex-col">
                                                            <span className="truncate text-[14px] font-extrabold">{station.station_name}</span>
                                                            <span className="text-[12px] font-bold text-lp-ok">● {t("stp.onLink")}</span>
                                                        </span>
                                                        <span className="font-mono text-[12px] tabular-nums text-lp-ink-3">{station.station_number}</span>
                                                    </span>
                                                    <span className="flex w-full items-end justify-between gap-2.5">
                                                        <span className="flex flex-col">
                                                            <span className="text-[22px] font-extrabold tabular-nums tracking-[-0.01em]">{formatNumber(row?.labels ?? 0, lang)}</span>
                                                            <span className="text-[12px] text-lp-ink-3">{t("stp.labelsToday")}</span>
                                                        </span>
                                                        <Bars values={tileBars(row)} height={30} now={TILE_HOURS - 1} />
                                                    </span>
                                                    <span className="w-full truncate text-[13px] text-lp-ink-2">
                                                        {row?.last_product
                                                            ? t("stp.lastProduct", { product: row.last_product, time: whenText(row.last_at, lang, t) })
                                                            : t("stp.noLabelsToday")}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {unused.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setUnusedOpen((v) => !v)}
                                        aria-expanded={unusedOpen}
                                        className="self-start border-0 bg-transparent py-1.5 text-[14px] font-extrabold text-lp-ink-3"
                                    >
                                        {unusedOpen ? "▾" : "▸"} {t("stp.unused")} · {unused.length}
                                    </button>
                                    {unusedOpen && unused.map((station) => (
                                        <button
                                            key={station.station_uuid}
                                            type="button"
                                            onClick={() => openStation(station.station_uuid)}
                                            className="flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-[14px] border border-dashed border-lp-line-2 px-4 py-3 text-left text-[14px] text-lp-ink-3 hover:bg-lp-surface"
                                        >
                                            <span className="font-extrabold">{station.station_name}</span>
                                            <span>{t("stp.unusedQuiet", { date: whenText(station.seat_changed_at, lang, t) })}</span>
                                            <span aria-hidden="true" className="ml-auto">›</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    <div className="flex flex-wrap gap-x-[22px] gap-y-2 text-[13px]">
                        <button type="button" onClick={() => setPanel({ mode: "legend" })} className="border-0 bg-transparent p-0 font-bold text-lp-accent-ink hover:underline">
                            {t("stp.legendLink")}
                        </button>
                        <button type="button" onClick={() => reportInput.current?.click()} className="border-0 bg-transparent p-0 font-bold text-lp-accent-ink hover:underline">
                            {t("stp.uploadReport")}
                        </button>
                        <input
                            ref={reportInput}
                            type="file"
                            accept=".lpr"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) void uploadReport(file);
                            }}
                        />
                    </div>
                </div>

                {panel && (panel.mode !== "station" || selected) && (
                    <StationPanel
                        mode={panel.mode}
                        station={selected}
                        today={selected ? todayById.get(selected.id) ?? null : null}
                        license={license}
                        isAdmin={isAdmin}
                        host={host}
                        onClose={() => setPanel(null)}
                        onChanged={() => refresh()}
                        onCreated={() => refresh()}
                    />
                )}
            </div>
        </div>
    );
}
