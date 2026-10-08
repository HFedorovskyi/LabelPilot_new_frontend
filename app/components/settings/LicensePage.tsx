"use client";

// «Лицензия» as it was inside the old Settings page, kept as its own page until the
// «Лицензия» redesign (the new «Настройки» no longer carries a licence tab).

import React, { useCallback, useEffect, useState } from "react";
import { licenseApi, type LicenseInfo } from "@/lib/api/license";
import { SeatListCard } from "./SeatListCard";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "../auth/AuthProvider";
import { copyText } from "@/lib/clipboard";
// ─── Helpers ──────────────────────────────────────────────────────────────────

function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cx("rounded-2xl border border-white/10 bg-white/5 p-6", className)}>
            {children}
        </div>
    );
}

function Badge({ children, color = "neutral" }: { children: React.ReactNode; color?: "green" | "yellow" | "red" | "blue" | "neutral" }) {
    const colors = {
        green: "bg-emerald-400/15 text-emerald-300 border-emerald-400/20",
        yellow: "bg-amber-400/15 text-amber-300 border-amber-400/20",
        red: "bg-red-400/15 text-red-300 border-red-400/20",
        blue: "bg-sky-400/15 text-sky-300 border-sky-400/20",
        neutral: "bg-white/10 text-white/70 border-white/10",
    };
    return (
        <span className={cx("inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium", colors[color])}>
            {children}
        </span>
    );
}

function Btn({
    children,
    onClick,
    variant = "primary",
    disabled,
    className,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: "primary" | "secondary" | "danger" | "ghost";
    disabled?: boolean;
    className?: string;
}) {
    const base =
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed";
    const styles = {
        primary: "bg-indigo-500 text-white hover:bg-indigo-400",
        secondary: "bg-white/10 text-white hover:bg-white/15 border border-white/10",
        danger: "bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/20",
        ghost: "text-white/70 hover:text-white hover:bg-white/10",
    };
    return (
        <button onClick={onClick} disabled={disabled} className={cx(base, styles[variant], className)}>
            {children}
        </button>
    );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ className }: { className?: string }) {
    return (
        <svg
            className={cx("animate-spin", className)}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
        </svg>
    );
}
// ─── LicenseSection ───────────────────────────────────────────────────────────

function formatLicenseDate(d: string) {
    // expires comes as "YYYY-MM-DD"; render it RU-style without a time component.
    try {
        const dt = new Date(`${d}T00:00:00`);
        if (Number.isNaN(dt.getTime())) return d;
        return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
        return d;
    }
}

function LicenseSection() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [info, setInfo] = useState<LicenseInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [importMsg, setImportMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let alive = true;
        licenseApi
            .get()
            .then((data) => {
                if (alive) setInfo(data);
            })
            .catch(() => {
                if (alive) setError(t('settings.licenseStatusFailed'));
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [t]);

    if (loading) {
        return (
            <Card>
                <div className="flex items-center gap-2 text-sm text-white/60">
                    <Spinner className="h-4 w-4" /> {t('settings.loadingLicenseStatus')}
                </div>
            </Card>
        );
    }

    if (error || !info) {
        return (
            <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" className="stroke-current" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div>
                    <div className="font-medium">{t('settings.errorTitle')}</div>
                    <div className="mt-0.5 text-red-300/80">{error ?? t('settings.noLicenseData')}</div>
                </div>
            </div>
        );
    }

    const isDemo = info.mode === "demo";
    const inGrace = !isDemo && info.expired && Boolean(info.grace);
    const pastGrace = !isDemo && info.expired && !info.grace;
    const expiresSoon = !isDemo && !info.expired && info.days_left != null && info.days_left <= 30;

    const rows: { label: string; value: string }[] = isDemo
        ? [
              { label: t('settings.fieldMode'), value: t('settings.demoModeNoLicense') },
          ]
        : [
              { label: t('settings.fieldEdition'), value: info.edition || "—" },
              { label: t('settings.fieldCustomer'), value: info.customer || "—" },
              {
                  label: t('settings.fieldValidUntil'),
                  value: !info.expires
                      ? t('settings.perpetual')
                      : inGrace && info.grace_until
                          ? t('settings.graceUntilValue', { date: formatLicenseDate(info.expires), until: formatLicenseDate(info.grace_until) })
                          : formatLicenseDate(info.expires),
              },
              { label: t('settings.fieldLicenseId'), value: info.license_id || "—" },
          ];

    return (
        <div className="space-y-6">
            {/* Status card */}
            <Card className={
                pastGrace
                    ? "border-red-400/30 bg-red-400/[0.06]"
                    : isDemo || inGrace || expiresSoon
                        ? "border-amber-400/30 bg-amber-400/[0.06]"
                        : "border-emerald-400/30 bg-emerald-400/[0.06]"
            }>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-sm font-medium text-white/60 mb-1">{t('settings.licenseStatus')}</div>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold tracking-tight text-white">
                                {isDemo ? t('settings.demoMode') : t('settings.licensed')}
                            </span>
                            {isDemo ? (
                                <Badge color="yellow">{t('settings.noLicense')}</Badge>
                            ) : inGrace ? (
                                <Badge color="yellow">{t('settings.grace')}</Badge>
                            ) : info.expired ? (
                                <Badge color="red">{t('settings.expired')}</Badge>
                            ) : (
                                <Badge color="green">{t('settings.active')}</Badge>
                            )}
                        </div>
                        {isDemo && (
                            <div className="mt-1.5 text-xs text-white/50">
                                {t('settings.demoUnlimitedHint')}
                            </div>
                        )}
                        {inGrace && (
                            <div className="mt-1.5 max-w-xl text-xs text-amber-200/90">
                                {t('settings.graceHint', { date: info.grace_until ? formatLicenseDate(info.grace_until) : "—", days: info.days_left ?? 0 })}
                            </div>
                        )}
                        {pastGrace && (
                            <div className="mt-1.5 max-w-xl text-xs text-red-200/90">{t('settings.expiredHint')}</div>
                        )}
                        {expiresSoon && (
                            <div className="mt-1.5 max-w-xl text-xs text-amber-200/90">
                                {t('settings.expiresSoon', { days: info.days_left ?? 0 })}
                            </div>
                        )}
                    </div>

                    {/* Stations usage */}
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                        <div className="text-xs text-white/50 mb-1">{t('settings.stations')}</div>
                        <div className="text-xl font-semibold text-white">
                            {info.stations_used}
                            {info.max_stations != null && <span className="text-white/40"> / {info.max_stations}</span>}
                        </div>
                    </div>
                </div>
            </Card>

            {info.clock_rollback && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                    {t('settings.clockRollback')}
                </div>
            )}

            {/* Details */}
            <Card>
                <div className="mb-4 text-sm font-semibold text-white">
                    {isDemo ? t('settings.demoModeInfo') : t('settings.licenseDetails')}
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                    {rows.map(({ label, value }) => (
                        <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                            <div className="text-xs text-white/50 mb-1">{label}</div>
                            <div className="font-medium text-white">{value}</div>
                        </div>
                    ))}
                </div>

                {!isDemo && info.features.length > 0 && (
                    <div className="mt-4">
                        <div className="text-xs text-white/50 mb-2">{t('settings.features')}</div>
                        <div className="flex flex-wrap gap-2">
                            {info.features.map((f) => (
                                <Badge key={f} color="blue">
                                    {f}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </Card>

            <SeatListCard info={info} isAdmin={user?.role === "admin"} onInfo={setInfo} />

            {/* Machine ID — ALWAYS visible + copyable. The buyer sends this to the supplier so the
                license can be bound to this exact server (it's needed regardless of demo/active state). */}
            <Card>
                <div className="text-sm font-semibold text-white">{t('settings.machineIdTitle')}</div>
                <div className="mt-1 text-xs text-white/50">{t('settings.machineIdHint')}</div>
                <div className="mt-3 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white">
                        {info.machine_id || "—"}
                    </code>
                    <button
                        type="button"
                        onClick={async () => {
                            // Says «Скопировано» only when it was: on a plain-http LAN address the
                            // async clipboard is missing and used to fail silently.
                            if (info.machine_id && await copyText(info.machine_id)) {
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1500);
                            }
                        }}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10"
                    >
                        {copied ? t('settings.copied') : t('settings.copy')}
                    </button>
                </div>
            </Card>

            {/* Admin-only: import / replace the license (.lpl) — verified + activated live, no restart. */}
            {user?.role === "admin" && (
                <Card>
                    <div className="text-sm font-semibold text-white">{t('settings.licenseImportTitle')}</div>
                    <div className="mt-1 text-xs text-white/50">{t('settings.licenseImportHint')}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        <label
                            className={cx(
                                "cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                                importing
                                    ? "border-white/10 bg-white/5 text-white/40"
                                    : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                            )}
                        >
                            {importing ? t('settings.licenseImporting') : t('settings.licenseImportButton')}
                            <input
                                type="file"
                                accept=".lpl"
                                className="hidden"
                                disabled={importing}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (!file) return;
                                    setImporting(true);
                                    setImportMsg(null);
                                    try {
                                        const updated = await licenseApi.importLicense(file);
                                        setInfo(updated);
                                        setImportMsg({ type: "ok", text: t('settings.licenseImportOk') });
                                    } catch (err) {
                                        setImportMsg({ type: "err", text: err instanceof Error ? err.message : t('settings.licenseImportFailed') });
                                    } finally {
                                        setImporting(false);
                                    }
                                }}
                            />
                        </label>
                        {!isDemo && (
                            <button
                                type="button"
                                disabled={refreshing || importing}
                                onClick={async () => {
                                    setRefreshing(true);
                                    setImportMsg(null);
                                    try {
                                        const updated = await licenseApi.refreshLicense();
                                        setInfo(updated);
                                        const result = updated.refresh?.status ?? "unavailable";
                                        setImportMsg({
                                            type: result === "updated" || result === "current" ? "ok" : "err",
                                            text: t(`settings.licenseRefresh.${result}`),
                                        });
                                    } catch (err) {
                                        setImportMsg({ type: "err", text: err instanceof Error ? err.message : t('settings.licenseRefresh.unavailable') });
                                    } finally {
                                        setRefreshing(false);
                                    }
                                }}
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                            >
                                {refreshing ? t('settings.licenseRefreshing') : t('settings.licenseRefreshButton')}
                            </button>
                        )}
                        {importMsg && (
                            <span className={importMsg.type === "ok" ? "text-sm text-emerald-300" : "text-sm text-red-300"}>
                                {importMsg.text}
                            </span>
                        )}
                    </div>
                    {!isDemo && <div className="mt-2 text-xs text-white/40">{t('settings.licenseRefreshHint')}</div>}
                </Card>
            )}

            {isDemo && (
                <div className="flex items-start gap-3 rounded-xl border border-indigo-400/20 bg-indigo-400/10 px-4 py-3 text-sm text-indigo-200">
                    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
                        <path d="M12 2l1.2 4.2L17.4 7.4 13.2 8.6 12 12.8 10.8 8.6 6.6 7.4l4.2-1.2L12 2Z" className="fill-current opacity-90" />
                    </svg>
                    <span>
                        {t('settings.activateContactSupplier')}{" "}
                        <code className="rounded bg-white/10 px-1 font-mono text-xs">{info.machine_id}</code>.
                    </span>
                </div>
            )}
        </div>
    );
}

export default function LicensePage() {
    return <LicenseSection />;
}
