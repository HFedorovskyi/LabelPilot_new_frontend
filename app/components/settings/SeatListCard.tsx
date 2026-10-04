"use client";

// Vendor-signed seat list (licences with the "seat-list" feature): the stations that
// may receive data, signed by the supplier. The server renews it by itself when online;
// offline sites exchange a request file for a list in the customer cabinet. The server
// and the stations enforce the list; this card only shows its state.

import React, { useState } from "react";
import { licenseApi, type LicenseInfo } from "@/lib/api/license";
import { useTranslation } from "@/lib/i18n";

function cx(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}

const REJECT_CODES = ["too_many_stations", "release_limit", "server_link", "install"];

export function SeatListCard({
    info,
    isAdmin,
    onInfo,
}: {
    info: LicenseInfo;
    isAdmin: boolean;
    onInfo: (info: LicenseInfo) => void;
}) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const list = info.seat_list;
    if (!list?.required) return null;

    const run = async (operation: () => Promise<void>) => {
        setBusy(true);
        setMessage(null);
        try {
            await operation();
        } catch (e) {
            setMessage({ type: "err", text: e instanceof Error ? e.message : t("seatList.sync.unavailable") });
        } finally {
            setBusy(false);
        }
    };

    const sync = () => run(async () => {
        const updated = await licenseApi.syncSeatList();
        onInfo(updated);
        const result = updated.seat_list_sync;
        if (!result) return;
        if (result.status === "updated") {
            setMessage({ type: "ok", text: t("seatList.sync.updated") });
        } else if (result.status === "rejected") {
            const code = REJECT_CODES.includes(result.detail) ? result.detail : "install";
            setMessage({ type: "err", text: t(`seatList.reject.${code}`) });
        } else {
            setMessage({ type: "err", text: t(`seatList.sync.${result.status}`) });
        }
    });

    const download = () => run(async () => {
        await licenseApi.downloadSeatListRequest();
    });

    const importList = (file: File) => run(async () => {
        onInfo(await licenseApi.importSeatList(file));
        setMessage({ type: "ok", text: t("seatList.importOk") });
    });

    const tone = !list.present || list.expired
        ? "border-red-400/20 bg-red-400/10 text-red-200"
        : list.missing > 0 || list.renewal_due
            ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
    const headline = !list.present
        ? t("seatList.none")
        : list.expired
            ? t("seatList.expired", { date: list.expires ?? "" })
            : list.limit == null
                ? t("seatList.summaryUnlimited", { count: list.stations, date: list.expires ?? "" })
                : t("seatList.summary", { count: list.stations, limit: list.limit, date: list.expires ?? "" });

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold text-white">{t("seatList.title")}</div>
            <div className="mt-1 max-w-2xl text-xs text-white/50">{t("seatList.hint")}</div>
            <div className={cx("mt-3 rounded-xl border px-4 py-3 text-sm", tone)}>
                <div className="font-medium">{headline}</div>
                {list.present && !list.expired && list.renewal_due && (
                    <div className="mt-1 text-xs opacity-90">{t("seatList.renewalDue", { days: list.days_left ?? 0 })}</div>
                )}
                {list.missing > 0 && (
                    <div className="mt-1 text-xs opacity-90">{t("seatList.missing", { count: list.missing })}</div>
                )}
                {list.present && !list.expired && list.in_sync && (
                    <div className="mt-1 text-xs opacity-90">{t("seatList.inSync")}</div>
                )}
            </div>
            {isAdmin && (
                <>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        {list.sync_enabled && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={sync}
                                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
                            >
                                {busy ? t("seatList.syncing") : t("seatList.syncButton")}
                            </button>
                        )}
                        <button
                            type="button"
                            disabled={busy}
                            onClick={download}
                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                        >
                            {t("seatList.requestButton")}
                        </button>
                        <label
                            className={cx(
                                "rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10",
                                busy ? "opacity-50" : "cursor-pointer",
                            )}
                        >
                            {t("seatList.importButton")}
                            <input
                                type="file"
                                accept=".lst"
                                className="hidden"
                                disabled={busy}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (file) void importList(file);
                                }}
                            />
                        </label>
                        {message && (
                            <span className={message.type === "ok" ? "text-sm text-emerald-300" : "text-sm text-red-300"}>
                                {message.text}
                            </span>
                        )}
                    </div>
                    <div className="mt-2 max-w-2xl text-xs text-white/40">{t("seatList.offlineHint")}</div>
                </>
            )}
        </div>
    );
}
