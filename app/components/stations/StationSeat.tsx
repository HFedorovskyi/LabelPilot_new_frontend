"use client";

// Named-seat licensing UI: the seat summary above the station list and the seat
// state + admin actions on each station card. The server enforces every rule
// (seat cap, 30-day release allowance, admin role); this view only explains them.

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { licenseApi, type SeatSummary } from "@/lib/api/license";
import { useTranslation } from "@/lib/i18n";

export type SeatStation = {
    station_uuid: string;
    station_name: string;
    seat_state?: "active" | "pending" | "released";
    seat_within_cap?: boolean;
    // Licences with a vendor seat list: whether the station is in it (else it gets no data).
    seat_list?: "listed" | "unlisted" | "no_list" | null;
    station_fingerprint?: string;
    conflict_fingerprint?: string;
};

function cx(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}

export function SeatSummaryBar({ refreshKey }: { refreshKey: number }) {
    const { t } = useTranslation();
    const [seats, setSeats] = useState<SeatSummary | null>(null);

    useEffect(() => {
        let alive = true;
        licenseApi
            .get()
            .then((info) => alive && setSeats(info.seats ?? null))
            .catch(() => alive && setSeats(null));
        return () => {
            alive = false;
        };
    }, [refreshKey]);

    if (!seats) return null;
    const total = seats.limit == null
        ? t("seats.summaryUnlimited", { active: seats.active })
        : t("seats.summary", { active: seats.active, limit: seats.limit });

    return (
        <div className="mb-6 space-y-2">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/70">
                <span className="font-semibold text-white">{total}</span>
                {seats.pending > 0 && <span className="text-amber-300">{t("seats.pending", { count: seats.pending })}</span>}
                {seats.conflicts > 0 && <span className="text-rose-300">{t("seats.conflicts", { count: seats.conflicts })}</span>}
                {seats.release_allowance != null && (
                    <span>{t("seats.releases", { count: seats.releases_30d, allowance: seats.release_allowance })}</span>
                )}
            </div>
            {seats.over_limit && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm text-amber-200">
                    {t("seats.overLimit")}
                </div>
            )}
        </div>
    );
}

export function StationSeatControls({ station, onChanged }: { station: SeatStation; onChanged: () => void }) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const state = station.seat_state ?? "active";
    const conflict = Boolean(station.conflict_fingerprint);
    // An active station beyond the licence's seat count gets no data (server-side cap).
    const outsideCap = state === "active" && station.seat_within_cap === false;
    const unlisted = state === "active" && !outsideCap
        && (station.seat_list === "unlisted" || station.seat_list === "no_list");

    const run = async (operation: () => Promise<unknown>, confirmKey?: string) => {
        if (confirmKey && !window.confirm(t(confirmKey, { name: station.station_name }))) return;
        setBusy(true);
        setError(null);
        try {
            await operation();
            onChanged();
        } catch (e) {
            setError(e instanceof Error ? e.message : t("seats.actionFailed"));
        } finally {
            setBusy(false);
        }
    };

    const badge = conflict
        ? { text: t("seats.stateConflict"), tone: "border-rose-500/30 bg-rose-500/10 text-rose-300" }
        : outsideCap
            ? { text: t("seats.stateOutsideCap"), tone: "border-rose-500/30 bg-rose-500/10 text-rose-300" }
            : unlisted
            ? { text: t("seats.stateUnlisted"), tone: "border-rose-500/30 bg-rose-500/10 text-rose-300" }
            : state === "active"
            ? { text: t("seats.stateActive"), tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" }
            : state === "pending"
                ? { text: t("seats.statePending"), tone: "border-amber-500/30 bg-amber-500/10 text-amber-300" }
                : { text: t("seats.stateReleased"), tone: "border-white/10 bg-white/5 text-white/50" };

    return (
        <div className="mb-4 space-y-2 border-t border-white/5 pt-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className={cx("rounded-lg border px-2 py-0.5 text-xs font-semibold", badge.tone)}>{badge.text}</span>
                {!station.station_fingerprint && (
                    <span className="text-xs text-white/40">{t("seats.unbound")}</span>
                )}
                <div className="ml-auto flex gap-2">
                    {conflict && (
                        <button
                            disabled={busy}
                            onClick={() => run(() => api.stations.replaceHardware(station.station_uuid), "seats.confirmReplace")}
                            className="rounded-lg bg-rose-500/20 px-3 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
                        >
                            {t("seats.replaceHardware")}
                        </button>
                    )}
                    {state === "active" ? (
                        <button
                            disabled={busy}
                            onClick={() => run(() => api.stations.releaseSeat(station.station_uuid), "seats.confirmRelease")}
                            className="rounded-lg bg-white/5 px-3 py-1 text-xs font-medium text-white/70 hover:bg-white/10 disabled:opacity-50"
                        >
                            {t("seats.release")}
                        </button>
                    ) : (
                        <button
                            disabled={busy}
                            onClick={() => run(() => api.stations.activateSeat(station.station_uuid))}
                            className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                        >
                            {t("seats.activate")}
                        </button>
                    )}
                </div>
            </div>
            {conflict && <p className="text-xs text-rose-200/80">{t("seats.conflictHint")}</p>}
            {outsideCap && !conflict && <p className="text-xs text-rose-200/80">{t("seats.outsideCapHint")}</p>}
            {error && <p className="text-xs text-rose-300">{error}</p>}
        </div>
    );
}
