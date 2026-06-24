declare const process: any;

// Runtime-resolved API base: works for a static export served from any LAN host.
// In the browser → derive from the current host (so other machines on the LAN hit
// the right server); during build/SSR → fall back to env or localhost.
function resolveApiBase(): string {
    if (typeof window !== "undefined") {
        return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
    }
    return (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "http://localhost:8000/api/v1";
}
const API_BASE = resolveApiBase();

// ─── Auth plumbing (session-cookie + CSRF) ──────────────────────────────────
//
// The whole API is CLOSED BY DEFAULT (IsAuthenticated). Every call must send the
// session cookie (`credentials: 'include'`) and — on unsafe methods — the CSRF
// token Django set in the `csrftoken` cookie, echoed back as `X-CSRFToken`.
//
// On a 401 ONLY (genuine session expiry) we invoke a global handler (registered by the
// AuthProvider) so the SPA can drop back to the login screen, then STILL return the
// response so callers' own error-handling keeps working unchanged. A 403 is NOT a
// logout: it means "logged in but forbidden" — a license/demo gate, a permission denial,
// or a CSRF mismatch — and must surface as an in-app error, not bounce the user to login.
// (The backend uses SessionAuthentication401 so a real "not authenticated" is a true 401.)

/** Read a cookie value by name (browser only). */
export function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Register a callback fired only when the API responds 401 (session expired → drop to login). */
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
    unauthorizedHandler = fn;
}

/**
 * Single fetch wrapper used by every data call. Adds `credentials: 'include'`,
 * injects `X-CSRFToken` on unsafe methods, and triggers the global unauthorized
 * handler ONLY on 401 (after which the original Response is still returned so the
 * existing per-call `if (!res.ok)` logic continues to work). A 403 (license/demo gate,
 * permission, or CSRF) is deliberately NOT treated as a logout.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    if (UNSAFE_METHODS.has(method)) {
        const token = getCookie("csrftoken");
        if (token && !headers.has("X-CSRFToken")) headers.set("X-CSRFToken", token);
    }
    const res = await fetch(input, { ...init, method: init.method, credentials: "include", headers });
    if (res.status === 401) {
        unauthorizedHandler?.();
    }
    return res;
}

export const api = {
    nomenclature: {
        list: async () => {
            const res = await apiFetch(`${API_BASE}/nomenclature/`);
            if (!res.ok) throw new Error('Failed to fetch nomenclature');
            return res.json();
        },
        create: async (data: any) => {
            const res = await apiFetch(`${API_BASE}/nomenclature/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create nomenclature');
            return res.json();
        },
        update: async (id: number | string, data: any) => {
            const res = await apiFetch(`${API_BASE}/nomenclature/${id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update nomenclature');
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await apiFetch(`${API_BASE}/nomenclature/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete nomenclature');
        },
        // Add update if needed
        sendToStations: async (stationIds: string[]) => {
            const res = await apiFetch(`${API_BASE}/nomenclature/send_to_stations/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stations: stationIds }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.error || 'Failed to send to stations');
            }
            return res.json();
        },
        previewImport: async (file: File, separator: string) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('separator', separator);
            const res = await apiFetch(`${API_BASE}/nomenclature/preview_import/`, {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to preview import');
            }
            return res.json();
        },
        executeImport: async (file: File, separator: string, mapping: any) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('separator', separator);
            formData.append('mapping', JSON.stringify(mapping));
            const res = await apiFetch(`${API_BASE}/nomenclature/execute_import/`, {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to execute import');
            }
            return res.json();
        },
    },
    packs: {
        list: async () => {
            const res = await apiFetch(`${API_BASE}/packs/`);
            if (!res.ok) throw new Error('Failed to fetch packs');
            return res.json();
        },
        create: async (data: any) => {
            const res = await apiFetch(`${API_BASE}/packs/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create pack');
            return res.json();
        },
        update: async (id: number | string, data: any) => {
            const res = await apiFetch(`${API_BASE}/packs/${id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update pack');
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await apiFetch(`${API_BASE}/packs/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete pack');
        },
    },
    links: {
        list: async () => {
            const res = await apiFetch(`${API_BASE}/links/`);
            if (!res.ok) throw new Error('Failed to fetch links');
            return res.json();
        },
        create: async (data: any) => {
            const res = await apiFetch(`${API_BASE}/links/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create link');
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await apiFetch(`${API_BASE}/links/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete link');
        },
    },

    labels: {
        list: async () => {
            const res = await apiFetch(`${API_BASE}/labels/`);
            if (!res.ok) throw new Error('Failed to fetch labels');
            return res.json();
        },
        create: async (data: any) => {
            const res = await apiFetch(`${API_BASE}/labels/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create label');
            return res.json();
        },
        update: async (id: number | string, data: any) => {
            const res = await apiFetch(`${API_BASE}/labels/${id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update label');
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await apiFetch(`${API_BASE}/labels/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete label');
        },
    },
    stations: {
        list: async () => {
            const res = await apiFetch(`${API_BASE}/stations/`);
            if (!res.ok) throw new Error('Failed to fetch stations');
            return res.json();
        },
        create: async (data: any) => {
            const res = await apiFetch(`${API_BASE}/stations/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create station');
            return res.json();
        },
        update: async (uuid: string, data: any) => {
            const res = await apiFetch(`${API_BASE}/stations/${uuid}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update station');
            return res.json();
        },
        delete: async (uuid: string) => {
            const res = await apiFetch(`${API_BASE}/stations/${uuid}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete station');
        },
        sync: async (uuid: string) => {
            const res = await apiFetch(`${API_BASE}/stations/${uuid}/sync_data/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const message = errorData.error || errorData.detail || 'Failed to sync data';
                throw new Error(message);
            }
            return res.json();
        },
        getFullDump: async (uuid?: string) => {
            const url = uuid ? `${API_BASE}/stations/full_dump/?station_uuid=${uuid}` : `${API_BASE}/stations/full_dump/`;
            const res = await apiFetch(url);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.error || 'Failed to fetch full dump');
            }
            return res.json();
        },
        getServerIp: async () => {
            const res = await apiFetch(`${API_BASE}/stations/server_ip/`);
            if (!res.ok) throw new Error('Failed to fetch server IP');
            return res.json();
        },
        downloadUpdate: async (uuid: string) => {
            const res = await apiFetch(`${API_BASE}/stations/${uuid}/download_update/`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.error || 'Failed to download update');
            }
            return res.blob();
        },
        downloadIdentity: async (uuid: string) => {
            const res = await apiFetch(`${API_BASE}/stations/${uuid}/download_identity/`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.error || 'Failed to download identity');
            }
            return res.blob();
        },
        uploadReport: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiFetch(`${API_BASE}/stations/upload_report/`, {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to upload report');
            }
            return res.json();
        }
    },
    attributes: {
        list: async () => {
            const res = await apiFetch(`${API_BASE}/attributes/`);
            if (!res.ok) throw new Error('Failed to fetch attributes');
            return res.json();
        },
        create: async (data: any) => {
            const res = await apiFetch(`${API_BASE}/attributes/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create attribute');
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await apiFetch(`${API_BASE}/attributes/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete attribute');
        },
    },
    barcodes: {
        list: async () => {
            const res = await apiFetch(`${API_BASE}/barcodes/`);
            if (!res.ok) throw new Error('Failed to fetch barcodes');
            return res.json();
        },
        create: async (data: any) => {
            const res = await apiFetch(`${API_BASE}/barcodes/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.name?.[0] || errorData.detail || errorData.error || 'Failed to create barcode template');
            }
            return res.json();
        },
        update: async (id: number | string, data: any) => {
            const res = await apiFetch(`${API_BASE}/barcodes/${id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.name?.[0] || errorData.detail || errorData.error || 'Failed to update barcode template');
            }
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await apiFetch(`${API_BASE}/barcodes/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete barcode template');
        },
        generate: async (payload: { barcode_structure: any, product_id?: string }) => {
            const res = await apiFetch(`${API_BASE}/barcodes/generate/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                // 400 validation failure returns { errors: [...] }; pass it through
                // so the caller can render the list instead of throwing.
                if (Array.isArray(errorData.errors)) {
                    return errorData;
                }
                throw new Error(errorData.error || 'Failed to generate barcode preview');
            }
            return res.json();
        },
    },
    statistics: {
        get: async () => {
            const res = await apiFetch(`${API_BASE}/statistics/`);
            if (!res.ok) throw new Error('Failed to fetch statistics');
            return res.json();
        }
    },
    printJobs: {
        list: async () => {
            const res = await apiFetch(`${API_BASE}/print_jobs/`);
            if (!res.ok) throw new Error('Failed to fetch print jobs');
            return res.json();
        },
        create: async (data: any) => {
            const res = await apiFetch(`${API_BASE}/print_jobs/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.error || 'Failed to create print job');
            }
            return res.json();
        },
        update: async (id: number | string, data: any) => {
            const res = await apiFetch(`${API_BASE}/print_jobs/${id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update print job');
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await apiFetch(`${API_BASE}/print_jobs/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete print job');
        },
        sendToStation: async (id: number | string) => {
            const res = await apiFetch(`${API_BASE}/print_jobs/${id}/send_to_station/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.error || 'Failed to send to station');
            }
            return res.json();
        },
        downloadForUsb: async (id: number | string) => {
            const res = await apiFetch(`${API_BASE}/print_jobs/${id}/download_for_usb/`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.error || 'Failed to download job');
            }
            return res.blob();
        },
        downloadUsbBundle: async (stationId?: number | string) => {
            const url = stationId
                ? `${API_BASE}/print_jobs/download_usb_bundle/?station_id=${stationId}`
                : `${API_BASE}/print_jobs/download_usb_bundle/`;
            const res = await apiFetch(url);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.error || 'Failed to download bundle');
            }
            return res.blob();
        },
    },
};
