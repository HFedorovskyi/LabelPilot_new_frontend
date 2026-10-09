"use client";

// «Доступ к серверу»: who may sign in to this admin panel and with what role. Two tiles say
// what each role may do (and warn when nobody could take over from a sole admin who forgets
// the password); one list of accounts with the last sign-in, edited and added in the row.
// Accounts nobody uses any more are the one problem worth a card.

import React, { useCallback, useEffect, useState } from "react";
import { usersApi, type ManagedUser, type UpdateUserPayload } from "@/lib/api/users";
import type { Role } from "@/lib/api/auth";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { useTranslation } from "@/lib/i18n";
import { copyText } from "@/lib/clipboard";
import { generatePassword, passwordProblem } from "@/lib/passwords";
import PageTitle from "@/app/components/shell/PageTitle";
import type { NavKey } from "@/app/components/shell/Sidebar";
import { cx, Icon } from "@/app/components/stations/shared";
import { dangerLink, linkButton, primaryButton } from "@/app/components/print/shared";

type Draft = { id: number | "new"; login: string; name: string; role: Role; password: string; show: boolean; active: boolean };
type Handover = { login: string; password: string };
// `details`: the handover lines to write down when copying failed.
type Flash = { ok: boolean; text: string; handover?: Handover; details?: string };

const GRID = "grid grid-cols-[minmax(0,1fr)_40px] items-center gap-x-3.5 md:grid-cols-[minmax(0,1.5fr)_170px_minmax(0,1fr)_40px]";
const input = "min-h-[40px] w-full rounded-[10px] border border-lp-line-2 bg-lp-surface px-3 text-[14px] font-bold text-lp-ink outline-none transition focus:border-lp-accent";
const label = "text-[12px] font-extrabold text-lp-ink-3";
const DAY = 86_400_000;
// A login nobody typed for this long, or an account never used this long after it was added.
const STALE_DAYS = 90;
const UNUSED_DAYS = 7;

const initials = (u: ManagedUser) => (u.name || u.username).split(/[\s·,]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
const daysSince = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / DAY);
const isStale = (u: ManagedUser, meId: number | undefined) =>
    u.is_active && u.id !== meId && (u.last_login ? daysSince(u.last_login) >= STALE_DAYS : daysSince(u.date_joined) >= UNUSED_DAYS);

const Eye = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
    </svg>
);
const Shield = ({ className = "h-[22px] w-[22px]" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" />
    </svg>
);
const Person = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]" aria-hidden="true">
        <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
);

export default function AccessPage({ host, onNavigate }: { host: string; onNavigate?: (key: NavKey) => void }) {
    const { t, lang } = useTranslation();
    const { user: me } = useAuth();
    const [users, setUsers] = useState<ManagedUser[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [onlyStale, setOnlyStale] = useState(false);
    const [open, setOpen] = useState<number | "new" | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [confirm, setConfirm] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState<Flash | null>(null);

    const load = useCallback(async () => {
        setUsers(await usersApi.list());
        setLoadError(null);
    }, []);
    useEffect(() => {
        load().catch((e) => setLoadError(e instanceof Error ? e.message : t("acc.loadFailed")));
    }, [load, t]);

    const all = users ?? [];
    const admins = all.filter((u) => u.is_active && u.role === "admin");
    const managers = all.filter((u) => u.is_active && u.role !== "admin");
    const stale = all.filter((u) => isStale(u, me?.id));
    const soleAdmin = (u: ManagedUser) => u.role === "admin" && u.is_active && admins.length === 1;
    const rank = (u: ManagedUser) => (u.is_active ? 0 : 2) + (u.role === "admin" ? 0 : 1);
    const visible = all
        .filter((u) => !onlyStale || isStale(u, me?.id))
        .sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username, lang));

    const date = (iso: string) => new Date(iso).toLocaleDateString(lang, { day: "numeric", month: "long", ...(new Date(iso).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
    const time = (iso: string) => new Date(iso).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
    const seenText = (iso: string) => {
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);
        const at = Date.parse(iso);
        if (at >= midnight.getTime()) return t("acc.seenToday", { time: time(iso) });
        if (at >= midnight.getTime() - DAY) return t("acc.seenYesterday", { time: time(iso) });
        return t("acc.daysAgo", { days: daysSince(iso) });
    };
    const staleWhy = (u: ManagedUser) =>
        u.last_login ? t("acc.staleSeen", { login: u.username, days: daysSince(u.last_login) }) : t("acc.staleNever", { login: u.username, date: date(u.date_joined) });

    const startEdit = (u: ManagedUser) => {
        setOpen(u.id);
        setDraft({ id: u.id, login: u.username, name: u.name, role: u.role === "admin" ? "admin" : "manager", password: "", show: false, active: u.is_active });
        setConfirm(null);
        setFlash(null);
    };
    const startNew = (role: Role) => {
        setOpen("new");
        setDraft({ id: "new", login: "", name: "", role, password: "", show: false, active: true });
        setConfirm(null);
        setFlash(null);
        setOnlyStale(false);
    };
    const close = () => {
        setOpen(null);
        setDraft(null);
        setConfirm(null);
    };

    const fail = (e: unknown) => setFlash({ ok: false, text: e instanceof Error && e.message ? e.message : t("acc.saveFailed") });

    const save = async () => {
        if (!draft) return;
        const login = draft.login.trim();
        if (draft.id === "new" && (!login || !draft.password)) return setFlash({ ok: false, text: t("acc.loginPasswordRequired") });
        const problem = passwordProblem(draft.password, login);
        if (problem) return setFlash({ ok: false, text: t(problem) });
        const name = draft.name.trim();
        setBusy(true);
        try {
            if (draft.id === "new") {
                await usersApi.create({ username: login, password: draft.password, role: draft.role, name });
                await load();
                close();
                setFlash({ ok: true, text: t("acc.added", { login, address: `${window.location.protocol}//${host}` }), handover: { login, password: draft.password } });
                return;
            }
            const before = all.find((u) => u.id === draft.id);
            if (!before) return;
            const payload: UpdateUserPayload = {};
            if (name !== before.name) payload.name = name;
            if (draft.role !== (before.role === "admin" ? "admin" : "manager")) payload.role = draft.role;
            if (draft.active !== before.is_active) payload.is_active = draft.active;
            if (draft.password) payload.password = draft.password;
            if (Object.keys(payload).length) await usersApi.update(draft.id, payload);
            await load();
            close();
            const self = draft.id === me?.id;
            const parts = [t("acc.saved", { login })];
            if (draft.password) parts.push(t(self ? "acc.savedOwnPassword" : "acc.savedPassword"));
            if (before.is_active && !draft.active) parts.push(t("acc.savedClosed"));
            setFlash({ ok: true, text: parts.join(" ") });
        } catch (e) {
            fail(e);
        } finally {
            setBusy(false);
        }
    };

    const remove = async (u: ManagedUser) => {
        setBusy(true);
        try {
            await usersApi.remove(u.id);
            await load();
            close();
            setFlash({ ok: true, text: t("acc.deleted", { login: u.username }) });
        } catch (e) {
            fail(e);
        } finally {
            setBusy(false);
        }
    };

    const copyHandover = async (handover: Handover) => {
        const text = [
            `${t("acc.handoverAddress")}: ${window.location.protocol}//${host}`,
            `${t("acc.handoverLogin")}: ${handover.login}`,
            `${t("acc.handoverPassword")}: ${handover.password}`,
        ].join("\n");
        setFlash(await copyText(text) ? { ok: true, text: t("acc.copied") } : { ok: false, text: t("acc.copyFailed"), details: text });
    };

    const roleSwitch = (id: string, locked: boolean) => draft && (
        <div className="flex min-w-0 max-w-[300px] flex-[1_1_260px] flex-col gap-1">
            <span id={`acc-role-${id}`} className={label}>{t("acc.role")}</span>
            <div role="group" aria-labelledby={`acc-role-${id}`} className="flex gap-[3px] rounded-[11px] bg-lp-bg p-[3px]">
                {(["manager", "admin"] as const).map((role) => (
                    <button
                        key={role}
                        type="button"
                        aria-pressed={draft.role === role}
                        disabled={locked}
                        onClick={() => setDraft({ ...draft, role })}
                        className={cx("min-h-[34px] flex-1 rounded-[9px] border-0 px-3 text-[13px] font-extrabold disabled:cursor-not-allowed disabled:opacity-60", draft.role === role ? "bg-lp-surface text-lp-ink shadow-sm" : "bg-transparent text-lp-ink-3")}
                    >
                        {role === "admin" ? t("app.roleAdmin") : t("app.roleManager")}
                    </button>
                ))}
            </div>
        </div>
    );

    const passwordField = (id: string, isNew: boolean) => draft && (
        <>
            <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1 md:max-w-[250px]">
                <label htmlFor={`acc-pw-${id}`} className={label}>{isNew ? t("acc.password") : t("acc.newPassword")}</label>
                <div className="relative">
                    <input
                        id={`acc-pw-${id}`}
                        type={draft.show ? "text" : "password"}
                        autoComplete="new-password"
                        value={draft.password}
                        placeholder={isNew ? "" : t("acc.keepPassword")}
                        onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                        className={cx(input, "pr-11", draft.show && "font-mono")}
                    />
                    <button
                        type="button"
                        aria-label={t("acc.showPassword")}
                        aria-pressed={draft.show}
                        onClick={() => setDraft({ ...draft, show: !draft.show })}
                        className="absolute right-0.5 top-0.5 flex h-9 w-9 items-center justify-center rounded-[8px] text-lp-ink-3 transition hover:text-lp-ink"
                    >
                        <Eye />
                    </button>
                </div>
            </div>
            <button type="button" onClick={() => setDraft({ ...draft, password: generatePassword(), show: true })} className={cx(linkButton, "min-h-[40px] text-[14px]")}>
                {t("acc.generate")}
            </button>
        </>
    );

    const hintFor = (u: ManagedUser | null) => {
        if (!draft) return { tone: "", text: "" };
        const login = (u?.username ?? draft.login).trim();
        if (!u && login && all.some((other) => other.username.toLowerCase() === login.toLowerCase())) return { tone: "warn", text: t("acc.loginTaken", { login }) };
        const problem = passwordProblem(draft.password, login);
        if (problem) return { tone: "warn", text: `${t(problem)} ${t("pw.rule")}` };
        const self = u?.id === me?.id;
        if (draft.password) return { tone: "ok", text: `${t("pw.ok")}${u ? ` ${t(self ? "acc.pwOkSelf" : "acc.pwOkOthers")}` : ""}` };
        if (!u) return { tone: "", text: `${t("pw.rule")} ${t(draft.role === "admin" ? "acc.newAdminHint" : "acc.newManagerHint")}` };
        if (self) return { tone: "", text: t("acc.selfHint") };
        if (soleAdmin(u)) return { tone: "", text: t("acc.soleAdminHint") };
        return { tone: "", text: `${t("pw.rule")} ${t("acc.pwOthersHint")}` };
    };

    const editRow = (u: ManagedUser | null) => {
        if (!draft) return null;
        const id = String(draft.id);
        const self = u?.id === me?.id;
        const locked = !!u && (self || soleAdmin(u));
        const hint = hintFor(u);
        return (
            <div
                className={cx("order-2 col-span-full flex flex-wrap items-end gap-3 pb-3 pt-1.5", u && "md:pl-[50px]")}
                onKeyDown={(e) => {
                    if (e.key === "Escape") close();
                    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && (e.target as HTMLInputElement).type !== "checkbox") void save();
                }}
            >
                {!u && (
                    <div className="flex min-w-0 flex-[1_1_160px] flex-col gap-1 md:max-w-[200px]">
                        <label htmlFor="acc-login-new" className={label}>{t("acc.login")}</label>
                        <input id="acc-login-new" autoFocus autoComplete="off" maxLength={150} value={draft.login} placeholder={t("acc.loginPlaceholder")} onChange={(e) => setDraft({ ...draft, login: e.target.value.replace(/\s/g, "") })} className={input} />
                    </div>
                )}
                <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
                    <label htmlFor={`acc-name-${id}`} className={label}>{t("acc.who")}</label>
                    <input id={`acc-name-${id}`} autoFocus={!!u} maxLength={150} value={draft.name} placeholder={t("acc.whoPlaceholder")} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={input} />
                </div>
                {roleSwitch(id, locked)}
                {passwordField(id, !u)}
                {u && (
                    <label className={cx("flex min-h-[40px] items-center gap-2 text-[14px] font-bold text-lp-ink", locked && "opacity-60")}>
                        <input type="checkbox" checked={draft.active} disabled={locked} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--lp-accent))]" />
                        {t("acc.canSignIn")}
                    </label>
                )}
                <span className={cx("basis-full text-[12px]", hint.tone === "warn" ? "font-bold text-lp-warn" : hint.tone === "ok" ? "font-bold text-lp-ok" : "text-lp-ink-3")}>{hint.text}</span>
                <div className="flex basis-full flex-wrap items-center gap-x-4 gap-y-2">
                    <button type="button" disabled={busy} onClick={() => void save()} className={cx(primaryButton, "min-h-[40px]")}>{u ? t("acc.save") : t("acc.addShort")}</button>
                    <button type="button" onClick={close} className={cx(linkButton, "text-[14px]")}>{t("acc.cancel")}</button>
                    <span className="flex-1" />
                    {u && !locked && <button type="button" onClick={() => setConfirm(u.id)} className={cx(dangerLink, "text-[14px]")}>{t("acc.delete")}</button>}
                </div>
                {u && confirm === u.id && (
                    <div className="flex basis-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-lp-line pt-2.5">
                        <span className="text-[14px] font-bold text-lp-ink">{t("acc.deleteAsk", { login: u.username })}</span>
                        <button type="button" disabled={busy} onClick={() => void remove(u)} className={cx(dangerLink, "text-[14px]")}>{t("acc.deleteYes")}</button>
                        <button type="button" onClick={() => setConfirm(null)} className={cx(linkButton, "text-[14px]")}>{t("acc.no")}</button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
            <PageTitle
                icon="users"
                eyebrow={t("nav.groupPeople")}
                title={t("nav.users")}
                description={<>{t("acc.lead")} <button type="button" onClick={() => onNavigate?.("operators")} className={cx(linkButton, "text-[14px]")}>{t("acc.leadLink")}</button>.</>}
            >
                <button type="button" onClick={() => startNew("manager")} className={cx(primaryButton, "flex items-center gap-2")}>
                    <Icon name="plus" className="h-5 w-5" />
                    {t("acc.add")}
                </button>
            </PageTitle>

            {stale.length > 0 && !onlyStale && (
                <div className="lp-card flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                    <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] bg-lp-warn-bg text-lp-warn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    </span>
                    <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-0.5">
                        <span className="text-[16px] font-extrabold text-lp-ink">{stale.length === 1 ? t("acc.staleTitleOne") : t("acc.staleTitle", { count: stale.length })}</span>
                        <span className="text-[14px] text-lp-ink-2">{t("acc.staleText", { list: stale.map(staleWhy).join("; ") })}</span>
                    </div>
                    <button type="button" onClick={() => { close(); setOnlyStale(true); }} className="min-h-[40px] rounded-[10px] border border-lp-line-2 bg-lp-surface px-3.5 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised">
                        {t("acc.show")}
                    </button>
                </div>
            )}

            {users && (
                <div className="grid gap-3.5 md:grid-cols-2">
                    <section className="lp-card flex min-w-0 flex-col gap-2.5 p-[18px]">
                        <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-lp-g-people/[0.13] text-lp-g-people"><Shield /></span>
                            <h2 className="m-0 text-[15px] font-extrabold text-lp-ink">{t("acc.admins")}</h2>
                            <span className="ml-auto text-[34px] font-extrabold leading-none tracking-[-0.03em] text-lp-ink">{admins.length}</span>
                        </div>
                        <p className="m-0 text-[14px] text-lp-ink-2">{t("acc.adminsCan")}</p>
                        {admins.length === 1 && (
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-[12px] bg-lp-warn-bg px-3 py-2.5 text-[13px] font-bold text-lp-warn">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 flex-none" aria-hidden="true"><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.5" /></svg>
                                <span className="min-w-0 flex-[1_1_260px]">{t("acc.noSpare")}</span>
                                <button type="button" onClick={() => startNew("admin")} className={linkButton}>{t("acc.addSpare")}</button>
                            </div>
                        )}
                    </section>
                    <section className="lp-card flex min-w-0 flex-col gap-2.5 p-[18px]">
                        <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-lp-ink/[0.05] text-lp-ink-2"><Person /></span>
                            <h2 className="m-0 text-[15px] font-extrabold text-lp-ink">{t("acc.managers")}</h2>
                            <span className="ml-auto text-[34px] font-extrabold leading-none tracking-[-0.03em] text-lp-ink">{managers.length}</span>
                        </div>
                        <p className="m-0 text-[14px] text-lp-ink-2">{t("acc.managersCan")}</p>
                    </section>
                </div>
            )}

            {flash && (
                <p role="status" className={cx("m-0 flex flex-wrap items-start gap-x-2 text-[14px] font-bold", flash.ok ? "text-lp-ok" : "text-lp-bad")}>
                    <span aria-hidden="true">{flash.ok ? "●" : "■"}</span>
                    <span className="min-w-0 flex-[1_1_300px]">
                        {flash.text}
                        {flash.handover && (
                            <button type="button" onClick={() => void copyHandover(flash.handover!)} className={cx(linkButton, "ml-2 text-[14px]")}>{t("acc.copyHandover")}</button>
                        )}
                        {flash.details && <span className="mt-1.5 block w-fit select-all whitespace-pre-wrap rounded-[10px] bg-lp-surface px-3 py-2 font-mono text-[13px] font-semibold text-lp-ink shadow-sm">{flash.details}</span>}
                    </span>
                </p>
            )}

            {onlyStale && (
                <div>
                    <button type="button" onClick={() => setOnlyStale(false)} className="min-h-[40px] rounded-[10px] border border-lp-warn bg-lp-surface px-3.5 text-[14px] font-extrabold text-lp-warn transition hover:bg-lp-raised">
                        {t("acc.onlyStale")} ✕
                    </button>
                </div>
            )}

            {users === null ? (
                <p className={cx("lp-card m-0 p-7 text-center text-[14px]", loadError ? "font-bold text-lp-bad" : "text-lp-ink-3")}>{loadError ?? t("acc.loading")}</p>
            ) : (
                <section className="lp-card overflow-hidden" aria-label={t("nav.users")}>
                    <div className={cx(GRID, "hidden border-b border-lp-line px-[18px] py-3 text-[12px] font-extrabold text-lp-ink-3 md:grid")}>
                        <span>{t("acc.col.user")}</span>
                        <span>{t("acc.role")}</span>
                        <span>{t("acc.col.seen")}</span>
                        <span />
                    </div>
                    {open === "new" && (
                        <div className={cx(GRID, "border-b border-lp-line bg-lp-raised px-[18px] py-2")}>
                            <span className="col-span-full flex min-h-[48px] items-center gap-3 text-[15px] font-extrabold text-lp-ink">
                                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-lp-accent-bg text-lp-accent-ink"><Icon name="plus" className="h-5 w-5" /></span>
                                {draft?.role === "admin" ? t("acc.newAdmin") : t("acc.newUser")}
                            </span>
                            {editRow(null)}
                        </div>
                    )}
                    {visible.length === 0 && <p className="m-0 p-6 text-center text-[14px] text-lp-ink-3">{t("acc.nothing")}</p>}
                    {visible.map((u) => {
                        const isOpen = open === u.id;
                        const self = u.id === me?.id;
                        const admin = u.role === "admin";
                        const dim = !u.is_active && "opacity-55";
                        return (
                            <div key={u.id} className={cx(GRID, "min-h-[66px] border-b border-lp-line px-[18px] py-2 last:border-b-0", isOpen && "bg-lp-raised")}>
                                <button type="button" aria-expanded={isOpen} onClick={() => (isOpen ? close() : startEdit(u))} className="flex min-w-0 items-center gap-3 text-left">
                                    <span className={cx("flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold", admin ? "bg-lp-g-people/[0.13] text-lp-g-people" : "bg-lp-ink/[0.05] text-lp-ink-2", dim)}>{initials(u)}</span>
                                    <span className="flex min-w-0 flex-col">
                                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                            <span className={cx("min-w-0 truncate text-[15px] font-extrabold text-lp-ink", dim)}>{u.username}</span>
                                            {self && <span className="rounded-full bg-lp-accent-bg px-2.5 py-0.5 text-[12px] font-extrabold text-lp-accent-ink">{t("acc.you")}</span>}
                                            {!u.is_active && <span className="rounded-full bg-lp-ink/[0.05] px-2.5 py-0.5 text-[12px] font-extrabold text-lp-ink-3">{t("acc.closed")}</span>}
                                        </span>
                                        <span className={cx("truncate text-[13px] text-lp-ink-3", dim)}>{u.name || t("acc.noName")}</span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    aria-label={t("acc.editNamed", { login: u.username })}
                                    title={t("acc.edit")}
                                    onClick={() => (isOpen ? close() : startEdit(u))}
                                    className="flex h-9 w-9 items-center justify-center rounded-[10px] text-lp-ink-3 transition hover:bg-lp-ink/[0.05] hover:text-lp-ink md:order-1"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
                                </button>
                                {/* Narrow: role and last sign-in on a second line; wide: their own columns. */}
                                <span className="col-span-full flex flex-wrap items-center gap-x-3 gap-y-1 pb-1 pl-[50px] md:contents">
                                    <span className={cx("inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-extrabold", admin ? "bg-lp-g-people/[0.13] text-lp-g-people" : "bg-lp-ink/[0.05] text-lp-ink-2", dim)}>
                                        {admin && <Shield className="h-3 w-3" />}
                                        {admin ? t("app.roleAdmin") : t("app.roleManager")}
                                    </span>
                                    <span className={cx("min-w-0", dim)}>
                                        <span
                                            title={u.last_login ? `${date(u.last_login)}, ${time(u.last_login)}` : undefined}
                                            className={cx("text-[14px] font-bold md:block", isStale(u, me?.id) ? "text-lp-warn" : "text-lp-ink-2")}
                                        >
                                            {u.last_login ? seenText(u.last_login) : t("acc.never")}
                                        </span>
                                        {!u.last_login && <span className="ml-2 text-[12px] font-semibold text-lp-ink-3 md:ml-0 md:block">{t("acc.listedSince", { date: date(u.date_joined) })}</span>}
                                    </span>
                                </span>
                                {isOpen && editRow(u)}
                            </div>
                        );
                    })}
                </section>
            )}
        </div>
    );
}
