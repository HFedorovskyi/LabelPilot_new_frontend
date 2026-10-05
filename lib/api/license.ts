import { apiFetch } from "./client";
import { resolveApiBase } from "./base";

declare const process: any;

// ─── License status types ───────────────────────────────────────────────────
// Mirrors the JSON returned by GET /api/v1/license/ (AllowAny).

export type LicenseMode = "demo" | "licensed";

export interface LicenseInfo {
    licensed: boolean;
    mode: LicenseMode;
    edition: string;
    customer: string | null;
    expires: string | null; // "YYYY-MM-DD"
    expired: boolean;           // the expiry date has passed
    grace?: boolean;            // ...but the 14-day grace period still runs
    grace_until?: string | null;
    days_left?: number | null;  // to the expiry date (in grace: to grace_until)
    clock_rollback?: boolean;   // the server clock was turned back
    refresh?: { status: LicenseRefreshStatus; detail: string };
    max_stations: number | null;       // null = unlimited
    demo_max_stations: number | null;  // null (no demo cap)
    license_id: string | null;
    features: string[];
    machine_id: string;
    strict: boolean;
    signature_valid: boolean;
    machine_ok: boolean;
    stations_used: number;
    seats?: SeatSummary;
    seat_list?: SeatListStatus;
    seat_list_sync?: { status: SeatListSyncStatus; detail: string };
}

export type SeatListSyncStatus =
    "updated" | "rejected" | "not_found" | "unavailable" | "disabled" | "not_required";

// Vendor-signed seat list (licences with the "seat-list" feature). Counts only.
export interface SeatListStatus {
    required: boolean;
    present?: boolean;
    issued?: string | null;
    expires?: string | null;      // "YYYY-MM-DD"
    expired?: boolean;
    days_left?: number | null;
    renewal_due?: boolean;
    stations: number;             // fingerprints in the list
    limit?: number | null;
    missing: number;              // seated stations not in the list (they get no data)
    extra?: number;
    in_sync?: boolean;
    linked?: boolean;             // the sales service knows this installation
    sync_enabled?: boolean;
    last_sync?: { status: SeatListSyncStatus; detail: string; at: string } | null;
}

export type LicenseRefreshStatus =
    "updated" | "current" | "not_found" | "rejected" | "unavailable" | "disabled" | "no_license";

// Named-seat usage (GET /api/v1/license/ -> seats). limit null = unlimited.
export interface SeatSummary {
    limit: number | null;
    active: number;
    pending: number;
    released: number;
    fingerprinted: number;
    conflicts: number;
    over_limit: boolean;
    outside_cap?: number;   // active stations beyond the seat count (they get no data)
    releases_30d: number;
    release_allowance: number | null;
}

const API_BASE = resolveApiBase();

export const licenseApi = {
    get: async (): Promise<LicenseInfo> => {
        const res = await fetch(`${API_BASE}/license/`);
        if (!res.ok) throw new Error("Failed to fetch license status");
        return res.json();
    },

    // Admin-only: upload a license.lpl file to activate/replace the license. Uses apiFetch
    // for the session cookie + CSRF; the server verifies the Ed25519 signature and returns
    // the new status (no restart). Throws with the server's localized detail on failure.
    importLicense: async (file: File): Promise<LicenseInfo> => {
        const form = new FormData();
        form.append("file", file);
        const res = await apiFetch(`${API_BASE}/license/import/`, { method: "POST", body: form });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || err.error || "Failed to import license");
        }
        return res.json();
    },

    // Admin-only: ask the LabelPilot sales service for a renewed licence now (the server
    // also checks once a day when online). Returns the status plus `refresh.status`.
    refreshLicense: async (): Promise<LicenseInfo> => {
        const res = await apiFetch(`${API_BASE}/license/refresh/`, { method: "POST" });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || err.error || "Failed to check for a licence update");
        }
        return res.json();
    },

    // Admin-only: ask the sales service for a fresh seat list now (the server also renews
    // it daily and after every seat change). Returns the status plus `seat_list_sync`.
    syncSeatList: async (): Promise<LicenseInfo> => {
        const res = await apiFetch(`${API_BASE}/license/seat-list/`, { method: "POST" });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || err.error || "Failed to update the seat list");
        }
        return res.json();
    },

    // Admin-only (offline sites): save the request file to have signed in the customer cabinet.
    downloadSeatListRequest: async (): Promise<void> => {
        const res = await apiFetch(`${API_BASE}/license/seat-list/request/`, { method: "GET" });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || err.error || "Failed to create the seat list request");
        }
        const disposition = res.headers.get("Content-Disposition") || "";
        const name = /filename="([^"]+)"/.exec(disposition)?.[1] || "seat-request.json";
        const url = URL.createObjectURL(await res.blob());
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    },

    // Admin-only (offline sites): install the seat list signed in the customer cabinet.
    importSeatList: async (file: File): Promise<LicenseInfo> => {
        const form = new FormData();
        form.append("file", file);
        const res = await apiFetch(`${API_BASE}/license/seat-list/import/`, { method: "POST", body: form });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || err.error || "Failed to import the seat list");
        }
        return res.json();
    },
};
