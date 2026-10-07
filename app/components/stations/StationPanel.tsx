"use client";

// Right side panel of the Stations page: one station (overview / settings / seat journal),
// the "connect a station" steps, or the legend of station states. Editing happens here,
// never in a modal. The server enforces every seat rule; this panel explains them.

import React, { useEffect, useState } from "react";
import { api, type SeatEvent } from "@/lib/api/client";
import type { LicenseInfo } from "@/lib/api/license";
import { licenseApi } from "@/lib/api/license";
import { useTranslation, type Lang } from "@/lib/i18n";
import { PROBLEMS, stationProblem, type Station, type StationProblem } from "@/lib/stations";
import {
    cx, download, formatNumber, Icon, PROBLEM_TONE, sinceText, TONE_BG, TONE_DOT, TONE_INK, TONE_SOFT, TONE_SYMBOL, whenText, type Tone,
} from "./shared";

export type TodayRow = { labels: number; weight_kg: number; last_at: string | null; last_product: string; hourly: number[] };

type Props = {
    mode: "station" | "add" | "legend";
    station: Station | null;
    today: TodayRow | null;
    license: LicenseInfo | null;
    isAdmin: boolean;
    host: string;
    onClose: () => void;
    onChanged: (message?: string) => void;
    onCreated: (uuid: string) => void;
};

function PanelHeader({ title, number, onClose }: { title: string; number?: string | null; onClose: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-2.5">
            {number && (
                <span className="rounded-[7px] border border-lp-line-2 px-[7px] py-[2px] font-mono text-[13px] font-semibold tabular-nums text-lp-ink-2">{number}</span>
            )}
            <h2 className="m-0 min-w-0 flex-1 text-[18px] font-extrabold text-lp-ink">{title}</h2>
            <button
                type="button"
                onClick={onClose}
                aria-label={t("stp.close")}
                className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-lp-line bg-lp-surface text-lp-ink-2 transition hover:border-lp-line-2 hover:bg-lp-raised"
            >
                <Icon name="close" className="h-4 w-4" />
            </button>
        </div>
    );
}

const primaryButton = "min-h-[42px] rounded-[11px] lp-btn-primary px-4 text-[14px] font-extrabold text-[#fff] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "min-h-[40px] rounded-[10px] border border-lp-line-2 bg-lp-surface px-3.5 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised disabled:cursor-not-allowed disabled:opacity-50";
const linkButton = "border-0 bg-transparent p-0 text-[13px] font-bold text-lp-accent-ink hover:underline";

export default function StationPanel(props: Props) {
    return (
        <aside
            aria-label={props.mode === "station" && props.station ? props.station.station_name : undefined}
            className="flex w-full min-w-0 flex-col overflow-hidden lp-card lg:sticky lg:top-0 lg:max-h-[calc(100vh-60px)] lg:w-[420px] lg:flex-none lg:overflow-y-auto"
        >
            {props.mode === "legend" && <Legend onClose={props.onClose} />}
            {props.mode === "add" && <AddStation {...props} />}
            {props.mode === "station" && props.station && <StationDetails {...props} station={props.station} />}
        </aside>
    );
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function Legend({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const items: { tone: Tone; label: string; text: string }[] = [
        { tone: "ok", label: t("stp.l.ok"), text: t("stp.l.okText") },
        ...PROBLEMS.map((problem) => ({
            tone: PROBLEM_TONE[problem],
            label: t(`stp.p.${problem}.label`, { duration: "" }).trim(),
            text: t(`stp.l.${problem}Text`),
        })),
        { tone: "off" as Tone, label: t("stp.l.released"), text: t("stp.l.releasedText") },
    ];
    return (
        <>
            <div className="border-b border-lp-line px-[18px] py-4">
                <PanelHeader title={t("stp.l.title")} onClose={onClose} />
            </div>
            <div className="flex flex-col gap-3.5 px-[18px] pb-5 pt-4">
                <p className="m-0 text-[14px] text-lp-ink-2">{t("stp.l.intro")}</p>
                {items.map((item) => (
                    <div key={item.label} className="flex flex-col items-start gap-1">
                        <span className={cx("rounded-full px-2.5 py-0.5 text-[12px] font-extrabold", TONE_BG[item.tone])}>
                            {TONE_SYMBOL[item.tone]} {item.label}
                        </span>
                        <span className="text-[14px] text-lp-ink-2">{item.text}</span>
                    </div>
                ))}
                <p className="m-0 rounded-[12px] bg-lp-accent-bg px-3.5 py-3 text-[14px] font-bold text-lp-accent-ink">{t("stp.l.footer")}</p>
            </div>
        </>
    );
}

// ─── Connect a station ───────────────────────────────────────────────────────

// The station client listens for the server's data on this port (ingress.rs).
const STATION_PORT = 5556;

function AddStation({ license, host, onClose, onCreated }: Props) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [ip, setIp] = useState("");
    const [busy, setBusy] = useState(false);
    const [created, setCreated] = useState<{ uuid: string; name: string } | null>(null);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const seats = license?.seats;
    const full = seats != null && seats.limit != null && seats.active >= seats.limit;

    const run = async (operation: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await operation();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    };

    // A 2.0 station gets its identity with the first data the server sends it, so the
    // server needs the station's address; the .lpi file is for the older client.
    const create = () => run(async () => {
        const station = await api.stations.create({ station_name: name.trim(), station_ip: ip.trim(), station_port: STATION_PORT });
        setCreated({ uuid: station.station_uuid, name: name.trim() });
        onCreated(station.station_uuid);
    });
    const send = () => run(async () => {
        if (!created) return;
        await api.stations.sync(created.uuid);
        setSent(true);
    });
    const legacyFile = () => run(async () => {
        if (!created) return;
        download(await api.stations.downloadIdentity(created.uuid), `identity_${created.name.replace(/\s+/g, "_")}.lpi`);
    });

    const step = (n: number, body: React.ReactNode, done = false) => (
        <li className="flex gap-3">
            <span aria-hidden="true" className={cx("flex h-7 w-7 flex-none items-center justify-center rounded-[9px] text-[14px] font-extrabold", done ? "bg-lp-ok-bg text-lp-ok" : "bg-lp-accent-bg text-lp-accent-ink")}>{done ? "✓" : n}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">{body}</div>
        </li>
    );
    const input = "min-h-[42px] rounded-[10px] border border-lp-line-2 bg-lp-surface px-3 text-[14px] text-lp-ink outline-none focus:border-lp-accent disabled:opacity-60";

    return (
        <>
            <div className="border-b border-lp-line px-[18px] py-4">
                <PanelHeader title={t("stp.a.title")} onClose={onClose} />
            </div>
            <ol className="m-0 flex list-none flex-col gap-[18px] p-[18px]">
                {step(1, <>
                    <span className="text-[14px] font-extrabold text-lp-ink">{t("stp.a.step1")}</span>
                    <label htmlFor="add-station-name" className="text-[12px] font-bold text-lp-ink-3">{t("stp.s.name")}</label>
                    <input id="add-station-name" value={name} disabled={created !== null} onChange={(e) => setName(e.target.value)} placeholder={t("stp.a.placeholder")} className={input} />
                    <label htmlFor="add-station-ip" className="text-[12px] font-bold text-lp-ink-3">{t("stp.a.ipLabel")}</label>
                    <input id="add-station-ip" value={ip} disabled={created !== null} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.25" className={cx(input, "font-mono")} />
                    <span className="text-[12px] text-lp-ink-3">{t("stp.a.step1Hint")}</span>
                    {created === null && (
                        <button type="button" disabled={!name.trim() || !ip.trim() || busy} onClick={create} className={cx(primaryButton, "mt-1 self-start")}>
                            {t("stp.a.create")}
                        </button>
                    )}
                </>, created !== null)}
                {step(2, <>
                    <span className="text-[14px] font-extrabold text-lp-ink">{t("stp.a.step2")}</span>
                    <span className="text-[14px] text-lp-ink-2">{t("stp.a.step2Text", { host })}</span>
                </>)}
                {step(3, <>
                    <span className="text-[14px] font-extrabold text-lp-ink">{t("stp.a.step3")}</span>
                    <button type="button" disabled={created === null || busy || sent} onClick={send} className={cx(primaryButton, "self-start")}>
                        {t("stp.a.send")}
                    </button>
                    {sent && <span className="text-[14px] font-bold text-lp-ok">● {t("stp.a.sent", { name: created?.name ?? "" })}</span>}
                    {created !== null && !sent && (
                        <button type="button" onClick={legacyFile} disabled={busy} className="self-start border-0 bg-transparent p-0 text-[13px] font-bold text-lp-accent-ink hover:underline">
                            {t("stp.a.legacyFile")}
                        </button>
                    )}
                </>, sent)}
            </ol>
            {error && <p className="mx-[18px] mb-[18px] mt-0 rounded-[12px] bg-lp-bad-bg px-3.5 py-2.5 text-[13px] font-bold text-lp-bad">■ {t("stp.err", { message: error })}</p>}
            {full && seats && (
                <div className="mx-[18px] mb-[18px] flex flex-col gap-1.5 rounded-[14px] bg-lp-warn-bg p-3.5">
                    <span className="text-[14px] font-extrabold text-lp-warn">▲ {t("stp.a.noSeats", { used: seats.active, limit: seats.limit ?? 0 })}</span>
                    <span className="text-[14px] text-lp-ink">{t("stp.a.noSeatsText")}</span>
                </div>
            )}
        </>
    );
}

// ─── One station ─────────────────────────────────────────────────────────────

function StationDetails({ station, today, license, isAdmin, host, onClose, onChanged }: Props & { station: Station }) {
    const { t, lang } = useTranslation();
    const [tab, setTab] = useState<"overview" | "settings" | "journal">("overview");
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);
    const [dump, setDump] = useState<string | null>(null);

    useEffect(() => {
        setTab("overview");
        setNotice(null);
        setDump(null);
    }, [station.station_uuid]);

    const problem = stationProblem(station);
    const released = (station.seat_state ?? "active") === "released";
    const seats = license?.seats;
    const freeSeat = seats != null && (seats.limit == null || seats.active < seats.limit);

    const run = async (operation: () => Promise<unknown>, done: string, confirmText?: string) => {
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(true);
        setNotice(null);
        try {
            await operation();
            setNotice({ tone: "ok", text: done });
            onChanged(done);
        } catch (e) {
            setNotice({ tone: "bad", text: t("stp.err", { message: e instanceof Error ? e.message : String(e) }) });
        } finally {
            setBusy(false);
        }
    };

    const tabs: { key: typeof tab; label: string }[] = [
        { key: "overview", label: t("stp.tabOverview") },
        { key: "settings", label: t("stp.tabSettings") },
        { key: "journal", label: t("stp.tabJournal") },
    ];

    return (
        <>
            <div className="flex flex-col gap-3 border-b border-lp-line px-[18px] pb-3 pt-4">
                <PanelHeader title={station.station_name} number={station.station_number} onClose={onClose} />
                <div role="tablist" aria-label={t("stp.tabsLabel")} className="flex gap-1 rounded-[11px] bg-lp-bg p-[3px]">
                    {tabs.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            role="tab"
                            aria-selected={tab === item.key}
                            onClick={() => setTab(item.key)}
                            className={cx(
                                "min-h-9 flex-1 rounded-[9px] text-[13px] font-extrabold transition",
                                tab === item.key ? "bg-lp-surface text-lp-ink shadow-sm" : "text-lp-ink-3 hover:text-lp-ink",
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {notice && (
                <p className={cx("mx-[18px] mb-0 mt-4 rounded-[12px] px-3.5 py-2.5 text-[14px] font-bold", TONE_BG[notice.tone])}>
                    {TONE_SYMBOL[notice.tone]} {notice.text}
                </p>
            )}

            {tab === "overview" && (
                <div className="flex flex-col gap-4 px-[18px] pb-5 pt-4">
                    <Callout
                        station={station}
                        problem={problem}
                        released={released}
                        freeSeat={freeSeat}
                        license={license}
                        isAdmin={isAdmin}
                        busy={busy}
                        host={host}
                        run={run}
                    />
                    <Facts station={station} problem={problem} released={released} today={today} />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <button
                            type="button"
                            disabled={busy || problem !== null || released}
                            onClick={() => run(() => api.stations.sync(station.station_uuid), t("stp.sent"))}
                            className={secondaryButton}
                        >
                            {t("stp.sendNow")}
                        </button>
                    </div>
                    {(problem !== null || released) && (
                        <span className="-mt-2 text-[12px] text-lp-ink-3">{problem === "offline" ? t("stp.sendOffline") : t("stp.sendBlocked")}</span>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-lp-line pt-3.5 text-[13px]">
                        <span className="text-lp-ink-3">{t("stp.offlineFiles")}</span>
                        <button
                            type="button"
                            className={linkButton}
                            onClick={() => run(async () => download(await api.stations.downloadIdentity(station.station_uuid), `identity_${station.station_name.replace(/\s+/g, "_")}.lpi`), t("stp.downloaded"))}
                        >
                            {t("stp.fileIdentity")}
                        </button>
                        <button
                            type="button"
                            className={linkButton}
                            disabled={problem !== null && problem !== "offline"}
                            onClick={() => run(async () => download(await api.stations.downloadUpdate(station.station_uuid), `update_${station.station_name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.lps`), t("stp.downloaded"))}
                        >
                            {t("stp.filePackage")}
                        </button>
                        <button
                            type="button"
                            className={cx(linkButton, "text-lp-ink-3")}
                            onClick={async () => {
                                if (dump) return setDump(null);
                                try {
                                    setDump(JSON.stringify(await api.stations.getFullDump(station.station_uuid), null, 2));
                                } catch (e) {
                                    setNotice({ tone: "bad", text: t("stp.err", { message: e instanceof Error ? e.message : String(e) }) });
                                }
                            }}
                        >
                            {dump ? t("stp.hideTech") : t("stp.techData")}
                        </button>
                    </div>
                    {dump && (
                        <pre className="max-h-72 overflow-auto rounded-[12px] bg-lp-raised p-3 font-mono text-[11px] text-lp-ink-2">{dump}</pre>
                    )}
                </div>
            )}

            {tab === "settings" && (
                <Settings station={station} isAdmin={isAdmin} license={license} busy={busy} run={run} onDeleted={onClose} />
            )}

            {tab === "journal" && <Journal station={station} lang={lang} />}
        </>
    );
}

function Callout({ station, problem, released, freeSeat, license, isAdmin, busy, host, run }: {
    station: Station; problem: StationProblem | null; released: boolean; freeSeat: boolean; license: LicenseInfo | null;
    isAdmin: boolean; busy: boolean; host: string;
    run: (operation: () => Promise<unknown>, done: string, confirmText?: string) => void;
}) {
    const { t } = useTranslation();
    if (!problem && !released) return null;
    const tone: Tone = problem ? PROBLEM_TONE[problem] : "off";
    let title = "";
    let why = "";
    let checks: string[] = [];
    let action: React.ReactNode = null;
    let note = "";
    const adminOnly = <span className="text-[13px] text-lp-ink-2">{t("stp.adminOnly")}</span>;

    switch (problem) {
        case "conflict":
            title = t("stp.c.conflict.title");
            why = t("stp.c.conflict.why", {
                new: (station.conflict_fingerprint ?? "").slice(0, 8).toUpperCase(),
                old: (station.station_fingerprint ?? "").slice(0, 8).toUpperCase(),
            });
            note = t("stp.c.conflict.note");
            action = isAdmin ? (
                <button type="button" disabled={busy} className={cx(primaryButton, "self-start")}
                    onClick={() => run(() => api.stations.replaceHardware(station.station_uuid), t("stp.done.replace"), t("seats.confirmReplace", { name: station.station_name }))}>
                    {t("stp.c.conflict.action")}
                </button>
            ) : adminOnly;
            break;
        case "outside_cap":
            title = t("stp.c.outside_cap.title");
            why = t("stp.c.outside_cap.why");
            break;
        case "unlisted": {
            title = t("stp.c.unlisted.title");
            why = t("stp.c.unlisted.why");
            const canSync = license?.seat_list?.sync_enabled;
            if (!isAdmin) action = adminOnly;
            else if (canSync) {
                action = (
                    <button type="button" disabled={busy} className={cx(primaryButton, "self-start")}
                        onClick={() => run(() => licenseApi.syncSeatList(), t("stp.done.sync"))}>
                        {t("stp.c.unlisted.action")}
                    </button>
                );
            } else note = t("stp.c.unlisted.noSync");
            break;
        }
        case "pending":
            title = t("stp.c.pending.title");
            why = freeSeat ? t("stp.c.pending.whyFree") : t("stp.c.pending.whyFull");
            if (freeSeat) {
                action = isAdmin ? (
                    <button type="button" disabled={busy} className={cx(primaryButton, "self-start")}
                        onClick={() => run(() => api.stations.activateSeat(station.station_uuid), t("stp.done.activate"))}>
                        {t("stp.c.pending.action")}
                    </button>
                ) : adminOnly;
            }
            break;
        case "offline":
            title = t("stp.c.offline.title", { duration: sinceText(station.changed_at, t) });
            why = t("stp.c.offline.why");
            checks = [t("stp.c.offline.check1"), t("stp.c.offline.check2", { host }), t("stp.c.offline.check3")];
            break;
        default:
            title = t("stp.c.released.title");
            why = t("stp.c.released.why");
    }

    return (
        <div className={cx("flex flex-col gap-2 rounded-[14px] p-3.5", TONE_SOFT[tone])}>
            <span className={cx("text-[14px] font-extrabold", TONE_INK[tone])}>{TONE_SYMBOL[tone]} {title}</span>
            <span className="text-[14px] text-lp-ink">{why}</span>
            {checks.length > 0 && (
                <ol className="m-0 flex flex-col gap-1 pl-5 text-[14px] text-lp-ink-2">
                    {checks.map((check) => <li key={check}>{check}</li>)}
                </ol>
            )}
            {action}
            {note && <span className="text-[13px] text-lp-ink-2">{note}</span>}
        </div>
    );
}

function Facts({ station, problem, released, today }: { station: Station; problem: StationProblem | null; released: boolean; today: TodayRow | null }) {
    const { t, lang } = useTranslation();
    const seat = station.seat_state ?? "active";
    const link: [string, Tone | null] = problem === "conflict"
        ? [t("stp.f.linkConflict"), "bad"]
        : station.is_online
            ? [t("stp.f.linkOk"), null]
            : [t("stp.f.linkOff", { time: whenText(station.changed_at, lang, t) }), problem === "offline" ? "warn" : null];
    const seatText: [string, Tone | null] = released
        ? [t("stp.f.seatReleased"), null]
        : seat === "pending"
            ? [t("stp.f.seatPending"), "warn"]
            : problem === "outside_cap"
                ? [t("stp.f.seatOutside"), "bad"]
                : problem === "unlisted"
                    ? [t("stp.f.seatUnlisted"), "warn"]
                    : [t("stp.f.seatActive"), null];
    const data: [string, Tone | null] = problem && problem !== "offline"
        ? [t("stp.f.dataBlocked"), PROBLEM_TONE[problem]]
        : station.last_sync_at
            ? [t("stp.f.dataSent", { time: whenText(station.last_sync_at, lang, t) }), null]
            : [t("stp.f.dataNever"), null];
    const todayText = today && today.labels > 0
        ? t("stp.f.todayValue", { labels: formatNumber(today.labels, lang), kg: formatNumber(today.weight_kg, lang, 1) })
        : t("stp.f.todayNone");
    const rows: { k: string; v: string; tone: Tone | null; mono?: boolean }[] = [
        { k: t("stp.f.link"), v: link[0], tone: link[1] },
        { k: t("stp.f.seat"), v: seatText[0], tone: seatText[1] },
        { k: t("stp.f.data"), v: data[0], tone: data[1] },
        { k: t("stp.f.today"), v: todayText, tone: null },
        { k: t("stp.f.address"), v: station.station_ip ? `${station.station_ip}:${station.station_port}` : "—", tone: null, mono: true },
    ];
    return (
        <dl className="m-0 flex flex-col gap-2.5">
            {rows.map((row) => (
                <div key={row.k} className="flex justify-between gap-3 text-[14px]">
                    <dt className="text-lp-ink-2">{row.k}</dt>
                    <dd className={cx("m-0 text-right font-bold tabular-nums", row.tone ? TONE_INK[row.tone] : "text-lp-ink", row.mono && "font-mono font-semibold")}>{row.v}</dd>
                </div>
            ))}
        </dl>
    );
}

function Settings({ station, isAdmin, license, busy, run, onDeleted }: {
    station: Station; isAdmin: boolean; license: LicenseInfo | null; busy: boolean;
    run: (operation: () => Promise<unknown>, done: string, confirmText?: string) => void; onDeleted: () => void;
}) {
    const { t } = useTranslation();
    const [name, setName] = useState(station.station_name);
    const [ip, setIp] = useState(station.station_ip ?? "");
    const [port, setPort] = useState(String(station.station_port ?? 5000));
    useEffect(() => {
        setName(station.station_name);
        setIp(station.station_ip ?? "");
        setPort(String(station.station_port ?? 5000));
    }, [station.station_uuid]); // eslint-disable-line react-hooks/exhaustive-deps
    const dirty = name !== station.station_name || ip !== (station.station_ip ?? "") || port !== String(station.station_port ?? 5000);
    const seats = license?.seats;
    const seated = (station.seat_state ?? "active") === "active";

    const field = (id: string, label: string, value: string, set: (v: string) => void, mono = false) => (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-[13px] font-extrabold text-lp-ink">{label}</label>
            <input
                id={id}
                value={value}
                onChange={(e) => set(e.target.value)}
                className={cx("min-h-[42px] rounded-[10px] border border-lp-line-2 bg-lp-surface px-3 text-[14px] text-lp-ink outline-none focus:border-lp-accent", mono && "font-mono")}
            />
        </div>
    );

    return (
        <div className="flex flex-col gap-3.5 px-[18px] pb-5 pt-4">
            {field("station-name", t("stp.s.name"), name, setName)}
            {field("station-ip", t("stp.s.ip"), ip, setIp, true)}
            {field("station-port", t("stp.s.port"), port, setPort, true)}
            <button
                type="button"
                disabled={!dirty || !name.trim() || busy}
                className={cx(primaryButton, "self-start")}
                onClick={() => run(() => api.stations.update(station.station_uuid, {
                    station_name: name.trim(), station_ip: ip.trim() || null, station_port: parseInt(port, 10) || 5000,
                }), t("stp.s.saved"))}
            >
                {t("stp.s.save")}
            </button>
            {isAdmin && (
                <div className="mt-1.5 flex flex-col items-start gap-3 border-t border-lp-line pt-4">
                    {seated && (
                        <>
                            <button type="button" disabled={busy} className={secondaryButton}
                                onClick={() => run(() => api.stations.releaseSeat(station.station_uuid), t("stp.s.releasedDone"), t("seats.confirmRelease", { name: station.station_name }))}>
                                {t("stp.s.release")}
                            </button>
                            <span className="-mt-1.5 text-[13px] text-lp-ink-2">
                                {seats?.release_allowance != null
                                    ? t("stp.s.releaseHint", { used: seats.releases_30d, allowance: seats.release_allowance })
                                    : t("stp.s.releaseHintNoLimit")}
                            </span>
                        </>
                    )}
                    <button
                        type="button"
                        disabled={busy}
                        className="min-h-[40px] rounded-[10px] border border-lp-bad bg-lp-bad-bg px-3.5 text-[14px] font-extrabold text-lp-bad transition hover:brightness-95 disabled:opacity-50"
                        onClick={() => run(async () => { await api.stations.delete(station.station_uuid); onDeleted(); }, t("stp.s.deletedDone"), t("stp.s.confirmDelete", { name: station.station_name }))}
                    >
                        {t("stp.s.delete")}
                    </button>
                    <span className="-mt-1.5 text-[13px] text-lp-ink-2">{t("stp.s.deleteHint")}</span>
                </div>
            )}
        </div>
    );
}

const EVENT_TONE: Record<string, Tone> = {
    assigned: "ok", pending: "warn", released: "off", deleted: "off",
    fingerprint_bound: "ok", fingerprint_conflict: "bad", hardware_replaced: "ok",
};

function Journal({ station, lang }: { station: Station; lang: Lang }) {
    const { t } = useTranslation();
    const [events, setEvents] = useState<SeatEvent[] | null>(null);
    useEffect(() => {
        let alive = true;
        api.stations.seatEvents()
            .then((all) => { if (alive) setEvents(all.filter((e) => e.station_uuid === station.station_uuid)); })
            .catch(() => { if (alive) setEvents([]); });
        return () => { alive = false; };
    }, [station.station_uuid]);

    if (events === null) return <p className="px-[18px] py-4 text-[14px] text-lp-ink-3">…</p>;
    if (events.length === 0) return <p className="px-[18px] py-4 text-[14px] text-lp-ink-3">{t("stp.j.empty")}</p>;
    return (
        <div className="flex flex-col">
            {events.map((event, i) => {
                const tone = EVENT_TONE[event.event] ?? "off";
                return (
                    <div key={`${event.created_at}-${i}`} className="flex gap-3 border-b border-lp-line px-[18px] py-3 last:border-0">
                        <span className={cx("mt-[7px] h-2 w-2 flex-none rounded-full", TONE_DOT[tone])} />
                        <div className="flex min-w-0 flex-col">
                            <span className="text-[14px] font-bold text-lp-ink">{t(`stp.j.${event.event}`)}</span>
                            <span className="text-[12px] tabular-nums text-lp-ink-3">
                                {whenText(event.created_at, lang, t)} · {event.actor || t("stp.j.system")}
                            </span>
                        </div>
                    </div>
                );
            })}
            <p className="m-0 px-[18px] pb-4 pt-3 text-[13px] text-lp-ink-3">{t("stp.j.hint")}</p>
        </div>
    );
}
