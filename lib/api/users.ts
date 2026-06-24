declare const process: any;

import { apiFetch } from "./client";
import type { Role } from "./auth";

// ─── User types ─────────────────────────────────────────────────────────────
// Mirrors GET /api/v1/users/ (admin-only).

export interface ManagedUser {
    id: number;
    username: string;
    role: Role;
    is_active: boolean;
    is_superuser: boolean;
}

export interface CreateUserPayload {
    username: string;
    password: string;
    role: Role;
}

export interface UpdateUserPayload {
    role?: Role;
    is_active?: boolean;
    password?: string;
}

// Runtime-resolved API base — same mechanism as the rest of lib/api.
function resolveApiBase(): string {
    if (typeof window !== "undefined") {
        return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
    }
    return (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "http://localhost:8000/api/v1";
}
const API_BASE = resolveApiBase();

async function readError(res: Response, fallback: string): Promise<string> {
    const data = await res.json().catch(() => ({} as any));
    return data?.detail || data?.error || data?.username?.[0] || data?.password?.[0] || data?.role?.[0] || fallback;
}

export const usersApi = {
    list: async (): Promise<ManagedUser[]> => {
        const res = await apiFetch(`${API_BASE}/users/`);
        if (!res.ok) throw new Error("Не удалось загрузить пользователей");
        return res.json();
    },
    create: async (payload: CreateUserPayload): Promise<ManagedUser> => {
        const res = await apiFetch(`${API_BASE}/users/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readError(res, "Не удалось создать пользователя"));
        return res.json();
    },
    update: async (id: number, payload: UpdateUserPayload): Promise<ManagedUser> => {
        const res = await apiFetch(`${API_BASE}/users/${id}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readError(res, "Не удалось обновить пользователя"));
        return res.json();
    },
    remove: async (id: number): Promise<void> => {
        const res = await apiFetch(`${API_BASE}/users/${id}/`, { method: "DELETE" });
        if (!res.ok) throw new Error(await readError(res, "Не удалось удалить пользователя"));
    },
};
