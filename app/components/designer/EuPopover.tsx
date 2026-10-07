"use client";

// The «ЕС» check of a pack label: which mandatory particulars are on it, which are
// missing (one click adds them) and which are printed too small to be legal.

import React, { useEffect, useRef } from "react";
import type { EuCheck, EuRequirement } from "@/lib/label/eu";
import { cx } from "../stations/shared";
import type { T } from "./model";
import { DIcon } from "./ui";

export default function EuPopover({ t, check, busy, onAdd, onShow, onClose }: {
    t: T;
    check: EuCheck;
    busy: boolean;
    onAdd: (requirement: EuRequirement) => void;
    onShow: (elementId: string) => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        const onDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (ref.current && !ref.current.contains(target) && !target.closest("[data-eu-toggle]")) onClose();
        };
        window.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onDown);
        return () => {
            window.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onDown);
        };
    }, [onClose]);

    return (
        <div ref={ref} role="dialog" aria-label={t("ed.euTitle")} className="lp-card absolute right-3 top-[64px] z-40 flex w-[370px] max-w-[calc(100vw-32px)] flex-col gap-1.5 p-3.5">
            <div className="flex items-center gap-2 pb-1">
                <b className="flex-1 text-[15px] font-extrabold text-lp-ink">{t("ed.euTitle")}</b>
                <span className="text-[12px] font-bold text-lp-ink-3">{t("ed.euLaw")}</span>
            </div>
            {check.items.map((item) => {
                const missing = !item.element;
                const tooSmall = item.size === "tooSmall";
                const smallPack = item.size === "smallPack";
                return (
                    <div key={item.requirement} className="flex min-h-[34px] items-center gap-2.5 text-[13px] font-bold text-lp-ink">
                        <span className={cx("flex w-5 justify-center", missing || tooSmall ? "text-lp-warn" : "text-lp-ok")} aria-hidden="true">
                            <DIcon name={missing || tooSmall ? "warn" : "check"} className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            {t(`ed.req.${item.requirement}`)}
                            {tooSmall && <span className="block text-[12px] font-bold text-lp-warn">{t("ed.euTooSmall")}</span>}
                            {smallPack && <span className="block text-[12px] font-semibold text-lp-ink-3">{t("ed.euSmallPack")}</span>}
                        </span>
                        {missing ? (
                            <button type="button" disabled={busy} onClick={() => onAdd(item.requirement)} className="text-[12px] font-extrabold text-lp-accent-ink hover:underline disabled:opacity-50">
                                {t("ed.euAdd")}
                            </button>
                        ) : (
                            <button type="button" onClick={() => onShow(item.element!.id)} className="text-[12px] font-extrabold text-lp-accent-ink hover:underline">
                                {t("ed.euShow")}
                            </button>
                        )}
                    </div>
                );
            })}
            <p className="m-0 pt-1.5 text-[12px] leading-snug text-lp-ink-3">{t("ed.euRule")}</p>
        </div>
    );
}
