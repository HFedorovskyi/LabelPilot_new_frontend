// Print jobs: the stage a job is in — one rule for the Print page, its side panel and the
// menu counter. The server keeps the status; the station reports printed_qty and completion.

export type PrintJob = {
    id: number;
    station: number;
    station_name: string;
    nomenclature: number;
    nomenclature_name: string;
    nomenclature_article: string;
    quantity: number;
    quantity_unit: "kg" | "pcs";
    batch_number: string;
    marking_date: string;
    status: "pending" | "sent" | "completed" | "error";
    created_at: string;
    updated_at: string;
    printed_qty: number;
    progress_at: string | null;
    sent_at: string | null;
    completed_at: string | null;
    last_error: string;
};

/** Ordered as the list shows them: what needs a hand first, finished last. */
export const STAGES = ["error", "unsent", "printing", "queued", "done"] as const;
export type JobStage = (typeof STAGES)[number];

export function jobStage(job: PrintJob): JobStage {
    if (job.status === "completed") return "done";
    if (job.status === "error") return "error";
    if (job.status === "pending") return "unsent";
    return job.printed_qty > 0 ? "printing" : "queued";
}

/** Jobs still in work (the page polls these often); finished ones are loaded separately. */
export const ACTIVE_STATUSES = "pending,sent,error";
/** How far back the Print page lists finished jobs. */
export const DONE_DAYS = 30;

/** The send failed because the station did not answer (not a refusal by the server). */
export function isNetworkError(message: string): boolean {
    return /timed? ?out|refused|max retries|connection|unreachable|no route/i.test(message);
}

export function jobMatches(job: PrintJob, query: string): boolean {
    if (!query) return true;
    const text = `${job.nomenclature_name} ${job.nomenclature_article} ${job.batch_number} #${job.id} ${job.station_name}`;
    return text.toLowerCase().includes(query);
}
