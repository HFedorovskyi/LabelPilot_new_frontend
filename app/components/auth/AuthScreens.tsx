"use client";

// «Вход» and the first-run screen (create the first admin). A calm glass card on the mesh;
// the language is picked right here, because an EU customer meets the product on these two
// screens first. Honest states: the server ended the session, a wrong password with the
// tries left on this computer, a lock after too many (backend api/login_throttle.py), and
// «Забыли пароль?» with the real ways back in (another admin, or the reset tool in the
// server's Start menu).

import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { LoginError } from "@/lib/api/auth";
import { api } from "@/lib/api/client";
import { LANGS, useTranslation } from "@/lib/i18n";
import { passwordProblem } from "@/lib/passwords";
import { useTheme } from "@/lib/theme";
import { cx } from "@/app/components/stations/shared";
import { linkButton, primaryButton } from "@/app/components/print/shared";

const label = "text-[12px] font-extrabold text-lp-ink-3";
const field = "min-h-[48px] w-full rounded-[13px] border border-lp-line-2 bg-lp-surface pl-[42px] pr-[46px] text-[15px] font-bold text-lp-ink outline-none transition placeholder:font-semibold placeholder:text-lp-ink-3/70 focus:border-lp-accent focus:shadow-[0_0_0_3px_rgba(47,111,208,0.18)]";

const Svg = ({ children, className = "h-[18px] w-[18px]" }: { children: React.ReactNode; className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cx("flex-none", className)} aria-hidden="true">{children}</svg>
);
const PERSON = <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>;
const LOCK = <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>;
const EYE = <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>;

/** Input with an icon on the left and, for a password, a show/hide button on the right. */
function Field({ id, labelText, icon, show, onToggleShow, ...input }: React.InputHTMLAttributes<HTMLInputElement> & {
    id: string; labelText: string; icon: React.ReactNode; show?: boolean; onToggleShow?: () => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-[5px]">
            <label htmlFor={id} className={label}>{labelText}</label>
            <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-[13px] flex text-lp-ink-3"><Svg>{icon}</Svg></span>
                <input id={id} {...input} className={cx(field, show && "font-mono")} />
                {onToggleShow && (
                    <button type="button" aria-label={t("authui.showPassword")} aria-pressed={!!show} onClick={onToggleShow} className="absolute right-1 flex h-10 w-10 items-center justify-center rounded-[10px] text-lp-ink-3 transition hover:text-lp-ink">
                        <Svg>{EYE}</Svg>
                    </button>
                )}
            </div>
        </div>
    );
}

function LangPills({ plain }: { plain?: boolean }) {
    const { t, lang, setLang } = useTranslation();
    return (
        <div role="group" aria-label={t("authui.langLabel")} className={cx("flex w-fit gap-1 rounded-full p-1", plain ? "bg-lp-ink/[0.05]" : "lp-glass backdrop-blur-xl")}>
            {LANGS.map((code) => (
                <button
                    key={code}
                    type="button"
                    lang={code}
                    aria-pressed={lang === code}
                    onClick={() => setLang(code)}
                    className={cx("min-h-[36px] min-w-[44px] rounded-full text-[13px] font-extrabold uppercase transition", lang === code ? "bg-lp-surface text-lp-ink shadow-sm" : "text-lp-ink-3 hover:text-lp-ink")}
                >
                    {code}
                </button>
            ))}
        </div>
    );
}

function Note({ tone, title, text }: { tone: "info" | "bad" | "warn"; title: string; text?: string }) {
    const style = { info: "bg-lp-accent-bg text-lp-accent-ink", bad: "bg-lp-bad-bg text-lp-bad", warn: "bg-lp-warn-bg text-lp-warn" }[tone];
    const icon = tone === "warn"
        ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>
        : tone === "bad" ? <><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></> : <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></>;
    return (
        <div role={tone === "info" ? "status" : "alert"} className={cx("flex items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-[14px] font-bold", style)}>
            <Svg className="mt-px h-[18px] w-[18px]">{icon}</Svg>
            <span className="flex flex-col gap-0.5">{title}{text && <span className="text-[13px] font-semibold opacity-90">{text}</span>}</span>
        </div>
    );
}

/** Logo, the card, and below it the language, the theme and which server this is. */
function AuthShell({ children, langsBelow }: { children: React.ReactNode; langsBelow: boolean }) {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const [version, setVersion] = useState<string | null>(null);
    const [host, setHost] = useState("");
    const [dark, setDark] = useState(false);
    useEffect(() => {
        setHost(window.location.host);
        api.version().then((d) => setVersion(d?.server_version ? String(d.server_version).trim() : null)).catch(() => { });
    }, []);
    useEffect(() => {
        setDark(document.documentElement.classList.contains("dark"));
    }, [theme]);
    return (
        <div className="lp-mesh flex min-h-screen items-center justify-center overflow-y-auto px-4 py-10 font-sans text-lp-ink">
            <main className="flex w-full max-w-[440px] flex-col items-center gap-[22px]">
                <div className="flex flex-col items-center gap-2.5">
                    <div className="flex items-center gap-3">
                        <img src="/icons/logo.svg" alt="" width={44} height={44} className="block h-11 w-11" />
                        <div className="flex flex-col leading-tight">
                            <span className="text-[22px] font-extrabold tracking-[-0.02em]">LabelPilot</span>
                            <span className="text-[13px] font-bold text-lp-ink-3">{t("nav.server")}</span>
                        </div>
                    </div>
                    <div className="flex h-1 w-[120px] overflow-hidden rounded-full" aria-hidden="true">
                        <span className="flex-[3] bg-[#E8524F]" />
                        <span className="flex-[2] bg-[#6FA2D6]" />
                    </div>
                </div>
                <section className="lp-glass flex w-full flex-col gap-4 rounded-[26px] p-7 backdrop-blur-xl">{children}</section>
                <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2.5 text-[12px] font-bold text-lp-ink-3">
                    {langsBelow && <LangPills />}
                    <button
                        type="button"
                        aria-label={dark ? t("authui.themeLight") : t("authui.themeDark")}
                        title={dark ? t("authui.themeLight") : t("authui.themeDark")}
                        onClick={() => setTheme(dark ? "light" : "dark")}
                        className="lp-glass flex h-10 w-10 items-center justify-center rounded-[12px] text-lp-ink-2 backdrop-blur-xl transition hover:text-lp-ink"
                    >
                        <Svg>{dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> : <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />}</Svg>
                    </button>
                    <span className="font-mono">{version ? `LabelPilot Server ${version} · ` : ""}{host}</span>
                </div>
            </main>
        </div>
    );
}

// ─── LoginScreen ──────────────────────────────────────────────────────────────

type Failure = { text: string; left: number | null };

export function LoginScreen() {
    const { login, sessionEnded } = useAuth();
    const { t } = useTranslation();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [show, setShow] = useState(false);
    const [caps, setCaps] = useState(false);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [lockedUntil, setLockedUntil] = useState<number | null>(null);
    const [help, setHelp] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    // While locked, tick so the minutes count down and the button comes back by itself.
    useEffect(() => {
        if (!lockedUntil) return;
        const id = window.setInterval(() => {
            setNow(Date.now());
            if (Date.now() >= lockedUntil) setLockedUntil(null);
        }, 10_000);
        return () => window.clearInterval(id);
    }, [lockedUntil]);
    const minutesLeft = lockedUntil ? Math.max(1, Math.ceil((lockedUntil - now) / 60_000)) : 0;

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy || lockedUntil) return;
        setBusy(true);
        try {
            await login(username.trim(), password);
            // On success, refresh() inside login() flips the gate to the app.
        } catch (err) {
            setPassword("");
            if (err instanceof LoginError && err.lockedFor) {
                setFailure(null);
                setNow(Date.now());
                setLockedUntil(Date.now() + err.lockedFor * 1000);
            } else {
                const left = err instanceof LoginError ? err.attemptsLeft : null;
                setFailure({ text: t("authui.wrong"), left });
            }
            setBusy(false);
        }
    };

    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState("CapsLock"));

    return (
        <AuthShell langsBelow>
            {sessionEnded && !failure && !lockedUntil && <Note tone="info" title={t("authui.expired")} text={t("authui.expiredWhy")} />}
            {failure && !lockedUntil && <Note tone="bad" title={failure.text} text={failure.left != null && failure.left <= 2 ? t("authui.attemptsLeft", { count: failure.left }) : undefined} />}
            {lockedUntil && <Note tone="warn" title={t("authui.lockedTitle")} text={t("authui.lockedText", { minutes: minutesLeft })} />}
            <div className="flex flex-col gap-1">
                <h1 className="m-0 text-[30px] font-extrabold leading-[1.1] tracking-[-0.025em]">{t("authui.title")}</h1>
                <p className="m-0 text-[14px] text-lp-ink-2">{t("authui.lead")}</p>
            </div>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <Field
                    id="login-user"
                    labelText={t("authui.login")}
                    icon={PERSON}
                    type="text"
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => {
                        setUsername(e.target.value);
                        // The lock is per login (and per computer after many logins): another
                        // login may try, the server answers if this computer is closed too.
                        setLockedUntil(null);
                        setFailure(null);
                    }}
                />
                <Field
                    id="login-pass"
                    labelText={t("authui.password")}
                    icon={LOCK}
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={onKey}
                    onKeyUp={onKey}
                    show={show}
                    onToggleShow={() => setShow(!show)}
                />
                {caps && (
                    <span className="-mt-2 flex items-center gap-1.5 text-[12px] font-extrabold text-lp-warn">
                        <Svg className="h-3.5 w-3.5"><path d="M12 4l7 8h-4v6H9v-6H5z" /></Svg>
                        {t("authui.caps")}
                    </span>
                )}
                <button type="submit" disabled={busy || !!lockedUntil} className={cx(primaryButton, "min-h-[50px] w-full text-[15px]")}>
                    {lockedUntil ? t("authui.wait", { minutes: minutesLeft }) : busy ? t("authui.submitting") : t("authui.submit")}
                </button>
            </form>
            <button type="button" aria-expanded={help} onClick={() => setHelp(!help)} className={cx(linkButton, "w-fit text-[14px]")}>{t("authui.forgot")}</button>
            {help && (
                <div className="flex flex-col gap-2.5 rounded-[16px] border border-lp-line bg-lp-raised px-4 py-3.5 text-[14px]">
                    <b>{t("authui.helpTitle")}</b>
                    <p className="m-0 text-lp-ink-2">{t("authui.helpOther")}</p>
                    <b>{t("authui.helpSoleTitle")}</b>
                    <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-lp-ink-2">
                        <li>{t("authui.helpStep1")}</li>
                        <li>{t("authui.helpStep2")}</li>
                        <li>{t("authui.helpStep3")}</li>
                    </ol>
                </div>
            )}
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
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // The server also refuses common passwords; do not call that one «подходит» afterwards.
    const [refused, setRefused] = useState<string | null>(null);

    const login = username.trim();
    const problem = passwordProblem(password, login);
    const rule = problem
        ? { tone: "warn", text: `${t(problem)} ${t("pw.rule")}` }
        : password && confirm && password !== confirm ? { tone: "warn", text: t("authui.mismatch") }
            : password && password === confirm && password !== refused ? { tone: "ok", text: t("pw.ok") }
                : { tone: "", text: t("pw.rule") };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        if (!login) return setError(t("authui.needLogin"));
        if (!password || problem) return setError(problem ? t(problem) : t("pw.rule"));
        if (password !== confirm) return setError(t("authui.mismatch"));
        setBusy(true);
        setError(null);
        try {
            await bootstrap(login, password);
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : t("authui.createFailed"));
            setRefused(password);
            setBusy(false);
        }
    };

    return (
        <AuthShell langsBelow={false}>
            <div className="flex items-center gap-3">
                <span className="lp-tile lp-tile-people flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] text-white" aria-hidden="true">
                    <Svg className="h-6 w-6"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></Svg>
                </span>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-extrabold text-lp-g-people">{t("authui.firstEyebrow")}</span>
                    <h1 className="m-0 text-[30px] font-extrabold leading-[1.1] tracking-[-0.025em]">{t("authui.firstTitle")}</h1>
                </div>
            </div>
            <p className="m-0 text-[14px] text-lp-ink-2">{t("authui.firstLead")}</p>
            <div className="flex flex-col gap-1.5">
                <span className={label}>{t("authui.langLabel")}</span>
                <LangPills plain />
            </div>
            {error && <Note tone="bad" title={error} />}
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <Field id="first-user" labelText={t("authui.login")} icon={PERSON} type="text" autoFocus autoComplete="username" placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} />
                <Field id="first-pass" labelText={t("authui.password")} icon={LOCK} type={show ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} show={show} onToggleShow={() => setShow(!show)} />
                <Field id="first-pass2" labelText={t("authui.repeat")} icon={LOCK} type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} show={show} />
                <span className={cx("-mt-1 text-[12px]", rule.tone === "warn" ? "font-bold text-lp-warn" : rule.tone === "ok" ? "font-bold text-lp-ok" : "text-lp-ink-3")}>{rule.text}</span>
                <button type="submit" disabled={busy} className={cx(primaryButton, "min-h-[50px] w-full text-[15px]")}>
                    {busy ? t("authui.creating") : t("authui.create")}
                </button>
            </form>
            <span className="text-[12px] text-lp-ink-3">{t("authui.firstNote")}</span>
        </AuthShell>
    );
}
