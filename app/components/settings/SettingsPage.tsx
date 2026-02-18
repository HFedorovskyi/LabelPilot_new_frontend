"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VersionInfo {
    server_version: string;
    min_client_version: string;
    latest_client_version: string;
}

interface ReleaseInfo {
    available: boolean;
    version: string;
    current_version: string;
    changelog: string;
    published_at: string;
    download_url: string;
}

interface BackupEntry {
    id: string;
    version: string;
    created_at: string;
    size_mb: number;
}

type UpdateStatus =
    | "idle"
    | "checking"
    | "downloading"
    | "building"
    | "migrating"
    | "done"
    | "error"
    | "rolling_back";

// ─── Constants ────────────────────────────────────────────────────────────────

const UPDATER_BASE = "http://localhost:9000";
// Derive API base from the current host — works in any environment.
// Frontend runs on :3000, backend/nginx is on :8000.
function getApiBase(): string {
    if (typeof window === "undefined") return "http://localhost:8000/api/v1";
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000/api/v1`;
}
const API_BASE = getApiBase();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
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

function ProgressBar({ value, label }: { value: number; label: string }) {
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-white/60">
                <span>{label}</span>
                <span>{value}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${value}%` }}
                />
            </div>
        </div>
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

// ─── UpdatesSection ───────────────────────────────────────────────────────────

function UpdatesSection() {
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [release, setRelease] = useState<ReleaseInfo | null>(null);
    const [backups, setBackups] = useState<BackupEntry[]>([]);
    const [status, setStatus] = useState<UpdateStatus>("idle");
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState("");
    const [logLines, setLogLines] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [updaterOnline, setUpdaterOnline] = useState<boolean | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    // ── Fetch version from Django API ──────────────────────────────────────────
    useEffect(() => {
        fetch(`${API_BASE}/version/`)
            .then((r) => r.json())
            .then(setVersionInfo)
            .catch(() => setVersionInfo(null));
    }, []);

    // ── Check Updater Service availability ────────────────────────────────────
    useEffect(() => {
        fetch(`${UPDATER_BASE}/status`, { signal: AbortSignal.timeout(2000) })
            .then((r) => r.json())
            .then(() => setUpdaterOnline(true))
            .catch(() => setUpdaterOnline(false));
    }, []);

    // ── Fetch backups ──────────────────────────────────────────────────────────
    const fetchBackups = useCallback(() => {
        if (!updaterOnline) return;
        fetch(`${UPDATER_BASE}/backups`)
            .then((r) => r.json())
            .then((data) => setBackups(data.backups ?? []))
            .catch(() => { });
    }, [updaterOnline]);

    useEffect(() => {
        fetchBackups();
    }, [fetchBackups]);

    // ── Auto-scroll log ────────────────────────────────────────────────────────
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logLines]);

    // ── Poll progress ──────────────────────────────────────────────────────────
    const startPolling = useCallback(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const r = await fetch(`${UPDATER_BASE}/update/progress`);
                const data = await r.json();
                setProgress(data.progress ?? 0);
                setProgressLabel(data.label ?? "");
                if (data.log) setLogLines((prev) => [...prev, data.log]);
                if (data.status === "done") {
                    setStatus("done");
                    clearInterval(pollRef.current!);
                    fetchBackups();
                    // Refresh version info
                    fetch(`${API_BASE}/version/`).then((r) => r.json()).then(setVersionInfo).catch(() => { });
                }
                if (data.status === "error") {
                    setStatus("error");
                    setError(data.error ?? "Неизвестная ошибка");
                    clearInterval(pollRef.current!);
                }
            } catch {
                // Updater may be restarting — ignore transient errors
            }
        }, 1500);
    }, [fetchBackups]);

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

    // ── Check for updates ──────────────────────────────────────────────────────
    const handleCheck = async () => {
        setStatus("checking");
        setError(null);
        setRelease(null);
        try {
            const r = await fetch(`${UPDATER_BASE}/check`);
            const data: ReleaseInfo = await r.json();
            setRelease(data);
        } catch {
            setError("Не удалось связаться с Updater Service. Убедитесь, что он запущен.");
        } finally {
            setStatus("idle");
        }
    };

    // ── Start online update ────────────────────────────────────────────────────
    const handleUpdate = async () => {
        setStatus("downloading");
        setProgress(0);
        setLogLines([]);
        setError(null);
        try {
            await fetch(`${UPDATER_BASE}/update`, { method: "POST" });
            startPolling();
        } catch {
            setStatus("error");
            setError("Не удалось запустить обновление.");
        }
    };

    // ── Offline update via file upload ─────────────────────────────────────────
    const handleOfflineFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setStatus("downloading");
        setProgress(0);
        setLogLines([]);
        setError(null);
        const form = new FormData();
        form.append("file", file);
        try {
            await fetch(`${UPDATER_BASE}/update/offline`, { method: "POST", body: form });
            startPolling();
        } catch {
            setStatus("error");
            setError("Не удалось загрузить файл обновления.");
        }
        // Reset input so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // ── Rollback ───────────────────────────────────────────────────────────────
    const handleRollback = async (backupId: string) => {
        if (!confirm("Откатить сервер к этой версии? Текущие данные будут заменены данными из бэкапа.")) return;
        setStatus("rolling_back");
        setProgress(0);
        setLogLines([]);
        setError(null);
        try {
            await fetch(`${UPDATER_BASE}/rollback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ backup_id: backupId }),
            });
            startPolling();
        } catch {
            setStatus("error");
            setError("Не удалось запустить откат.");
        }
    };

    const isBusy = ["downloading", "building", "migrating", "rolling_back"].includes(status);

    return (
        <div className="space-y-6">
            {/* Current version card */}
            <Card>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-sm font-medium text-white/60 mb-1">Текущая версия сервера</div>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl font-bold tracking-tight text-white">
                                {versionInfo ? `v${versionInfo.server_version}` : "—"}
                            </span>
                            {versionInfo && (
                                <Badge color="green">Актуальная</Badge>
                            )}
                        </div>
                        {versionInfo && (
                            <div className="mt-1 text-xs text-white/40">
                                Минимальная версия клиента: v{versionInfo.min_client_version}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Btn
                            variant="secondary"
                            onClick={handleCheck}
                            disabled={isBusy || status === "checking" || updaterOnline === false}
                        >
                            {status === "checking" ? (
                                <><Spinner className="h-4 w-4" /> Проверяю…</>
                            ) : (
                                <>
                                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                                        <path d="M4 12a8 8 0 018-8v4l4-4-4-4v4a10 10 0 100 10" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Проверить обновления
                                </>
                            )}
                        </Btn>

                        <label className={cx(
                            "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition",
                            isBusy || updaterOnline === false
                                ? "pointer-events-none opacity-50 border-white/10 bg-white/5 text-white/50"
                                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        )}>
                            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Обновить из файла
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".zip"
                                className="sr-only"
                                onChange={handleOfflineFile}
                                disabled={isBusy || updaterOnline === false}
                            />
                        </label>
                    </div>
                </div>

                {/* Updater Service offline warning */}
                {updaterOnline === false && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
                        <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
                            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>
                            <strong>Updater Service недоступен.</strong> Убедитесь, что служба <code className="rounded bg-white/10 px-1">LabelPilotUpdater</code> запущена на сервере.
                        </span>
                    </div>
                )}
            </Card>

            {/* Available update banner */}
            {release?.available && (
                <Card className="border-indigo-500/30 bg-indigo-500/10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-indigo-400" aria-hidden="true">
                                    <path d="M12 2l1.2 4.2L17.4 7.4 13.2 8.6 12 12.8 10.8 8.6 6.6 7.4l4.2-1.2L12 2Z" className="fill-current opacity-90" />
                                </svg>
                                <span className="font-semibold text-white">
                                    Доступна новая версия — v{release.version}
                                </span>
                                <Badge color="blue">Новая</Badge>
                            </div>
                            <div className="text-xs text-white/50 mb-3">
                                Опубликовано: {formatDate(release.published_at)}
                            </div>
                            {release.changelog && (
                                <pre className="whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-xs text-white/70 max-h-32 overflow-y-auto">
                                    {release.changelog}
                                </pre>
                            )}
                        </div>
                        <div className="shrink-0">
                            <Btn onClick={handleUpdate} disabled={isBusy}>
                                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                                    <path d="M12 2v14M5 9l7 7 7-7" className="stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Обновить до v{release.version}
                            </Btn>
                        </div>
                    </div>
                </Card>
            )}

            {release && !release.available && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" className="stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Установлена последняя версия. Обновлений нет.
                </div>
            )}

            {/* Progress */}
            {(isBusy || status === "done") && (
                <Card>
                    <div className="mb-3 flex items-center gap-2">
                        {isBusy && <Spinner className="h-4 w-4 text-indigo-400" />}
                        {status === "done" && (
                            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald-400" aria-hidden="true">
                                <path d="M20 6L9 17l-5-5" className="stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                        <span className="text-sm font-medium text-white">
                            {status === "done" ? "Обновление завершено!" : status === "rolling_back" ? "Откат…" : "Обновление…"}
                        </span>
                    </div>
                    <ProgressBar value={progress} label={progressLabel || "Подготовка…"} />
                    {logLines.length > 0 && (
                        <div className="mt-3 max-h-40 overflow-y-auto rounded-xl bg-black/30 p-3 font-mono text-xs text-white/60 space-y-0.5">
                            {logLines.map((line, i) => (
                                <div key={i}>{line}</div>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    )}
                </Card>
            )}

            {/* Error */}
            {status === "error" && error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
                        <path d="M18 6L6 18M6 6l12 12" className="stroke-current" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div>
                        <div className="font-medium">Ошибка</div>
                        <div className="mt-0.5 text-red-300/80">{error}</div>
                    </div>
                </div>
            )}

            {/* Backups */}
            {backups.length > 0 && (
                <Card>
                    <div className="mb-4 text-sm font-semibold text-white">Резервные копии</div>
                    <div className="space-y-2">
                        {backups.map((b) => (
                            <div
                                key={b.id}
                                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-white">v{b.version}</span>
                                        <Badge color="neutral">{b.size_mb.toFixed(1)} МБ</Badge>
                                    </div>
                                    <div className="mt-0.5 text-xs text-white/40">{formatDate(b.created_at)}</div>
                                </div>
                                <Btn
                                    variant="danger"
                                    onClick={() => handleRollback(b.id)}
                                    disabled={isBusy}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                                        <path d="M3 12a9 9 0 009 9 9 9 0 000-18H3M3 12l4-4M3 12l4 4" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Откатить
                                </Btn>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}

// ─── Settings sub-tabs ────────────────────────────────────────────────────────

type SettingsTab = "updates" | "about";

const settingsTabs: { key: SettingsTab; label: string }[] = [
    { key: "updates", label: "Обновления" },
    { key: "about", label: "О системе" },
];

// ─── Main SettingsPage ────────────────────────────────────────────────────────

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<SettingsTab>("updates");
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

    useEffect(() => {
        fetch(`${API_BASE}/version/`)
            .then((r) => r.json())
            .then(setVersionInfo)
            .catch(() => { });
    }, []);

    return (
        <div className="space-y-6">
            {/* Sub-navigation */}
            <div className="flex gap-2 border-b border-white/10 pb-4">
                {settingsTabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={cx(
                            "rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-white/20",
                            activeTab === t.key
                                ? "bg-white/10 text-white"
                                : "text-white/60 hover:bg-white/5 hover:text-white"
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === "updates" && <UpdatesSection />}

            {activeTab === "about" && (
                <Card>
                    <div className="space-y-4">
                        <div className="text-sm font-semibold text-white">О системе</div>
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                            {[
                                { label: "Версия сервера", value: versionInfo ? `v${versionInfo.server_version}` : "—" },
                                { label: "Мин. версия клиента", value: versionInfo ? `v${versionInfo.min_client_version}` : "—" },
                                { label: "Последняя версия клиента", value: versionInfo ? `v${versionInfo.latest_client_version}` : "—" },
                                { label: "Продукт", value: "LabelPilot Server" },
                            ].map(({ label, value }) => (
                                <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                    <div className="text-xs text-white/50 mb-1">{label}</div>
                                    <div className="font-medium text-white">{value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}
