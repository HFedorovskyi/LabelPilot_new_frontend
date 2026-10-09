"use client";

// Small building blocks of the label template editor: icons, segmented choices, number
// fields that take "12,5" and fields with a caption.

import React, { useEffect, useRef, useState } from "react";
import { cx } from "../stations/shared";
import { fmt, parseNum } from "./model";

const ICONS = {
    back: <path d="M15 6l-6 6 6 6" />,
    text: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
    field: <path d="M8 4H6a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-2" />,
    barcode: <path d="M4 5v14M7.5 5v14M10 5v14M14 5v14M17 5v14M20 5v14" />,
    frame: <rect x="4" y="5" width="16" height="14" rx="2" />,
    line: <path d="M4 20L20 4" />,
    table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M10 4v16" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 17l-5-5-9 8" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" /><path d="M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
    undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-2" /></>,
    more: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
    grid: <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />,
    magnet: <path d="M6 3v8a6 6 0 0 0 12 0V3M6 7h4M14 7h4" />,
    fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
    up: <path d="M12 19V5M5 12l7-7 7 7" />,
    down: <path d="M12 5v14M5 12l7 7 7-7" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    tag: <><path d="M3 11.5V4a1 1 0 0 1 1-1h7.5l9.2 9.2a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
    scale: <><path d="M12 3v18M7 21h10M5 7h14" /><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" /></>,
    hash: <path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16" />,
    check: <path d="M5 12.5l4.5 4.5L19 7" />,
    warn: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.5" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
    duplicate: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    trash: <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />,
    upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
} as const;

export type DIconName = keyof typeof ICONS;

export function DIcon({ name, className = "h-[18px] w-[18px]" }: { name: DIconName; className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cx("flex-none", className)} aria-hidden="true">
            {ICONS[name]}
        </svg>
    );
}

/** A row of mutually exclusive choices on a soft track. */
export function Seg<V extends string | number>({ value, options, onChange, label, size = "md" }: {
    value: V | null;
    options: { value: V; label: React.ReactNode; title?: string }[];
    onChange: (value: V) => void;
    label: string;
    size?: "sm" | "md";
}) {
    return (
        <div role="group" aria-label={label} className="flex gap-0.5 rounded-[10px] bg-lp-ink/[0.05] p-[3px]">
            {options.map((option) => (
                <button
                    key={String(option.value)}
                    type="button"
                    aria-pressed={option.value === value}
                    title={option.title}
                    onClick={() => onChange(option.value)}
                    className={cx(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2 font-extrabold transition",
                        size === "sm" ? "min-h-[30px] text-[12px]" : "min-h-[34px] text-[13px]",
                        option.value === value ? "bg-lp-surface text-lp-ink shadow-[0_1px_3px_rgba(16,24,40,.12)]" : "text-lp-ink-3 hover:text-lp-ink",
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

export const inputClass =
    "min-h-[36px] w-full rounded-[9px] border border-lp-line-2 bg-lp-surface px-2.5 text-[13px] font-bold text-lp-ink outline-none transition focus:border-lp-accent disabled:opacity-50";

/** A number a person types ("12,5"); applied while typing, shown formatted otherwise. */
export function NumField({ id, value, onCommit, lang, digits = 1, min, max, step = 1, disabled, className }: {
    id?: string;
    value: number;
    onCommit: (value: number) => void;
    lang: string;
    digits?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    className?: string;
}) {
    const [text, setText] = useState(() => fmt(value, lang, digits));
    const focused = useRef(false);
    useEffect(() => {
        if (!focused.current) setText(fmt(value, lang, digits));
    }, [value, lang, digits]);
    const bound = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
    return (
        <input
            id={id}
            inputMode="decimal"
            disabled={disabled}
            value={text}
            onFocus={(e) => {
                focused.current = true;
                e.currentTarget.select();
            }}
            onBlur={() => {
                focused.current = false;
                setText(fmt(value, lang, digits));
            }}
            onChange={(e) => {
                setText(e.target.value);
                const parsed = parseNum(e.target.value);
                if (parsed !== null) onCommit(bound(parsed));
            }}
            onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const next = bound(Math.round((value + (e.key === "ArrowUp" ? step : -step) * (e.shiftKey ? 10 : 1)) * 1000) / 1000);
                    onCommit(next);
                    setText(fmt(next, lang, digits));
                }
                if (e.key === "Enter") e.currentTarget.blur();
            }}
            className={cx(inputClass, "font-mono", className)}
        />
    );
}

/** A caption over a control. */
export function Labeled({ id, label, children, className }: { id?: string; label: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <div className={cx("flex min-w-0 flex-col gap-1", className)}>
            <label htmlFor={id} className="text-[11px] font-extrabold text-lp-ink-3">{label}</label>
            {children}
        </div>
    );
}

/** A tinted hint in the inspector. */
export function Note({ tone, children }: { tone: "ok" | "warn" | "info"; children: React.ReactNode }) {
    const style = tone === "ok" ? "bg-lp-ok-bg text-lp-ok" : tone === "warn" ? "bg-lp-warn-bg text-lp-warn" : "bg-lp-accent-bg text-lp-accent-ink";
    return (
        <div className={cx("flex items-start gap-2 rounded-[11px] px-2.5 py-2 text-[12px] font-bold leading-snug", style)}>
            <DIcon name={tone === "ok" ? "check" : tone === "warn" ? "warn" : "info"} className="mt-px h-4 w-4" />
            <span className="min-w-0">{children}</span>
        </div>
    );
}

/** Colored chip of a label type (pack blue, box amber, pallet violet). */
export const TYPE_CHIP: Record<"pack" | "box" | "pallet", string> = {
    pack: "bg-lp-t-pack/[0.13] text-lp-t-pack",
    box: "bg-lp-t-box/[0.15] text-lp-t-box",
    pallet: "bg-lp-t-pallet/[0.14] text-lp-t-pallet",
};
export const TYPE_DOT: Record<"pack" | "box" | "pallet", string> = {
    pack: "bg-lp-t-pack",
    box: "bg-lp-t-box",
    pallet: "bg-lp-t-pallet",
};

export function TypeChip({ type, children, className }: { type: "pack" | "box" | "pallet"; children: React.ReactNode; className?: string }) {
    return (
        <span className={cx("inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-extrabold", TYPE_CHIP[type], className)}>
            <span className={cx("h-1.5 w-1.5 rounded-full", TYPE_DOT[type])} aria-hidden="true" />
            {children}
        </span>
    );
}

/** Soft colored backdrop behind a label preview, by type. */
export function previewBackdrop(type: "pack" | "box" | "pallet" | "blank"): React.CSSProperties {
    if (type === "blank") return { background: "repeating-linear-gradient(45deg, rgb(var(--lp-raised)) 0 8px, rgb(var(--lp-bg)) 8px 16px)" };
    const color = type === "pack" ? "--lp-t-pack" : type === "box" ? "--lp-t-box" : "--lp-t-pallet";
    return { background: `radial-gradient(circle at 50% 40%, rgb(var(${color}) / 0.16), transparent 70%), rgb(var(--lp-raised))` };
}
