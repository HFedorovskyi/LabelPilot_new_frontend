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
    expired: boolean;
    max_stations: number;
    demo_max_stations: number;
    license_id: string | null;
    features: string[];
    machine_id: string;
    strict: boolean;
    signature_valid: boolean;
    machine_ok: boolean;
    stations_used: number;
}

// Runtime-resolved API base — same mechanism as lib/api/client.ts so the static
// export works from any LAN host (browser → derive from current host; build/SSR
// → env or localhost). Do NOT hardcode a host here.
function resolveApiBase(): string {
    if (typeof window !== "undefined") {
        return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
    }
    return (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "http://localhost:8000/api/v1";
}
const API_BASE = resolveApiBase();

export const licenseApi = {
    get: async (): Promise<LicenseInfo> => {
        const res = await fetch(`${API_BASE}/license/`);
        if (!res.ok) throw new Error("Failed to fetch license status");
        return res.json();
    },
};
