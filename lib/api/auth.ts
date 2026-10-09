declare const process: any;

import { apiFetch } from "./client";
import { resolveApiBase } from "./base";

// ─── Auth types ─────────────────────────────────────────────────────────────
// Mirrors the JSON returned by the Django session-cookie auth endpoints.

export type Role = "admin" | "manager";

export interface AuthUser {
    id: number;
    username: string;
    role: Role;
    is_superuser: boolean;
}

export interface BootstrapStatus {
    needs_bootstrap: boolean;
}

const API_BASE = resolveApiBase();

/** A refused sign-in: the server's message, tries left on this computer, seconds locked. */
export class LoginError extends Error {
    constructor(message: string, public attemptsLeft: number | null, public lockedFor: number | null) {
        super(message);
        this.name = "LoginError";
    }
}

/** Pull a human-readable error message out of a non-ok auth response. */
async function readError(res: Response, fallback: string): Promise<string> {
    const data = await res.json().catch(() => ({} as any));
    return data?.detail || data?.error || data?.username?.[0] || data?.password?.[0] || fallback;
}

export const authApi = {
    /**
     * Prime the `csrftoken` cookie. Call once on load BEFORE any write (login,
     * bootstrap, …). Uses apiFetch so credentials are included.
     */
    getCsrf: async (): Promise<void> => {
        await apiFetch(`${API_BASE}/auth/csrf/`);
    },

    /** Whether the very first admin still needs to be created (AllowAny). */
    bootstrapStatus: async (): Promise<BootstrapStatus> => {
        const res = await apiFetch(`${API_BASE}/auth/bootstrap-status/`);
        if (!res.ok) throw new Error("Failed to fetch bootstrap status");
        return res.json();
    },

    /** Create the FIRST admin. 201 on success, 409 if a user already exists. */
    bootstrap: async (username: string, password: string): Promise<AuthUser> => {
        const res = await apiFetch(`${API_BASE}/auth/bootstrap/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            throw new Error(await readError(res, "Не удалось создать администратора"));
        }
        return res.json();
    },

    /** Log in with username/password. Sets the sessionid cookie on success. A wrong password
     *  says how many tries this computer has left; too many lock it for a while (HTTP 429). */
    login: async (username: string, password: string): Promise<AuthUser> => {
        const res = await apiFetch(`${API_BASE}/auth/login/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({} as any));
            throw new LoginError(
                data?.detail || "",
                typeof data?.attempts_left === "number" ? data.attempts_left : null,
                typeof data?.locked_for === "number" ? data.locked_for : null,
            );
        }
        return res.json();
    },

    /** Log out the current session. */
    logout: async (): Promise<void> => {
        await apiFetch(`${API_BASE}/auth/logout/`, { method: "POST" });
    },

    /**
     * Current user, or null when not authenticated (403/401). Other failures
     * (network, 5xx) reject so the caller can distinguish "logged out" from
     * "server unreachable".
     */
    me: async (): Promise<AuthUser | null> => {
        const res = await apiFetch(`${API_BASE}/auth/me/`);
        if (res.status === 401 || res.status === 403) return null;
        if (!res.ok) throw new Error("Failed to fetch current user");
        return res.json();
    },
};
