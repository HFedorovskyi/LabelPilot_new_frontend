// Texts and colours of a print job, shared by the Print page and its side panel.

import type { Lang } from "@/lib/i18n";
import { isNetworkError, jobStage, type JobStage, type PrintJob } from "@/lib/printJobs";
import { formatNumber, whenText } from "@/app/components/stations/shared";

type T = (key: string, params?: Record<string, string | number>) => string;

export const STAGE_DOT: Record<JobStage, string> = {
    error: "bg-lp-bad",
    unsent: "bg-lp-line-2",
    printing: "bg-lp-accent",
    queued: "bg-lp-accent",
    done: "bg-lp-ok",
};
export const STAGE_INK: Record<JobStage, string> = {
    error: "text-lp-bad",
    unsent: "text-lp-ink-2",
    printing: "text-lp-accent-ink",
    queued: "text-lp-ink-2",
    done: "text-lp-ok",
};

/** "08:55" today, "3 окт." before. */
export function shortWhen(iso: string | null, lang: Lang): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (date.toDateString() === new Date().toDateString()) return date.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString(lang, { day: "numeric", month: "short" });
}

export function stageText(job: PrintJob, t: T, lang: Lang): string {
    const stage = jobStage(job);
    return stage === "done" ? t("prt.stage.done", { when: shortWhen(job.completed_at ?? job.updated_at, lang) }) : t(`prt.stage.${stage}`);
}

export function qtyText(value: number, unit: PrintJob["quantity_unit"], lang: Lang): string {
    return formatNumber(value, lang, unit === "kg" ? 2 : 0);
}

/** "74 из 120 шт" while the station works on it, otherwise "120 шт". */
export function amountText(job: PrintJob, t: T, lang: Lang): string {
    const stage = jobStage(job);
    const total = qtyText(job.quantity, job.quantity_unit, lang);
    const unit = t(`prt.unit.${job.quantity_unit}`);
    if (stage === "printing" || stage === "queued") return t("prt.of", { done: qtyText(job.printed_qty, job.quantity_unit, lang), total, unit });
    return t("prt.amount", { total, unit });
}

/** Share printed, 0–100, while the station works on the job; null otherwise. */
export function progressPercent(job: PrintJob): number | null {
    const stage = jobStage(job);
    if (stage !== "printing" && stage !== "queued") return null;
    return job.quantity > 0 ? Math.min(100, Math.round((job.printed_qty / job.quantity) * 100)) : 0;
}

/** Why a send failed, in words: a station that did not answer, or the server's own reason. */
export function reasonText(message: string, station: string, t: T): string {
    return isNetworkError(message) ? t("prt.reason.net", { station }) : message;
}

export function failureText(job: PrintJob, t: T, lang: Lang): string {
    return t("prt.failed", { when: whenText(job.updated_at, lang, t), reason: reasonText(job.last_error, job.station_name, t) });
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** Today as YYYY-MM-DD in the local time zone (toISOString would give the UTC day). */
export function localDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const primaryButton = "min-h-[44px] rounded-[11px] bg-lp-accent px-[18px] text-[14px] font-extrabold text-[#fff] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
export const rowButton = "min-h-[34px] rounded-[9px] border border-lp-line-2 bg-lp-surface px-[11px] text-[13px] font-extrabold text-lp-ink transition hover:bg-lp-raised disabled:cursor-not-allowed disabled:opacity-50";
export const linkButton = "border-0 bg-transparent p-0 text-[13px] font-extrabold text-lp-accent-ink hover:underline disabled:cursor-not-allowed disabled:opacity-50";
export const dangerLink = "border-0 bg-transparent p-0 text-[13px] font-extrabold text-lp-bad hover:underline disabled:cursor-not-allowed disabled:opacity-50";
