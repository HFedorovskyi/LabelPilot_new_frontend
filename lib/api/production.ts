import { apiFetch } from "./client";
import { resolveApiBase } from "./base";

// Production data of the «Сегодня» page and a station's own page (backend api/production.py).
// Days are the server's local calendar days.

export interface LineJob {
    id: number;
    product: string;
    quantity: number;
    unit: "pcs" | "kg" | string;
    printed: number;
    status: "pending" | "sent" | "completed" | "error" | string;
    eta_minutes: number | null;
    completed_at: string | null;
    created_at: string | null;
    error: string;
}

export interface LineFault {
    component: "printer" | "scale" | string;
    message: string;
    since: string;
}

export interface TodayLine {
    id: number;
    uuid: string;
    name: string;
    number: string | null;
    online: boolean;
    seen_at: string | null;
    labels: number;
    kg: number;
    hourly: number[];
    /** Labels in the last hour. */
    rate: number;
    last_at: string | null;
    last_product: string;
    operator: string;
    job: LineJob | null;
    fault: LineFault | null;
}

export interface TodayData {
    date: string;
    now: string;
    week: { date: string; count: number; previous: number }[];
    totals: { labels: number; kg: number; deleted: number; deleted_kg: number; yesterday_same_time: number };
    hourly: number[];
    hourly_yesterday: number[];
    stations: TodayLine[];
    jobs: { in_progress: number; waiting: number; done: number; failed: LineJob[]; percent: number | null };
    products: { name: string; pcs: number; kg: number }[];
    setup: { products: number; products_without_template: number; stations: number };
}

export interface StationStats {
    from: string;
    to: string;
    single_day: boolean;
    totals: {
        labels: number; kg: number; avg_kg: number | null; deleted: number; deleted_kg: number;
        previous_labels: number; boxes: number; pallets: number;
    };
    series: { label: string; count: number }[];
    work: {
        first: string | null; last: string | null; minutes: number; stopped_minutes?: number; days_worked: number;
        /** Today while the line stands: now (the timeline runs to it); else null. */
        until?: string | null;
        stops: { from: string; to: string; minutes: number; kind: "fault" | "idle"; reason: string; ongoing?: boolean }[];
    };
    products: { name: string; pcs: number; kg: number; avg_kg: number }[];
    /** Empty unless an admin enabled output per operator (Settings). */
    operators: { name: string; pcs: number; kg: number; first: string; last: string; days: number }[];
    operator_output: boolean;
    jobs: LineJob[];
    /** The printer or scale error the line is standing on right now, whatever the period. */
    fault: LineFault | null;
}

export type LabelLevel = "pack" | "box" | "pallet";

export interface PackRow {
    id: number; at: string; product: string; kg: number; gross_kg: number | null; batch: string; operator: string;
    barcode: string; box: string; deleted: boolean; deleted_at: string | null;
}

export interface ContainerRow {
    id: number; opened_at: string; closed_at: string | null; closed: boolean; number: string; product: string;
    packs: number; boxes: number; capacity: number | null; kg: number; gross_kg: number; pallet: string;
    deleted: boolean; deleted_at: string | null;
}

export interface LabelPage {
    level: LabelLevel;
    counts: Record<LabelLevel, number>;
    total: number;
    deleted: number;
    offset: number;
    rows: (PackRow | ContainerRow)[];
}

export interface JournalEvent {
    at: string; level: string; component: string; message: string; detail?: string; actor?: string;
}

export type Period = { from: string; to: string };

const base = () => resolveApiBase();

async function json<T>(url: string): Promise<T> {
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

const periodQuery = (period: Period) => new URLSearchParams({ from: period.from, to: period.to });

export const productionApi = {
    today: () => json<TodayData>(`${base()}/production/today/`),
    stats: (uuid: string, period: Period) => json<StationStats>(`${base()}/stations/${uuid}/stats/?${periodQuery(period)}`),
    days: (uuid: string, month: string) => json<{ month: string; days: string[] }>(`${base()}/stations/${uuid}/days/?month=${month}`),
    labels: (uuid: string, period: Period, opts: { level: LabelLevel; q?: string; deleted?: boolean; offset?: number; limit?: number }) => {
        const p = periodQuery(period);
        p.set("level", opts.level);
        if (opts.q) p.set("q", opts.q);
        if (opts.deleted) p.set("deleted", "1");
        p.set("offset", String(opts.offset ?? 0));
        p.set("limit", String(opts.limit ?? 50));
        return json<LabelPage>(`${base()}/stations/${uuid}/labels/?${p}`);
    },
    /** The same list as a CSV file (Excel opens it). */
    labelsCsvUrl: (uuid: string, period: Period, opts: { level: LabelLevel; q?: string; deleted?: boolean }) => {
        const p = periodQuery(period);
        p.set("level", opts.level);
        p.set("export", "csv");
        if (opts.q) p.set("q", opts.q);
        if (opts.deleted) p.set("deleted", "1");
        return `${base()}/stations/${uuid}/labels/?${p}`;
    },
    /** Output per operator is employee data (GDPR, BetrVG): off until an admin enables it. */
    settings: () => json<{ operator_output: boolean }>(`${base()}/production/settings/`),
    saveSettings: async (value: { operator_output: boolean }) => {
        const res = await apiFetch(`${base()}/production/settings/`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ operator_output: boolean }>;
    },
    journal: (uuid: string, period: Period, kind: string) =>
        json<{ counts: { errors: number; printer: number; scale: number; seat: number }; events: JournalEvent[] }>(
            `${base()}/stations/${uuid}/journal/?${periodQuery(period)}&kind=${kind}`),
};
