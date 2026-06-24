"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usersApi, type ManagedUser } from "@/lib/api/users";
import type { Role } from "@/lib/api/auth";
import { useAuth } from "../auth/AuthProvider";

// ─── Helpers (match SettingsPage conventions) ─────────────────────────────────

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

const roleLabel: Record<Role, string> = {
    admin: "Администратор",
    manager: "Менеджер",
};

// ─── Create user form ─────────────────────────────────────────────────────────

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<Role>("manager");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        if (!username.trim() || !password) {
            setError("Укажите логин и пароль.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await usersApi.create({ username: username.trim(), password, role });
            setUsername("");
            setPassword("");
            setRole("manager");
            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Не удалось создать пользователя");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card>
            <div className="mb-4 text-sm font-semibold text-white">Новый пользователь</div>
            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/55">Логин</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={fieldCls} placeholder="user" autoComplete="off" />
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/55">Пароль</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldCls} placeholder="••••••••" autoComplete="new-password" />
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/55">Роль</label>
                    <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={cx(fieldCls, "cursor-pointer")}>
                        <option value="manager" className="bg-[#0d0e13]">Менеджер</option>
                        <option value="admin" className="bg-[#0d0e13]">Администратор</option>
                    </select>
                </div>
                <Btn type="submit" disabled={busy}>
                    {busy ? <Spinner className="h-4 w-4" /> : null}
                    Добавить
                </Btn>
            </form>
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

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({
    u,
    isSelf,
    onChanged,
    onError,
}: {
    u: ManagedUser;
    isSelf: boolean;
    onChanged: () => void;
    onError: (msg: string) => void;
}) {
    const [busy, setBusy] = useState(false);

    const run = async (fn: () => Promise<unknown>) => {
        if (busy) return;
        setBusy(true);
        try {
            await fn();
            onChanged();
        } catch (err) {
            onError(err instanceof Error ? err.message : "Операция не выполнена");
        } finally {
            setBusy(false);
        }
    };

    const changeRole = (role: Role) => {
        if (role === u.role) return;
        void run(() => usersApi.update(u.id, { role }));
    };

    const toggleActive = () => void run(() => usersApi.update(u.id, { is_active: !u.is_active }));

    const remove = () => {
        if (!confirm(`Удалить пользователя «${u.username}»? Это действие необратимо.`)) return;
        void run(() => usersApi.remove(u.id));
    };

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-indigo-400/20 text-[13px] uppercase text-indigo-200 ring-1 ring-indigo-400/30">
                    {u.username.slice(0, 1)}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">{u.username}</span>
                        {isSelf && <Badge color="blue">Вы</Badge>}
                        {!u.is_active && <Badge color="red">Отключён</Badge>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-white/45">
                        <Badge color={u.role === "admin" ? "yellow" : "neutral"}>{roleLabel[u.role]}</Badge>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {/* Role selector — disabled for the current user to avoid self-lockout. */}
                <select
                    value={u.role}
                    onChange={(e) => changeRole(e.target.value as Role)}
                    disabled={busy || isSelf}
                    title={isSelf ? "Нельзя менять собственную роль" : "Изменить роль"}
                    className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none transition focus:border-indigo-400/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <option value="manager" className="bg-[#0d0e13]">Менеджер</option>
                    <option value="admin" className="bg-[#0d0e13]">Администратор</option>
                </select>

                <Btn variant="secondary" onClick={toggleActive} disabled={busy || isSelf} className="px-3 py-1.5 text-xs">
                    {u.is_active ? "Отключить" : "Включить"}
                </Btn>

                <Btn variant="danger" onClick={remove} disabled={busy || isSelf} className="px-3 py-1.5 text-xs">
                    Удалить
                </Btn>

                {busy && <Spinner className="h-4 w-4 text-white/50" />}
            </div>
        </div>
    );
}

// ─── UsersManager ─────────────────────────────────────────────────────────────

export default function UsersManager() {
    const { user } = useAuth();
    const [users, setUsers] = useState<ManagedUser[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const data = await usersApi.list();
            setUsers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Не удалось загрузить пользователей");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="space-y-6">
            <CreateUserForm onCreated={load} />

            <Card>
                <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">Пользователи</div>
                    <Btn variant="ghost" onClick={load} className="px-3 py-1.5 text-xs">
                        Обновить
                    </Btn>
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-white/60">
                        <Spinner className="h-4 w-4" /> Загрузка пользователей…
                    </div>
                ) : error ? (
                    <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                        <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span>{error}</span>
                    </div>
                ) : users && users.length > 0 ? (
                    <div className="space-y-2">
                        {users.map((u) => (
                            <UserRow key={u.id} u={u} isSelf={u.id === user?.id} onChanged={load} onError={setError} />
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-white/50">Пользователей пока нет.</div>
                )}
            </Card>
        </div>
    );
}
