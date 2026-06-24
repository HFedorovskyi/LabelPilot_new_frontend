"use client";

import React, { useEffect, useState } from "react";
import { licenseApi, type LicenseInfo } from "@/lib/api/license";

/**
 * App-wide, non-blocking banner shown only when the server reports mode === "demo"
 * (i.e. the product is UNLICENSED). Nudges the operator to activate a license.
 *
 * Optionally accepts an `onActivate` callback so the host can jump the user to the
 * Settings → Лицензия surface. Dismissible for the current session only.
 */
export default function DemoBanner({ onActivate }: { onActivate?: () => void }) {
    const [info, setInfo] = useState<LicenseInfo | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        let alive = true;
        licenseApi
            .get()
            .then((data) => {
                if (alive) setInfo(data);
            })
            .catch(() => {
                // License endpoint unreachable — stay silent rather than show a broken banner.
            });
        return () => {
            alive = false;
        };
    }, []);

    if (!info || info.mode !== "demo" || dismissed) return null;

    return (
        <div className="flex items-center gap-3 border-b border-amber-400/20 bg-amber-400/[0.08] px-[18px] py-2 text-[12.5px] text-amber-200 backdrop-blur-xl">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true">
                <path
                    d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    className="stroke-current"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                />
                <path d="M12 9v4M12 17h.01" className="stroke-current" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <span className="min-w-0 flex-1">
                <strong className="font-semibold">Демо-режим</strong> — нет лицензии. Активируйте лицензию для полного доступа.
            </span>
            {onActivate && (
                <button
                    onClick={onActivate}
                    className="shrink-0 rounded-lg border border-amber-400/30 bg-amber-400/[0.12] px-[10px] py-[4px] text-[11.5px] font-medium text-amber-100 transition hover:bg-amber-400/20"
                >
                    Активировать
                </button>
            )}
            <button
                onClick={() => setDismissed(true)}
                aria-label="Скрыть уведомление"
                title="Скрыть"
                className="shrink-0 text-amber-300/70 transition hover:text-amber-100"
            >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            </button>
        </div>
    );
}
