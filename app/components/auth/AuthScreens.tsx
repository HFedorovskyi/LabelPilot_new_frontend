"use client";

import React, { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useTranslation } from "@/lib/i18n";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

function Spinner({ className }: { className?: string }) {
    return (
        <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

/**
 * Full-screen, centered auth shell reusing the app's atmospheric background +
 * glass card so the login/bootstrap surfaces feel native to the SPA.
 */
function AuthShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative flex h-screen items-center justify-center overflow-hidden bg-[#06070b] px-4 text-white font-[family-name:var(--font-geist-sans)]">
            {/* Атмосферный фон */}
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                <div className="absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full blur-[80px]" style={{ background: "rgba(99,102,241,0.13)" }} />
                <div className="absolute bottom-[-120px] left-[120px] h-[360px] w-[360px] rounded-full blur-[80px]" style={{ background: "rgba(217,70,239,0.06)" }} />
                <div className="absolute right-[-110px] top-10 h-[320px] w-[320px] rounded-full blur-[80px]" style={{ background: "rgba(34,211,238,0.045)" }} />
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)",
                        backgroundSize: "46px 46px",
                    }}
                />
            </div>

            <div className="relative z-10 w-full max-w-[380px]">
                <div className="mb-6 flex flex-col items-center gap-3 text-center">
                    <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-400/[0.16] text-indigo-300 ring-1 ring-indigo-400/30"
                        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)" }}
                    >
                        <img src="/icons/logo.svg" alt="LabelPilot" className="h-7 w-7 object-contain" />
                    </div>
                    <div className="text-[19px] font-extrabold tracking-tight">
                        Label<span className="text-indigo-400">Pilot</span>
                    </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    {children}
                </div>
            </div>
        </div>
    );
}

const fieldCls =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/30";

function Label({ children }: { children: React.ReactNode }) {
    return <label className="mb-1.5 block text-xs font-medium text-white/55">{children}</label>;
}

function ErrorBox({ message }: { message: string }) {
    return (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/10 px-3.5 py-2.5 text-sm text-red-300">
            <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>{message}</span>
        </div>
    );
}

function SubmitBtn({ busy, children }: { busy: boolean; children: React.ReactNode }) {
    return (
        <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {busy && <Spinner className="h-4 w-4" />}
            {children}
        </button>
    );
}

// ─── LoginScreen ──────────────────────────────────────────────────────────────

export function LoginScreen() {
    const { login } = useAuth();
    const { t } = useTranslation();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await login(username.trim(), password);
            // On success, refresh() inside login() flips the gate to the app.
        } catch (err) {
            setError(err instanceof Error ? err.message : t('authui.invalidCredentials'));
            setBusy(false);
        }
    };

    return (
        <AuthShell>
            <div className="mb-5">
                <div className="text-lg font-semibold tracking-tight text-white">{t('authui.loginTitle')}</div>
                <p className="mt-1 text-[13px] text-white/45">{t('authui.loginSubtitle')}</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <Label>{t('authui.usernameLabel')}</Label>
                    <input
                        type="text"
                        autoFocus
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={fieldCls}
                        placeholder="admin"
                    />
                </div>
                <div>
                    <Label>{t('authui.passwordLabel')}</Label>
                    <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={fieldCls}
                        placeholder="••••••••"
                    />
                </div>
                {error && <ErrorBox message={error} />}
                <SubmitBtn busy={busy}>{busy ? t('authui.loggingIn') : t('authui.loginBtn')}</SubmitBtn>
            </form>
        </AuthShell>
    );
}

// ─── BootstrapScreen ──────────────────────────────────────────────────────────

export function BootstrapScreen() {
    const { bootstrap } = useAuth();
    const { t } = useTranslation();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        if (!username.trim()) {
            setError(t('authui.bootstrapNeedUsername'));
            return;
        }
        if (password.length < 1) {
            setError(t('authui.bootstrapNeedPassword'));
            return;
        }
        if (password !== confirm) {
            setError(t('authui.passwordsMismatch'));
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await bootstrap(username.trim(), password);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('authui.bootstrapFailed'));
            setBusy(false);
        }
    };

    return (
        <AuthShell>
            <div className="mb-5">
                <div className="text-lg font-semibold tracking-tight text-white">{t('authui.bootstrapTitle')}</div>
                <p className="mt-1 text-[13px] text-white/45">
                    {t('authui.bootstrapSubtitle')}
                </p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <Label>{t('authui.usernameLabel')}</Label>
                    <input
                        type="text"
                        autoFocus
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={fieldCls}
                        placeholder="admin"
                    />
                </div>
                <div>
                    <Label>{t('authui.passwordLabel')}</Label>
                    <input
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={fieldCls}
                        placeholder="••••••••"
                    />
                </div>
                <div>
                    <Label>{t('authui.confirmPasswordLabel')}</Label>
                    <input
                        type="password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className={fieldCls}
                        placeholder="••••••••"
                    />
                </div>
                {error && <ErrorBox message={error} />}
                <SubmitBtn busy={busy}>{busy ? t('authui.creating') : t('authui.createAdminBtn')}</SubmitBtn>
            </form>
        </AuthShell>
    );
}
