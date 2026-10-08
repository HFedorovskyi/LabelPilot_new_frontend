"use client";

// «Лицензия»: one status card that says what the licence lets the plant do now and the one
// thing to do (renew, buy, re-bind, nothing), with the seat meter; then the vendor seat list
// (licences with "seat-list"), the licence file, this server's code and the details, folded.
// Past the grace period only NEW data stops — stations keep printing (EU: no kill switch).

import React, { useCallback, useEffect, useState } from "react";
import { licenseApi, type LicenseInfo } from "@/lib/api/license";
import { useTranslation } from "@/lib/i18n";
import { copyText } from "@/lib/clipboard";
import { useAuth } from "@/app/components/auth/AuthProvider";
import PageTitle from "@/app/components/shell/PageTitle";
import type { NavKey } from "@/app/components/shell/Sidebar";
import { cx } from "@/app/components/stations/shared";
import { linkButton, primaryButton } from "@/app/components/print/shared";

const CABINET = "https://labelpilot.tech/account";
const BUY = "https://labelpilot.tech/account/buy";
const ghost = "inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-[10px] border border-lp-line-2 bg-lp-surface px-3.5 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised disabled:cursor-not-allowed disabled:opacity-50";
const SEAT_LIST_REJECT = ["too_many_stations", "release_limit", "server_link", "install"];

type Kind = "active" | "expiring" | "grace" | "expired" | "demo" | "foreign" | "invalid";
type Tone = "ok" | "warn" | "bad" | "info";
type Flash = { ok: boolean; text: string };

const Svg = ({ children, className = "h-5 w-5" }: { children: React.ReactNode; className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cx("flex-none", className)} aria-hidden="true">{children}</svg>
);
const ICONS: Record<Tone, React.ReactNode> = {
    ok: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>,
    warn: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    bad: <><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></>,
    info: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
};
const TONE_TILE: Record<Tone, string> = {
    ok: "bg-lp-g-sys/[0.13] text-lp-g-sys",
    warn: "bg-lp-warn-bg text-lp-warn",
    bad: "bg-lp-bad-bg text-lp-bad",
    info: "bg-lp-accent-bg text-lp-accent-ink",
};
const KIND_TONE: Record<Kind, Tone> = { active: "ok", expiring: "warn", grace: "warn", expired: "bad", demo: "info", foreign: "warn", invalid: "bad" };

// "Проверено сегодня в 06:10: лицензия актуальна" — the result sentence follows a colon.
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function kindOf(info: LicenseInfo): Kind {
    if (info.mode === "demo") return info.license_file === "foreign" ? "foreign" : info.license_file === "invalid" ? "invalid" : "demo";
    if (info.expired) return info.grace ? "grace" : "expired";
    return info.expires && info.days_left != null && info.days_left <= 30 ? "expiring" : "active";
}

export default function LicensePage({ onNavigate }: { onNavigate?: (key: NavKey) => void }) {
    const { t, lang } = useTranslation();
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const [info, setInfo] = useState<LicenseInfo | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [busy, setBusy] = useState<"" | "file" | "check" | "sync" | "request" | "list">("");
    const [flash, setFlash] = useState<Flash | null>(null);
    const [offline, setOffline] = useState(false);
    const [details, setDetails] = useState(false);

    const load = useCallback(() => {
        licenseApi.get().then((d) => { setInfo(d); setLoadFailed(false); }).catch(() => setLoadFailed(true));
    }, []);
    useEffect(load, [load]);

    const date = (iso: string | null | undefined) => {
        if (!iso) return "";
        const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
        return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" });
    };
    const stamp = (iso: string) => {
        const d = new Date(iso);
        const today = new Date().toDateString() === d.toDateString();
        const time = d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
        return today ? t("lic.todayAt", { time }) : `${date(iso)}, ${time}`;
    };

    const run = async (what: typeof busy, action: () => Promise<Flash | void>) => {
        setBusy(what);
        setFlash(null);
        try {
            const result = await action();
            if (result) setFlash(result);
        } catch (e) {
            setFlash({ ok: false, text: e instanceof Error && e.message ? e.message : t("lic.failed") });
        } finally {
            setBusy("");
        }
    };

    const importLicence = (file: File | undefined) => file && void run("file", async () => {
        const updated = await licenseApi.importLicense(file);
        setInfo(updated);
        return { ok: true, text: t("lic.imported", { edition: updated.edition || "", limit: updated.max_stations ?? "∞", date: updated.expires ? date(updated.expires) : t("lic.perpetual") }) };
    });
    const checkRenewal = () => void run("check", async () => {
        const updated = await licenseApi.refreshLicense();
        setInfo(updated);
        const status = updated.refresh?.status ?? "unavailable";
        return { ok: status === "updated" || status === "current", text: t(`lic.refresh.${status}`) };
    });
    const syncList = () => void run("sync", async () => {
        const updated = await licenseApi.syncSeatList();
        setInfo(updated);
        const result = updated.seat_list_sync;
        if (!result) return;
        if (result.status === "updated") return { ok: true, text: t("lic.list.synced", { count: updated.seat_list?.stations ?? 0, date: date(updated.seat_list?.expires) }) };
        if (result.status === "rejected") return { ok: false, text: t(`lic.list.reject.${SEAT_LIST_REJECT.includes(result.detail) ? result.detail : "install"}`) };
        return { ok: false, text: t(`lic.list.sync.${result.status}`) };
    });
    const downloadRequest = () => void run("request", async () => {
        await licenseApi.downloadSeatListRequest();
        return { ok: true, text: t("lic.list.requestSaved") };
    });
    const importList = (file: File | undefined) => file && void run("list", async () => {
        setInfo(await licenseApi.importSeatList(file));
        return { ok: true, text: t("lic.list.imported") };
    });
    const copyCode = async () => {
        if (!info?.machine_id) return;
        setFlash(await copyText(info.machine_id) ? { ok: true, text: t("lic.codeCopied") } : { ok: false, text: t("lic.copyFailed") });
    };

    if (!info) {
        return (
            <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
                <PageTitle icon="license" eyebrow={t("nav.groupSystem")} title={t("nav.license")} />
                <p className={cx("lp-card m-0 p-7 text-center text-[14px]", loadFailed ? "font-bold text-lp-bad" : "text-lp-ink-3")}>{loadFailed ? t("lic.loadFailed") : t("lic.loading")}</p>
            </div>
        );
    }

    const kind = kindOf(info);
    const tone = KIND_TONE[kind];
    const expiry = date(info.expires);
    const hero: Record<Kind, { kicker: string; big: string; sub: string }> = {
        active: {
            kicker: t("lic.k.active"),
            big: info.expires ? t("lic.big.until", { date: expiry }) : t("lic.perpetual"),
            sub: [info.edition, info.customer].filter(Boolean).join(" · ") + (info.expires ? `. ${t("lic.sub.autoRenew")}` : ""),
        },
        expiring: { kicker: t("lic.k.expiring"), big: t("lic.big.inDays", { days: info.days_left ?? 0, date: expiry }), sub: t("lic.sub.renew") },
        grace: { kicker: t("lic.k.grace", { date: expiry }), big: t("lic.big.graceUntil", { date: date(info.grace_until) }), sub: t("lic.sub.grace", { date: date(info.grace_until) }) },
        expired: { kicker: t("lic.k.expired", { date: expiry }), big: t("lic.big.noNewData"), sub: t("lic.sub.expired") },
        demo: { kicker: t("lic.k.demo"), big: t("lic.big.demo"), sub: t("lic.sub.demo") },
        foreign: { kicker: t("lic.k.foreign"), big: t("lic.big.foreign"), sub: t("lic.sub.foreign") },
        invalid: { kicker: t("lic.k.invalid"), big: t("lic.big.invalid"), sub: t("lic.sub.invalid") },
    };
    const h = hero[kind];
    const unlicensed = kind === "demo" || kind === "foreign" || kind === "invalid";
    // The status card carries these buttons in some states; the licence file card then does not repeat them.
    const heroUpload = kind === "expired" || unlicensed;
    const heroCheck = kind === "expiring" || kind === "grace";

    // ── seat meter ──
    const seats = info.seats;
    const limit = seats?.limit ?? info.max_stations ?? null;
    const used = seats?.active ?? info.stations_used;
    const cells = limit != null && limit > 0 && limit <= 24 ? limit : 0;

    // ── seat list ──
    const list = info.seat_list?.required ? info.seat_list : null;
    const listState = !list ? null
        : !list.present ? { tone: "bad", text: t("lic.list.none") }
            : list.expired ? { tone: "bad", text: t("lic.list.expired", { date: date(list.expires) }) }
                : list.missing > 0 ? { tone: "warn", text: t("lic.list.missing", { count: list.missing }) }
                    : list.renewal_due ? { tone: "warn", text: t("lic.list.renewal", { days: list.days_left ?? 0 }) }
                        : { tone: "ok", text: list.limit == null ? t("lic.list.okUnlimited", { count: list.stations }) : t("lic.list.ok", { count: list.stations, limit: list.limit }) };

    const refreshLast = info.refresh_last;
    const features = (info.features ?? []).map((f) => (f === "seat-list" ? t("lic.feature.seatList") : f));

    const fileInput = (onFile: (file: File | undefined) => void, accept: string, label: string, disabled: boolean, className = ghost) => (
        <label className={cx(className, disabled && "pointer-events-none opacity-50")}>
            {label}
            <input type="file" accept={accept} className="sr-only" disabled={disabled} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
    );

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
            <PageTitle
                icon="license"
                eyebrow={t("nav.groupSystem")}
                title={t("nav.license")}
                description={<>{t("lic.lead")} <a href={CABINET} target="_blank" rel="noopener noreferrer" className={cx(linkButton, "text-[14px]")}>{t("lic.cabinet")} ↗</a>.</>}
            />

            {info.clock_rollback && (
                <div role="alert" className="flex items-start gap-3 rounded-[16px] bg-lp-bad-bg px-4 py-3.5 text-[14px] font-bold text-lp-bad">
                    <Svg className="mt-px h-[18px] w-[18px]">{ICONS.bad}</Svg>
                    <span>{t("lic.clockBack")}</span>
                </div>
            )}

            <section aria-labelledby="lic-state" className="lp-card grid items-center gap-[22px] p-[22px] lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="flex min-w-0 items-start gap-[18px]">
                    <span className={cx("flex h-14 w-14 flex-none items-center justify-center rounded-[18px]", TONE_TILE[tone])}><Svg className="h-[26px] w-[26px]">{ICONS[tone]}</Svg></span>
                    <div className="flex min-w-0 flex-col gap-1">
                        <span id="lic-state" className="text-[13px] font-extrabold text-lp-ink-3">{h.kicker}</span>
                        <span className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.025em] text-lp-ink">{h.big}</span>
                        <span className="max-w-[620px] text-[14px] text-lp-ink-2">{h.sub}</span>
                        {unlicensed && (
                            <ol className="m-0 mt-1 flex list-none flex-col gap-2.5 p-0">
                                {kind === "demo" && (
                                    <li className="flex items-start gap-3 text-[14px] text-lp-ink-2"><span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-lp-accent-bg text-[13px] font-extrabold text-lp-accent-ink">1</span><span>{t("lic.step.buy")}</span></li>
                                )}
                                <li className="flex items-start gap-3 text-[14px] text-lp-ink-2">
                                    <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-lp-accent-bg text-[13px] font-extrabold text-lp-accent-ink">{kind === "demo" ? 2 : 1}</span>
                                    <span>{t("lic.step.bind")} <code className="rounded-[8px] bg-lp-ink/[0.05] px-2 py-0.5 font-mono text-[13px] font-semibold text-lp-ink">{info.machine_id}</code> <button type="button" onClick={() => void copyCode()} className={cx(linkButton, "text-[14px]")}>{t("lic.copy")}</button></span>
                                </li>
                                <li className="flex items-start gap-3 text-[14px] text-lp-ink-2"><span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-lp-accent-bg text-[13px] font-extrabold text-lp-accent-ink">{kind === "demo" ? 3 : 2}</span><span>{t("lic.step.upload")}</span></li>
                            </ol>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-2.5">
                            {(kind === "expiring" || kind === "grace" || kind === "expired") && (
                                <a href={CABINET} target="_blank" rel="noopener noreferrer" className={cx(primaryButton, "inline-flex items-center")}>{t("lic.renew")} ↗</a>
                            )}
                            {kind === "demo" && <a href={BUY} target="_blank" rel="noopener noreferrer" className={cx(primaryButton, "inline-flex items-center")}>{t("lic.buy")} ↗</a>}
                            {kind === "foreign" && <a href={CABINET} target="_blank" rel="noopener noreferrer" className={cx(primaryButton, "inline-flex items-center")}>{t("lic.rebind")} ↗</a>}
                            {isAdmin && (kind === "expired" || unlicensed) && fileInput(importLicence, ".lpl", busy === "file" ? t("lic.uploading") : t("lic.uploadFile"), !!busy)}
                            {isAdmin && (kind === "expiring" || kind === "grace") && (
                                <button type="button" disabled={!!busy} onClick={checkRenewal} className={ghost}>{busy === "check" ? t("lic.checking") : t("lic.checkRenewal")}</button>
                            )}
                        </div>
                    </div>
                </div>

                <div aria-label={t("lic.seats")} className="flex flex-col gap-2 rounded-[18px] border border-lp-line bg-lp-raised p-4">
                    <span className="text-[13px] font-extrabold text-lp-ink-3">{t("lic.seats")}</span>
                    <span className="text-[28px] font-extrabold tracking-[-0.02em] text-lp-ink tabular-nums">
                        {used}
                        <span className="ml-1.5 text-[14px] font-bold tracking-normal text-lp-ink-3">{limit != null ? t("lic.seatsOf", { limit }) : t("lic.seatsUnlimited")}</span>
                    </span>
                    {cells > 0 ? (
                        <div className="flex gap-[5px]" aria-hidden="true">
                            {Array.from({ length: cells }, (_, i) => <span key={i} className={cx("h-2.5 flex-1 rounded-[4px]", i < used ? "bg-gradient-to-r from-[#5fd3b4] to-[#0e8a6c]" : "bg-lp-ink/[0.08]")} />)}
                        </div>
                    ) : limit != null && limit > 0 ? (
                        <div className="h-2.5 overflow-hidden rounded-full bg-lp-ink/[0.08]" aria-hidden="true"><span className="block h-full rounded-full bg-gradient-to-r from-[#5fd3b4] to-[#0e8a6c]" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} /></div>
                    ) : null}
                    {(seats?.outside_cap ?? 0) > 0 && <span className="text-[13px] font-bold text-lp-bad">{t("lic.outsideCap", { count: seats!.outside_cap! })}</span>}
                    {(seats?.pending ?? 0) > 0 && <span className="text-[13px] font-bold text-lp-warn">{t("lic.pending", { count: seats!.pending })}</span>}
                    {kind === "expired" && <span className="text-[13px] font-bold text-lp-warn">{t("lic.noNewStations")}</span>}
                    <span className="text-[13px] font-bold text-lp-ink-3">
                        {seats?.release_allowance != null && <>{t("lic.released", { used: seats.releases_30d, allowance: seats.release_allowance })} · </>}
                        <button type="button" onClick={() => onNavigate?.("stations")} className={cx(linkButton, "text-[13px]")}>{t("nav.stations")}</button>
                    </span>
                </div>
            </section>

            {flash && (
                <p role="status" className={cx("m-0 flex items-start gap-2 text-[14px] font-bold", flash.ok ? "text-lp-ok" : "text-lp-bad")}>
                    <span aria-hidden="true">{flash.ok ? "●" : "■"}</span>
                    <span>{flash.text}</span>
                </p>
            )}

            <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-3.5">
                    {list && listState && (
                        <section aria-labelledby="lic-list" className="lp-card flex flex-col gap-2.5 p-[18px]">
                            <h2 id="lic-list" className="m-0 text-[16px] font-extrabold text-lp-ink">{t("lic.list.title")}</h2>
                            <p className="m-0 text-[13px] text-lp-ink-3">{t("lic.list.lead")}</p>
                            <span className={cx("text-[14px] font-bold", listState.tone === "ok" ? "text-lp-ok" : listState.tone === "warn" ? "text-lp-warn" : "text-lp-bad")}>
                                {listState.tone === "ok" ? "● " : "▲ "}{listState.text}
                            </span>
                            {list.present && (
                                <span className="text-[13px] font-semibold text-lp-ink-3">
                                    {t("lic.list.validUntil", { date: date(list.expires) })}
                                    {list.last_sync?.at && <> · {t("lic.list.lastSync", { when: stamp(list.last_sync.at) })}</>}
                                </span>
                            )}
                            {isAdmin && (
                                <div className="flex flex-wrap items-center gap-2.5">
                                    {list.sync_enabled && <button type="button" disabled={!!busy} onClick={syncList} className={ghost}>{busy === "sync" ? t("lic.list.syncing") : t("lic.list.sync")}</button>}
                                    <button type="button" aria-expanded={offline} onClick={() => setOffline(!offline)} className={cx(linkButton, "text-[14px]")}>{t("lic.list.offline")}</button>
                                </div>
                            )}
                            {isAdmin && offline && (
                                <div className="flex flex-col gap-2 rounded-[14px] border border-lp-line bg-lp-raised px-3.5 py-3">
                                    <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-[14px] text-lp-ink-2">
                                        <li>{t("lic.list.off1")} <button type="button" disabled={!!busy} onClick={downloadRequest} className={cx(linkButton, "text-[14px]")}>{t("lic.list.download")}</button></li>
                                        <li>{t("lic.list.off2")}</li>
                                        <li>{t("lic.list.off3")} {fileInput(importList, ".lst", busy === "list" ? t("lic.uploading") : t("lic.list.upload"), !!busy, cx(linkButton, "inline cursor-pointer text-[14px]"))}</li>
                                    </ol>
                                </div>
                            )}
                        </section>
                    )}

                    <section aria-labelledby="lic-file" className="lp-card flex flex-col gap-2.5 p-[18px]">
                        <h2 id="lic-file" className="m-0 text-[16px] font-extrabold text-lp-ink">{t("lic.file.title")}</h2>
                        <p className="m-0 text-[13px] text-lp-ink-3">{t("lic.file.lead")}</p>
                        {refreshLast && !unlicensed ? (
                            <span className={cx("text-[14px] font-bold", refreshLast.status === "updated" || refreshLast.status === "current" ? "text-lp-ok" : "text-lp-ink-2")}>
                                {refreshLast.status === "updated" || refreshLast.status === "current" ? "● " : ""}{t("lic.file.checked", { when: stamp(refreshLast.at), result: lowerFirst(t(`lic.refresh.${refreshLast.status}`)) })}
                            </span>
                        ) : (
                            <span className="text-[14px] font-bold text-lp-ink-2">{unlicensed ? t("lic.file.none") : t("lic.file.notChecked")}</span>
                        )}
                        {isAdmin ? (
                            (!heroUpload || !heroCheck) && (
                                <div className="flex flex-wrap items-center gap-2.5">
                                    {!heroUpload && fileInput(importLicence, ".lpl", busy === "file" ? t("lic.uploading") : t("lic.file.upload"), !!busy)}
                                    {!unlicensed && !heroCheck && <button type="button" disabled={!!busy} onClick={checkRenewal} className={ghost}>{busy === "check" ? t("lic.checking") : t("lic.checkRenewal")}</button>}
                                </div>
                            )
                        ) : (
                            <span className="text-[13px] text-lp-ink-3">{t("lic.adminOnly")}</span>
                        )}
                    </section>
                </div>

                <div className="flex flex-col gap-3.5">
                    <section aria-labelledby="lic-code" className="lp-card flex flex-col gap-2.5 p-[18px]">
                        <h2 id="lic-code" className="m-0 text-[16px] font-extrabold text-lp-ink">{t("lic.code.title")}</h2>
                        <p className="m-0 text-[13px] text-lp-ink-3">{t("lic.code.lead")}</p>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <code className="min-w-0 break-all rounded-[8px] bg-lp-ink/[0.05] px-2.5 py-1.5 font-mono text-[14px] font-semibold text-lp-ink">{info.machine_id || "—"}</code>
                            <button type="button" onClick={() => void copyCode()} className={cx(linkButton, "text-[14px]")}>{t("lic.copy")}</button>
                        </div>
                    </section>

                    {!unlicensed && (
                        <section className="lp-card flex flex-col gap-2.5 p-[18px]">
                            <button type="button" aria-expanded={details} onClick={() => setDetails(!details)} className="flex w-fit items-center gap-1.5 text-[16px] font-extrabold text-lp-ink">
                                <Svg className={cx("h-4 w-4 transition-transform", details && "rotate-90")}><path d="M9 6l6 6-6 6" /></Svg>
                                {t("lic.details")}
                            </button>
                            {details && (
                                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[14px]">
                                    <dt className="font-bold text-lp-ink-3">{t("lic.d.number")}</dt><dd className="m-0 font-mono font-semibold">{info.license_id ?? "—"}</dd>
                                    <dt className="font-bold text-lp-ink-3">{t("lic.d.owner")}</dt><dd className="m-0 font-extrabold">{info.customer ?? "—"}</dd>
                                    <dt className="font-bold text-lp-ink-3">{t("lic.d.edition")}</dt><dd className="m-0 font-extrabold">{info.edition || "—"}</dd>
                                    <dt className="font-bold text-lp-ink-3">{t("lic.d.features")}</dt><dd className="m-0 font-extrabold">{features.length ? features.join(", ") : "—"}</dd>
                                    <dt className="font-bold text-lp-ink-3">{t("lic.d.signature")}</dt><dd className={cx("m-0 font-extrabold", info.signature_valid ? "text-lp-ok" : "text-lp-bad")}>{info.signature_valid ? `● ${t("lic.d.signatureOk")}` : `■ ${t("lic.d.signatureBad")}`}</dd>
                                    <dt className="font-bold text-lp-ink-3">{t("lic.d.binding")}</dt><dd className={cx("m-0 font-extrabold", info.machine_ok ? "text-lp-ok" : "text-lp-bad")}>{info.machine_ok ? `● ${t("lic.d.bindingOk")}` : `■ ${t("lic.d.bindingBad")}`}</dd>
                                </dl>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
