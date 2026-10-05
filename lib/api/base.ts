// Runtime-resolved API base, shared by every lib/api module: the static export is
// served from any LAN host, so in the browser the API lives on the same host. The
// port is 8000 in production; NEXT_PUBLIC_API_PORT lets a dev frontend talk to a
// dev backend while a real server occupies 8000. During build/SSR → env or localhost.

export const API_PORT: string =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_PORT) || "8000";

/** host:port the stations use to reach this server, as seen from the browser. */
export function apiHost(hostname?: string): string {
    const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "localhost");
    return `${host}:${API_PORT}`;
}

export function resolveApiBase(): string {
    if (typeof window !== "undefined") {
        return `${window.location.protocol}//${apiHost()}/api/v1`;
    }
    return (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || `http://localhost:${API_PORT}/api/v1`;
}
