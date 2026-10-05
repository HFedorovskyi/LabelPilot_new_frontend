"use client";

// Small pieces shared by the Stations page and its side panel.

import React from "react";
import type { Lang } from "@/lib/i18n";
import type { StationProblem } from "@/lib/stations";

export type Tone = "ok" | "warn" | "bad" | "off";

export const TONE_BG: Record<Tone, string> = {
    ok: "bg-lp-ok-bg text-lp-ok",
    warn: "bg-lp-warn-bg text-lp-warn",
    bad: "bg-lp-bad-bg text-lp-bad",
    off: "bg-lp-off-bg text-lp-off",
};
export const TONE_INK: Record<Tone, string> = {
    ok: "text-lp-ok",
    warn: "text-lp-warn",
    bad: "text-lp-bad",
    off: "text-lp-off",
};
export const TONE_SOFT: Record<Tone, string> = { ok: "bg-lp-ok-bg", warn: "bg-lp-warn-bg", bad: "bg-lp-bad-bg", off: "bg-lp-off-bg" };
export const TONE_DOT: Record<Tone, string> = { ok: "bg-lp-ok", warn: "bg-lp-warn", bad: "bg-lp-bad", off: "bg-lp-off" };
export const TONE_SYMBOL: Record<Tone, string> = { ok: "●", warn: "▲", bad: "■", off: "○" };

export const PROBLEM_TONE: Record<StationProblem, Tone> = {
    conflict: "bad",
    outside_cap: "bad",
    unlisted: "warn",
    pending: "warn",
    offline: "warn",
};

export function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

const ICONS: Record<StationProblem | "station" | "close" | "plus", React.ReactNode> = {
    conflict: <><rect x="2" y="3" width="9" height="7" rx="1.5" /><rect x="13" y="14" width="9" height="7" rx="1.5" /><path d="M15 4h4v4M19 4l-4.5 4.5M9 20H5v-4M5 20l4.5-4.5" /></>,
    outside_cap: <><circle cx="12" cy="12" r="9" /><path d="M5.5 5.5l13 13" /></>,
    unlisted: <><path d="M14 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8" /><path d="M9 8h6M9 12h4M16 17l4 4M20 17l-4 4" /></>,
    pending: <path d="M6 3h12M6 21h12M7 3c0 4.5 10 4.5 10 9s-10 4.5-10 9M17 3c0 4.5-10 4.5-10 9s10 4.5 10 9" />,
    offline: <><path d="M5 12.5a10 10 0 0 1 4-2.3M19 12.5a10 10 0 0 0-3.3-2M2 8.8a15 15 0 0 1 5-2.9M22 8.8A15 15 0 0 0 11.5 5M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19.5" r="1" /><path d="M3 3l18 18" /></>,
    station: <><rect x="3" y="3" width="12" height="9" rx="1.5" /><path d="M9 12v3M6 15h6M14 18h7M15 18v-2h5v2M2 21h20" /></>,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    plus: <path d="M12 5v14M5 12h14" />,
};

export function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof ICONS; className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cx("flex-none", className)} aria-hidden="true">
            {ICONS[name]}
        </svg>
    );
}

/** "12 мин", "3 ч", "17 дн." since an ISO time. */
export function sinceText(iso: string | null | undefined, t: (k: string, p?: Record<string, string | number>) => string): string {
    if (!iso) return "";
    const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (minutes < 60) return t("stp.minutes", { n: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 48) return t("stp.hours", { n: hours });
    return t("stp.days", { n: Math.round(hours / 24) });
}

/** "сегодня в 10:42" / "3 октября в 18:40". */
export function whenText(iso: string | null | undefined, lang: Lang, t: (k: string, p?: Record<string, string | number>) => string): string {
    if (!iso) return "";
    const date = new Date(iso);
    const time = date.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return t("stp.todayAt", { time });
    return t("stp.dayAt", { day: date.toLocaleDateString(lang, { day: "numeric", month: "long" }), time });
}

export function formatNumber(value: number, lang: Lang, digits = 0): string {
    return new Intl.NumberFormat(lang, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}

export function Bars({ values, height, now, width = 6 }: { values: number[]; height: number; now: number; width?: number }) {
    const max = Math.max(1, ...values);
    return (
        <span className="flex items-end gap-[3px]" style={{ height }} aria-hidden="true">
            {values.map((value, i) => (
                <span
                    key={i}
                    className={cx("rounded-[2px]", i > now ? "bg-lp-off-bg" : i === now ? "bg-lp-bar" : "bg-lp-accent")}
                    style={{ width, height: i > now ? 3 : Math.max(3, Math.round((value / max) * height)) }}
                />
            ))}
        </span>
    );
}

export function download(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}
