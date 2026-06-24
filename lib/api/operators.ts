declare const process: any;

import { apiFetch } from "./client";

// ─── Operator types ──────────────────────────────────────────────────────────
// Mirrors GET /api/v1/operators/ (manager OR admin). Operators are factory-floor
// workers managed on the server and synced to client stations.
//
// `pin` is a short numeric PIN — WRITE-ONLY (the server hashes it). The list
// never returns the PIN itself, only `has_pin` (bool). `station` is a station id
// or null (= all stations).

export interface Operator {
    id: number;
    uuid: string;
    full_name: string;
    short_code: string | null;
    is_active: boolean;
    station: number | null;
    has_pin: boolean;
}

export interface CreateOperatorPayload {
    full_name: string;
    short_code?: string | null;
    pin?: string | null;
    station?: number | null;
    is_active?: boolean;
}

export interface UpdateOperatorPayload {
    full_name?: string;
    short_code?: string | null;
    pin?: string | null;
    station?: number | null;
    is_active?: boolean;
}

// Runtime-resolved API base — same mechanism as the rest of lib/api.
function resolveApiBase(): string {
    if (typeof window !== "undefined") {
        return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
    }
    return (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "http://localhost:8000/api/v1";
}
const API_BASE = resolveApiBase();

/** Pull a human-readable (RU) error message out of a non-ok operators response. */
async function readError(res: Response, fallback: string): Promise<string> {
    const data = await res.json().catch(() => ({} as any));
    return (
        data?.detail ||
        data?.error ||
        data?.full_name?.[0] ||
        data?.short_code?.[0] ||
        data?.pin?.[0] ||
        data?.station?.[0] ||
        fallback
    );
}

export const operatorsApi = {
    list: async (): Promise<Operator[]> => {
        const res = await apiFetch(`${API_BASE}/operators/`);
        if (!res.ok) throw new Error("Не удалось загрузить операторов");
        return res.json();
    },
    create: async (payload: CreateOperatorPayload): Promise<Operator> => {
        const res = await apiFetch(`${API_BASE}/operators/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readError(res, "Не удалось создать оператора"));
        return res.json();
    },
    update: async (id: number, payload: UpdateOperatorPayload): Promise<Operator> => {
        const res = await apiFetch(`${API_BASE}/operators/${id}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readError(res, "Не удалось обновить оператора"));
        return res.json();
    },
    remove: async (id: number): Promise<void> => {
        const res = await apiFetch(`${API_BASE}/operators/${id}/`, { method: "DELETE" });
        if (!res.ok) throw new Error(await readError(res, "Не удалось удалить оператора"));
    },
};
