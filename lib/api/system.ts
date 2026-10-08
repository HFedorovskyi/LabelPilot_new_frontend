import { apiFetch } from "./client";
import { resolveApiBase } from "./base";

// Server updates and backups (backend api/system_views.py). The updater service listens on the
// server computer only; these calls go through the server, which lets only administrators
// start an update, a rollback or a backup.

export interface UpdateCheck {
    current: string;
    /** When the server last asked for a newer release (seconds since epoch). */
    checked_ts: number;
    updater: "online" | "offline";
    /** null: unknown (updater down, or no internet on the server). */
    available: boolean | null;
    version: string;
    changelog: string;
    published_at: string;
    /** false: that release ships only the full installer. */
    has_package: boolean;
    error: "" | "offline";
}

export interface UpdateProgress {
    status: "idle" | "running" | "done" | "error";
    progress: number;
    label: string;
    log: string | null;
    error: string | null;
}

export interface Backup {
    id: string;
    version: string;
    created_at: string;
    size_mb: number;
    reason: "update" | "manual";
}

const API_BASE = resolveApiBase();

async function json<T>(res: Response): Promise<T> {
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) throw new Error(data?.detail || data?.message || res.statusText);
    return data as T;
}

export const systemApi = {
    update: async (refresh = false): Promise<UpdateCheck> =>
        json(await apiFetch(`${API_BASE}/system/update/${refresh ? "?refresh=1" : ""}`)),
    startUpdate: async (): Promise<{ message?: string; version?: string }> =>
        json(await apiFetch(`${API_BASE}/system/update/`, { method: "POST" })),
    updateFromFile: async (file: File): Promise<{ message?: string }> => {
        const form = new FormData();
        form.append("file", file);
        return json(await apiFetch(`${API_BASE}/system/update/file/`, { method: "POST", body: form }));
    },
    progress: async (): Promise<UpdateProgress> => json(await apiFetch(`${API_BASE}/system/update/progress/`)),
    backups: async (): Promise<Backup[]> => (await json<{ backups: Backup[] }>(await apiFetch(`${API_BASE}/system/backups/`))).backups ?? [],
    backupNow: async (): Promise<Backup> => json(await apiFetch(`${API_BASE}/system/backups/`, { method: "POST" })),
    restore: async (id: string): Promise<{ message?: string }> =>
        json(await apiFetch(`${API_BASE}/system/backups/${encodeURIComponent(id)}/restore/`, { method: "POST" })),
};
