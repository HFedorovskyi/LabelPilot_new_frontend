"use client";

import React, { useCallback, useEffect, useState } from "react";
import { operatorsApi, type Operator } from "@/lib/api/operators";
import { useTranslation } from "@/lib/i18n";

// ─── Helpers (match UsersManager / SettingsPage conventions) ──────────────────

function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cx("rounded-2xl border border-white/10 bg-white/5 p-6", className)}>{children}</div>;
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
    type = "button",
    variant = "primary",
    disabled,
    className,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: "button" | "submit";
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
        <button type={type} onClick={onClick} disabled={disabled} className={cx(base, styles[variant], className)}>
            {children}
        </button>
    );
}

function Spinner({ className }: { className?: string }) {
    return (
        <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

const fieldCls =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/30";

/** Keep only digits — PINs are short numeric codes. */
function digitsOnly(v: string): string {
    return v.replace(/\D+/g, "");
}

// ─── Create operator form ─────────────────────────────────────────────────────

function CreateOperatorForm({ onCreated }: { onCreated: () => void }) {
    const { t } = useTranslation();
    const [fullName, setFullName] = useState("");
    const [shortCode, setShortCode] = useState("");
    const [pin, setPin] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        if (!fullName.trim()) {
            setError(t("operators.errFullNameRequired"));
            return;
        }
        setBusy(true);
        setError(null);
        try {
            // station defaults to null (= все станции). A station picker is optional
            // and intentionally omitted here — see OperatorsManager note.
            await operatorsApi.create({
                full_name: fullName.trim(),
                short_code: shortCode.trim() || null,
                pin: pin.trim() || null,
                station: null,
                is_active: isActive,
            });
            setFullName("");
            setShortCode("");
            setPin("");
            setIsActive(true);
            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : t("operators.errCreateFailed"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card>
            <div className="mb-4 text-sm font-semibold text-white">{t("operators.newOperator")}</div>
            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/55">{t("operators.fullName")}</label>
                    <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={fieldCls}
                        placeholder={t("operators.fullNamePlaceholder")}
                        autoComplete="off"
                    />
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/55">{t("operators.codeOptional")}</label>
                    <input
                        type="text"
                        value={shortCode}
                        onChange={(e) => setShortCode(e.target.value)}
                        className={fieldCls}
                        placeholder="OP-01"
                        autoComplete="off"
                    />
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/55">{t("operators.pinOptional")}</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={pin}
                        onChange={(e) => setPin(digitsOnly(e.target.value))}
                        className={fieldCls}
                        placeholder="••••"
                        autoComplete="off"
                    />
                </div>
                <Btn type="submit" disabled={busy}>
                    {busy ? <Spinner className="h-4 w-4" /> : null}
                    {t("operators.add")}
                </Btn>
            </form>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs text-white/60">
                <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5"
                />
                {t("operators.active")}
            </label>
            <div className="mt-1 text-[11px] text-white/35">{t("operators.stationAllDefault")}</div>
            {error && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/10 px-3.5 py-2.5 text-sm text-red-300">
                    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}
        </Card>
    );
}

// ─── Operator row ─────────────────────────────────────────────────────────────

function OperatorRow({
    op,
    onChanged,
    onError,
}: {
    op: Operator;
    onChanged: () => void;
    onError: (msg: string) => void;
}) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(op.full_name);
    const [editCode, setEditCode] = useState(op.short_code ?? "");
    const [editPin, setEditPin] = useState("");
    const [clearPin, setClearPin] = useState(false);

    const run = async (fn: () => Promise<unknown>) => {
        if (busy) return;
        setBusy(true);
        try {
            await fn();
            onChanged();
        } catch (err) {
            onError(err instanceof Error ? err.message : t("operators.errOperationFailed"));
        } finally {
            setBusy(false);
        }
    };

    const toggleActive = () => void run(() => operatorsApi.update(op.id, { is_active: !op.is_active }));

    const remove = () => {
        if (!confirm(t("operators.confirmDelete", { name: op.full_name }))) return;
        void run(() => operatorsApi.remove(op.id));
    };

    const startEdit = () => {
        setEditName(op.full_name);
        setEditCode(op.short_code ?? "");
        setEditPin("");
        setClearPin(false);
        setEditing(true);
    };

    const cancelEdit = () => {
        setEditing(false);
        setEditPin("");
        setClearPin(false);
    };

    const saveEdit = () => {
        if (!editName.trim()) {
            onError(t("operators.errFullNameRequired"));
            return;
        }
        const payload: Parameters<typeof operatorsApi.update>[1] = {
            full_name: editName.trim(),
            short_code: editCode.trim() || null,
        };
        // PIN is write-only: send a new one, OR explicitly clear it, OR leave it untouched.
        if (clearPin) payload.pin = null;
        else if (editPin.trim()) payload.pin = editPin.trim();
        void run(async () => {
            await operatorsApi.update(op.id, payload);
            setEditing(false);
            setEditPin("");
            setClearPin(false);
        });
    };

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-indigo-400/20 text-[13px] uppercase text-indigo-200 ring-1 ring-indigo-400/30">
                        {op.full_name.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-white">{op.full_name}</span>
                            {op.short_code && <Badge color="neutral">{op.short_code}</Badge>}
                            <Badge color={op.is_active ? "green" : "red"}>{op.is_active ? t("operators.active") : t("operators.disabled")}</Badge>
                            <Badge color={op.has_pin ? "blue" : "neutral"}>{op.has_pin ? t("operators.pinSet") : t("operators.noPin")}</Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-white/40">
                            {op.station == null ? t("operators.allStations") : t("operators.stationNumber", { station: op.station })}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {!editing && (
                        <Btn variant="secondary" onClick={startEdit} disabled={busy} className="px-3 py-1.5 text-xs">
                            {t("operators.edit")}
                        </Btn>
                    )}
                    <Btn variant="secondary" onClick={toggleActive} disabled={busy} className="px-3 py-1.5 text-xs">
                        {op.is_active ? t("operators.disable") : t("operators.enable")}
                    </Btn>
                    <Btn variant="danger" onClick={remove} disabled={busy} className="px-3 py-1.5 text-xs">
                        {t("operators.delete")}
                    </Btn>
                    {busy && <Spinner className="h-4 w-4 text-white/50" />}
                </div>
            </div>

            {editing && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3.5">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-white/55">{t("operators.fullName")}</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className={fieldCls}
                                placeholder={t("operators.fullNamePlaceholder")}
                                autoComplete="off"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-white/55">{t("operators.code")}</label>
                            <input
                                type="text"
                                value={editCode}
                                onChange={(e) => setEditCode(e.target.value)}
                                className={fieldCls}
                                placeholder="OP-01"
                                autoComplete="off"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-white/55">
                                {t("operators.newPinHint")}
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={editPin}
                                onChange={(e) => {
                                    setEditPin(digitsOnly(e.target.value));
                                    if (e.target.value) setClearPin(false);
                                }}
                                disabled={clearPin}
                                className={fieldCls}
                                placeholder={op.has_pin ? t("operators.pinSet") : "••••"}
                                autoComplete="off"
                            />
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 self-end pb-2.5 text-xs text-white/60">
                            <input
                                type="checkbox"
                                checked={clearPin}
                                onChange={(e) => {
                                    setClearPin(e.target.checked);
                                    if (e.target.checked) setEditPin("");
                                }}
                                disabled={!op.has_pin}
                                className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 disabled:opacity-40"
                            />
                            {t("operators.removePin")}
                        </label>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <Btn onClick={saveEdit} disabled={busy} className="px-3 py-1.5 text-xs">
                            {busy ? <Spinner className="h-4 w-4" /> : null}
                            {t("operators.save")}
                        </Btn>
                        <Btn variant="ghost" onClick={cancelEdit} disabled={busy} className="px-3 py-1.5 text-xs">
                            {t("operators.cancel")}
                        </Btn>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── OperatorsManager ─────────────────────────────────────────────────────────

export default function OperatorsManager() {
    const { t } = useTranslation();
    const [operators, setOperators] = useState<Operator[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const data = await operatorsApi.list();
            setOperators(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : t("operators.errLoadFailed"));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="space-y-6">
            <CreateOperatorForm onCreated={load} />

            <Card>
                <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">{t("operators.operators")}</div>
                    <Btn variant="ghost" onClick={load} className="px-3 py-1.5 text-xs">
                        {t("operators.refresh")}
                    </Btn>
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-white/60">
                        <Spinner className="h-4 w-4" /> {t("operators.loadingOperators")}
                    </div>
                ) : error ? (
                    <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                        <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span>{error}</span>
                    </div>
                ) : operators && operators.length > 0 ? (
                    <div className="space-y-2">
                        {operators.map((op) => (
                            <OperatorRow key={op.id} op={op} onChanged={load} onError={setError} />
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-white/50">{t("operators.empty")}</div>
                )}
            </Card>
        </div>
    );
}
