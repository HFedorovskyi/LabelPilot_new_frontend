"use client";

// «Настройки»: the server update is the one focal card (a newer version, the running update,
// or why it cannot be checked); then the backups with an honest rollback, the interface
// language and the facts support asks for. The licence has its own page. Everything goes
// through the server (lib/api/system.ts): only administrators start updates, rollbacks and
// backups, from any computer.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { systemApi, type Backup, type UpdateCheck, type UpdateProgress } from "@/lib/api/system";
import { LANGS, LANG_LABELS, useTranslation } from "@/lib/i18n";
import { copyText } from "@/lib/clipboard";
import { useAuth } from "@/app/components/auth/AuthProvider";
import PageTitle from "@/app/components/shell/PageTitle";
import type { NavKey } from "@/app/components/shell/Sidebar";
import { cx } from "@/app/components/stations/shared";
import { dangerLink, linkButton, primaryButton } from "@/app/components/print/shared";

type Op = "update" | "file" | "restore" | "resume";
type Flash = { ok: boolean; text: string; reload?: boolean };

const ghost = "inline-flex min-h-[40px] items-center gap-2 rounded-[10px] border border-lp-line-2 bg-lp-surface px-3.5 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised disabled:cursor-not-allowed disabled:opacity-50";

// Where the updater's progress (its own percent steps) stands, in our words.
const UPDATE_STEPS: [number, string][] = [[0, "set.step.download"], [37, "set.step.verify"], [40, "set.step.backup"], [62, "set.step.install"], [96, "set.step.restart"]];
const RESTORE_STEPS: [number, string][] = [[0, "set.step.stop"], [30, "set.step.restoreData"], [70, "set.step.restartAfter"]];

const Svg = ({ children, className = "h-5 w-5" }: { children: React.ReactNode; className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cx("flex-none", className)} aria-hidden="true">{children}</svg>
);
const DOWN = <><path d="M12 3v12M6 10l6 6 6-6" /><path d="M4 20h16" /></>;
const CHECK = <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>;
const WARN = <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.5" /></>;
const DB = <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>;
const FILE = <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M12 18v-6M9 15l3 3 3-3" /></>;

export default function SettingsPage({ host, onNavigate }: { host: string; onNavigate?: (key: NavKey) => void }) {
    const { t, lang, setLang } = useTranslation();
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const [check, setCheck] = useState<UpdateCheck | null>(null);
    const [checking, setChecking] = useState(false);
    const [clients, setClients] = useState<{ min: string; latest: string } | null>(null);
    const [backups, setBackups] = useState<Backup[] | null | "down">(null);
    const [op, setOp] = useState<Op | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<UpdateProgress | null>(null);
    const [confirm, setConfirm] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState<Flash | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const loadCheck = useCallback(async (refresh = false) => {
        setChecking(true);
        try {
            setCheck(await systemApi.update(refresh));
        } catch {
            // the server itself restarting: the next poll or a reload brings it back
        } finally {
            setChecking(false);
        }
    }, []);
    const loadBackups = useCallback(() => {
        systemApi.backups().then(setBackups).catch(() => setBackups("down"));
    }, []);

    useEffect(() => {
        void loadCheck();
        loadBackups();
        api.version().then((d) => d && setClients({ min: d.min_client_version ?? "", latest: d.latest_client_version ?? "" })).catch(() => { });
        // An update or rollback started earlier (another tab, another computer) keeps showing.
        systemApi.progress().then((p) => { if (p.status === "running") { setProgress(p); setOp("resume"); } }).catch(() => { });
    }, [loadCheck, loadBackups]);

    // While an operation runs, follow it. The server restarts on the way, so failed polls
    // are expected and simply retried.
    useEffect(() => {
        if (!op || uploading) return;
        const id = window.setInterval(async () => {
            try {
                const p = await systemApi.progress();
                setProgress(p);
                if (p.status === "done") {
                    setOp(null);
                    setFlash({ ok: true, text: t(op === "restore" ? "set.restored" : "set.updated"), reload: op !== "restore" });
                    void loadCheck(true);
                    loadBackups();
                } else if (p.status === "error") {
                    setOp(null);
                    setFlash({ ok: false, text: t("set.failed", { error: p.error ?? "" }) });
                    loadBackups();
                }
            } catch {
                // restarting
            }
        }, 1500);
        return () => window.clearInterval(id);
    }, [op, uploading, t, loadCheck, loadBackups]);

    const fail = (e: unknown) => setFlash({ ok: false, text: e instanceof Error && e.message ? e.message : t("set.failedShort") });

    const startUpdate = async () => {
        setFlash(null);
        setBusy(true);
        try {
            await systemApi.startUpdate();
            setProgress({ status: "running", progress: 1, label: "", log: null, error: null });
            setOp("update");
        } catch (e) {
            fail(e);
        } finally {
            setBusy(false);
        }
    };

    const updateFromFile = async (file: File | undefined) => {
        if (!file) return;
        setFlash(null);
        setUploading(true);
        setOp("file");
        setProgress({ status: "running", progress: 0, label: "", log: null, error: null });
        try {
            await systemApi.updateFromFile(file);
        } catch (e) {
            setOp(null);
            fail(e);
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const backupNow = async () => {
        setFlash(null);
        setBusy(true);
        try {
            const made = await systemApi.backupNow();
            loadBackups();
            setFlash({ ok: true, text: t("set.bk.made", { when: when(made.created_at) }) });
        } catch (e) {
            fail(e);
        } finally {
            setBusy(false);
        }
    };

    const restore = async (b: Backup) => {
        setConfirm(null);
        setFlash(null);
        try {
            await systemApi.restore(b.id);
            setProgress({ status: "running", progress: 1, label: "", log: null, error: null });
            setOp("restore");
        } catch (e) {
            fail(e);
        }
    };

    const when = (iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return `${d.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" })}, ${d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}`;
    };
    const checkedAt = check ? new Date(check.checked_ts * 1000).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" }) : "";

    const running = !!op;
    const steps = op === "restore" ? RESTORE_STEPS : UPDATE_STEPS;
    const pct = Math.max(0, Math.min(100, progress?.progress ?? 0));
    const stepIndex = steps.reduce((found, [from], i) => (pct >= from ? i : found), 0);
    const stepText = uploading
        ? t("set.step.upload")
        : op === "resume" ? t("set.step.generic")
            : t("set.step.of", { n: stepIndex + 1, total: steps.length, step: t(steps[stepIndex][1]) });

    // ── the focal card: icon, version line and the one action ──
    const state = running ? "running"
        : !check ? "loading"
            : check.updater === "offline" ? "down"
                : check.error === "offline" ? "noInternet"
                    : check.available ? "available" : "latest";
    const icon = state === "latest"
        ? <span className="flex h-14 w-14 flex-none items-center justify-center rounded-[18px] bg-lp-g-sys/[0.13] text-lp-g-sys"><Svg className="h-[26px] w-[26px]">{CHECK}</Svg></span>
        : state === "down" || state === "noInternet"
            ? <span className="flex h-14 w-14 flex-none items-center justify-center rounded-[18px] bg-lp-warn-bg text-lp-warn"><Svg className="h-[26px] w-[26px]">{WARN}</Svg></span>
            : <span className="flex h-14 w-14 flex-none items-center justify-center rounded-[18px] bg-lp-accent-bg text-lp-accent-ink"><Svg className="h-[26px] w-[26px]">{DOWN}</Svg></span>;
    const line = {
        running: { tone: "", text: t(op === "restore" ? "set.line.restoring" : "set.line.running") },
        loading: { tone: "", text: t("set.line.loading") },
        down: { tone: "warn", text: t("set.line.down") },
        noInternet: { tone: "warn", text: t("set.line.noInternet", { time: checkedAt }) },
        available: { tone: "", text: t("set.line.available", { time: checkedAt }) },
        latest: { tone: "ok", text: t("set.line.latest", { time: checkedAt }) },
    }[state];

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
            <PageTitle
                icon="settings"
                eyebrow={t("nav.groupSystem")}
                title={t("nav.settings")}
                description={<>{t("set.lead")} <button type="button" onClick={() => onNavigate?.("license")} className={cx(linkButton, "text-[14px]")}>{t("set.leadLink")}</button>.</>}
            />

            <section aria-labelledby="set-update" className="lp-card flex flex-col gap-4 p-[22px]">
                <div className="flex flex-wrap items-center gap-x-[18px] gap-y-3">
                    {icon}
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span id="set-update" className="text-[13px] font-extrabold text-lp-ink-3">{t("set.version")}</span>
                        <span className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-lp-ink tabular-nums">
                            {check?.current ?? "—"}
                            {check?.available && check.version && (
                                <span className="ml-2 text-[15px] font-bold tracking-normal text-lp-ink-3">{t("set.arrowNew", { version: check.version })}</span>
                            )}
                        </span>
                        <span className={cx("text-[14px] font-bold", line.tone === "ok" ? "text-lp-ok" : line.tone === "warn" ? "text-lp-warn" : "text-lp-ink-2")}>
                            {line.tone === "ok" && "● "}{line.text}
                        </span>
                    </div>
                    {isAdmin && !running && (
                        <div className="ml-auto flex flex-wrap items-center gap-2.5">
                            {state === "available" && check?.has_package && (
                                <button type="button" disabled={busy} onClick={() => void startUpdate()} className={cx(primaryButton, "flex items-center gap-2")}>
                                    <Svg>{DOWN}</Svg>
                                    {t("set.updateTo", { version: check.version })}
                                </button>
                            )}
                            {(state === "latest" || state === "noInternet") && (
                                <button type="button" disabled={checking} onClick={() => void loadCheck(true)} className={ghost}>{t("set.checkNow")}</button>
                            )}
                            {state !== "down" && state !== "loading" && (
                                <label className={cx(ghost, "cursor-pointer")}>
                                    <Svg className="h-[18px] w-[18px]">{FILE}</Svg>
                                    {t("set.fromFile")}
                                    <input ref={fileRef} type="file" accept=".lpupdate" className="sr-only" onChange={(e) => void updateFromFile(e.target.files?.[0])} />
                                </label>
                            )}
                        </div>
                    )}
                </div>

                {state === "available" && !running && check && (
                    <>
                        {check.changelog && (
                            <div className="flex flex-col gap-1.5 rounded-[16px] border border-lp-line bg-lp-raised px-4 py-3.5">
                                <b className="text-[14px]">{t("set.whatsNew", { version: check.version, date: check.published_at ? new Date(check.published_at).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" }) : "" })}</b>
                                <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[14px] text-lp-ink-2">{check.changelog}</div>
                            </div>
                        )}
                        <span className="text-[13px] text-lp-ink-3">{check.has_package ? t("set.updateNote") : t("set.installerOnly")}</span>
                    </>
                )}
                {state === "noInternet" && <span className="text-[13px] text-lp-ink-3">{t("set.noInternetHint")}</span>}
                {state === "down" && <span className="text-[13px] font-bold text-lp-warn">{t("set.downHint")}</span>}
                {!isAdmin && state !== "down" && <span className="text-[13px] text-lp-ink-3">{t("set.adminOnly")}</span>}

                {running && (
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between gap-3 text-[14px] font-extrabold">
                            <span>{stepText}</span>
                            {!uploading && <span className="tabular-nums">{pct}%</span>}
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-lp-ink/[0.08]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={stepText}>
                            <span className={cx("block h-full rounded-full bg-gradient-to-r from-[#3C7CD9] to-[#2361AA] transition-all duration-500", uploading && "animate-pulse")} style={{ width: uploading ? "100%" : `${pct}%` }} />
                        </div>
                        <span className="text-[13px] text-lp-ink-3">{t("set.runningNote")}</span>
                    </div>
                )}
            </section>

            {flash && (
                <p role="status" className={cx("m-0 flex flex-wrap items-center gap-x-2 text-[14px] font-bold", flash.ok ? "text-lp-ok" : "text-lp-bad")}>
                    <span aria-hidden="true">{flash.ok ? "●" : "■"}</span>
                    <span>{flash.text}</span>
                    {flash.reload && <button type="button" onClick={() => window.location.reload()} className={cx(linkButton, "text-[14px]")}>{t("set.reload")}</button>}
                </p>
            )}

            <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <section aria-labelledby="set-backups" className="lp-card flex flex-col gap-3 p-[18px]">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h2 id="set-backups" className="m-0 mr-auto text-[16px] font-extrabold text-lp-ink">{t("set.bk.title")}</h2>
                        {isAdmin && backups !== "down" && (
                            <button type="button" disabled={busy || running} onClick={() => void backupNow()} className={ghost}>{busy ? t("set.bk.making") : t("set.bk.now")}</button>
                        )}
                    </div>
                    <p className="m-0 -mt-1.5 text-[13px] text-lp-ink-3">{t("set.bk.lead")}</p>
                    {backups === null ? (
                        <p className="m-0 text-[14px] text-lp-ink-3">{t("set.loading")}</p>
                    ) : backups === "down" ? (
                        <p className="m-0 text-[14px] font-bold text-lp-warn">{t("set.bk.down")}</p>
                    ) : backups.length === 0 ? (
                        <p className="m-0 text-[14px] text-lp-ink-3">{t("set.bk.none")}</p>
                    ) : backups.map((b) => (
                        <div key={b.id} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-t border-lp-line py-2.5">
                            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-lp-ink/[0.05] text-lp-ink-2"><Svg className="h-[18px] w-[18px]">{DB}</Svg></span>
                            <div className="min-w-0">
                                <b className="block text-[15px] text-lp-ink">{when(b.created_at)}</b>
                                <span className="text-[13px] text-lp-ink-3">{t(b.reason === "manual" ? "set.bk.manual" : "set.bk.beforeUpdate", { version: b.version, size: Math.round(b.size_mb) })}</span>
                            </div>
                            {isAdmin && <button type="button" disabled={running} onClick={() => setConfirm(confirm === b.id ? null : b.id)} className={cx(linkButton, "text-[14px]")}>{t("set.bk.restore")}</button>}
                            {confirm === b.id && (
                                <div role="alert" className="col-span-full flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[14px] bg-lp-warn-bg px-3.5 py-3 text-[14px] font-bold text-lp-warn">
                                    <Svg className="h-[18px] w-[18px]">{WARN}</Svg>
                                    <span className="min-w-0 flex-[1_1_320px]">{t("set.bk.ask", { when: when(b.created_at) })}</span>
                                    <button type="button" onClick={() => void restore(b)} className={cx(dangerLink, "text-[14px]")}>{t("set.bk.yes")}</button>
                                    <button type="button" onClick={() => setConfirm(null)} className={cx(linkButton, "text-[14px]")}>{t("set.no")}</button>
                                </div>
                            )}
                        </div>
                    ))}
                </section>

                <div className="flex flex-col gap-3.5">
                    <section aria-labelledby="set-lang" className="lp-card flex flex-col gap-3 p-[18px]">
                        <h2 id="set-lang" className="m-0 text-[16px] font-extrabold text-lp-ink">{t("set.langTitle")}</h2>
                        <div role="group" aria-labelledby="set-lang" className="flex w-fit flex-wrap gap-1 rounded-[22px] bg-lp-ink/[0.05] p-1">
                            {LANGS.map((code) => (
                                <button
                                    key={code}
                                    type="button"
                                    lang={code}
                                    aria-pressed={lang === code}
                                    onClick={() => setLang(code)}
                                    className={cx("min-h-[38px] rounded-full px-3.5 text-[13px] font-extrabold transition", lang === code ? "bg-lp-surface text-lp-ink shadow-sm" : "text-lp-ink-3 hover:text-lp-ink")}
                                >
                                    {LANG_LABELS[code].replace(/^\S+\s/, "")}
                                </button>
                            ))}
                        </div>
                        <p className="m-0 text-[13px] text-lp-ink-3">{t("set.langNote")}</p>
                    </section>
                    <section aria-labelledby="set-about" className="lp-card flex flex-col gap-3 p-[18px]">
                        <h2 id="set-about" className="m-0 text-[16px] font-extrabold text-lp-ink">{t("set.about")}</h2>
                        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[14px]">
                            <dt className="font-bold text-lp-ink-3">{t("set.aboutServer")}</dt>
                            <dd className="m-0 font-extrabold tabular-nums">{check?.current ?? "—"}</dd>
                            <dt className="font-bold text-lp-ink-3">{t("set.aboutAddress")}</dt>
                            <dd className="m-0 font-mono font-semibold">{host}</dd>
                            <dt className="font-bold text-lp-ink-3">{t("set.aboutStations")}</dt>
                            <dd className="m-0 font-extrabold">{clients ? t("set.aboutStationsValue", { min: clients.min, latest: clients.latest }) : "—"}</dd>
                        </dl>
                        <button
                            type="button"
                            onClick={async () => {
                                const text = [
                                    `LabelPilot Server ${check?.current ?? ""}`,
                                    `${t("set.aboutAddress")}: ${host}`,
                                    clients ? `${t("set.aboutStations")}: ${t("set.aboutStationsValue", { min: clients.min, latest: clients.latest })}` : "",
                                    `${t("set.langTitle")}: ${lang}`,
                                ].filter(Boolean).join("\n");
                                setFlash(await copyText(text) ? { ok: true, text: t("set.copied") } : { ok: false, text: t("set.copyFailed") });
                            }}
                            className={cx(linkButton, "w-fit text-[14px]")}
                        >
                            {t("set.copyInfo")}
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
}
