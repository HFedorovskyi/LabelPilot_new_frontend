"use client";

// One print job in the side panel of the Print page: its stage, why it did not go out, the
// facts, one main action, and the rarer ones as links.

import React, { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { Delivery } from "@/lib/stations";
import { isNetworkError, jobStage, type PrintJob } from "@/lib/printJobs";
import { cx, Icon, whenText } from "@/app/components/stations/shared";
import { amountText, dangerLink, failureText, linkButton, primaryButton, qtyText, STAGE_DOT, STAGE_INK, stageText } from "./shared";

type Props = {
    job: PrintJob;
    /** null while the stations are loading. */
    delivery: Delivery | null;
    busy: boolean;
    onClose: () => void;
    onSend: () => void;
    onFile: () => void;
    onRepeat: () => void;
    onMarkDone: () => void;
    onDelete: () => void;
    onOpenStations: () => void;
};

export default function JobPanel({ job, delivery, busy, onClose, onSend, onFile, onRepeat, onMarkDone, onDelete, onOpenStations }: Props) {
    const { t, lang } = useTranslation();
    const [confirming, setConfirming] = useState(false);
    const stage = jobStage(job);
    const needsHand = stage === "unsent" || stage === "error";
    const atStation = stage === "queued" || stage === "printing";
    const unit = t(`prt.unit.${job.quantity_unit}`);

    const facts: { key: string; value: string }[] = [
        { key: t("prt.p.article"), value: job.nomenclature_article },
        { key: t("prt.p.station"), value: job.station_name },
        { key: t("prt.p.amount"), value: t("prt.amount", { total: qtyText(job.quantity, job.quantity_unit, lang), unit }) },
    ];
    if (atStation) facts.push({ key: t("prt.p.printed"), value: amountText(job, t, lang) });
    if (stage === "done") {
        facts.push({
            key: t("prt.p.printed"),
            value: job.printed_qty > 0 ? t("prt.of", { done: qtyText(job.printed_qty, job.quantity_unit, lang), total: qtyText(job.quantity, job.quantity_unit, lang), unit }) : "—",
        });
    }
    facts.push(
        { key: t("prt.p.batch"), value: job.batch_number || "—" },
        { key: t("prt.p.date"), value: job.marking_date ? new Date(`${job.marking_date}T00:00:00`).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" }) : "—" },
        { key: t("prt.p.created"), value: whenText(job.created_at, lang, t) },
    );
    if (job.sent_at) facts.push({ key: t("prt.p.sent"), value: whenText(job.sent_at, lang, t) });
    if (atStation && job.progress_at) facts.push({ key: t("prt.p.report"), value: whenText(job.progress_at, lang, t) });
    if (stage === "done") facts.push({ key: t("prt.p.done"), value: whenText(job.completed_at ?? job.updated_at, lang, t) });

    return (
        <aside
            aria-label={t("prt.p.label", { id: job.id })}
            className="flex w-full min-w-0 flex-col overflow-hidden lp-card lg:sticky lg:top-0 lg:max-h-[calc(100vh-60px)] lg:w-[420px] lg:flex-none lg:overflow-y-auto"
        >
            <div className="flex flex-col gap-2 border-b border-lp-line px-[18px] pb-3.5 pt-4">
                <div className="flex items-center gap-2.5">
                    <span className="rounded-[7px] border border-lp-line-2 px-[7px] py-[2px] font-mono text-[13px] font-semibold tabular-nums text-lp-ink-2">#{job.id}</span>
                    <h2 className="m-0 min-w-0 flex-1 text-[18px] font-extrabold text-lp-ink">{job.nomenclature_name}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t("stp.close")}
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border border-lp-line bg-lp-surface text-lp-ink-2 transition hover:border-lp-line-2 hover:bg-lp-raised"
                    >
                        <Icon name="close" className="h-4 w-4" />
                    </button>
                </div>
                <span className={cx("flex items-center gap-2 text-[13px] font-bold", STAGE_INK[stage])}>
                    <span className={cx("h-2 w-2 rounded-full", STAGE_DOT[stage])} />
                    {stageText(job, t, lang)}
                </span>
            </div>

            <div className="flex flex-col gap-3.5 px-[18px] pb-5 pt-4">
                {stage === "error" && (
                    <div className="flex flex-col gap-1.5 rounded-[12px] bg-lp-bad-bg px-3.5 py-3 text-lp-bad">
                        <span className="text-[14px] font-bold">■ {failureText(job, t, lang)}</span>
                        {isNetworkError(job.last_error) && (
                            <details className="text-[12px]">
                                <summary className="cursor-pointer font-bold">{t("prt.p.details")}</summary>
                                <span className="mt-1 block break-words font-mono">{job.last_error}</span>
                            </details>
                        )}
                    </div>
                )}
                {needsHand && delivery === "blocked" && (
                    <div className="flex flex-col items-start gap-1.5 rounded-[12px] bg-lp-warn-bg px-3.5 py-3">
                        <span className="text-[14px] font-bold text-lp-warn">▲ {t("prt.p.blockedText", { station: job.station_name })}</span>
                        <button type="button" onClick={onOpenStations} className={linkButton}>{t("prt.p.openStations")}</button>
                    </div>
                )}

                <dl className="m-0 flex flex-col gap-2.5">
                    {facts.map((fact) => (
                        <div key={fact.key} className="flex justify-between gap-3">
                            <dt className="text-[14px] text-lp-ink-2">{fact.key}</dt>
                            <dd className="m-0 text-right text-[14px] font-bold tabular-nums">{fact.value}</dd>
                        </div>
                    ))}
                </dl>

                {needsHand && delivery === "network" && (
                    <button type="button" disabled={busy} onClick={onSend} className={cx(primaryButton, "self-start")}>
                        {stage === "error" ? t("prt.p.resend") : t("prt.p.send")}
                    </button>
                )}
                {needsHand && delivery === "file" && (
                    <button type="button" disabled={busy} onClick={onFile} className={cx(primaryButton, "self-start")}>
                        {t("prt.p.file")}
                    </button>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-lp-line pt-3">
                    {confirming ? (
                        <>
                            <span className="text-[13px] font-bold text-lp-ink">{t("prt.p.confirmDelete")}</span>
                            <button type="button" disabled={busy} onClick={onDelete} className={dangerLink}>{t("prt.p.yes")}</button>
                            <button type="button" onClick={() => setConfirming(false)} className={linkButton}>{t("prt.p.no")}</button>
                        </>
                    ) : (
                        <>
                            {stage !== "done" && delivery === "network" && (
                                <button type="button" disabled={busy} onClick={onFile} className={linkButton}>{t("prt.p.fileLink")}</button>
                            )}
                            <button type="button" onClick={onRepeat} className={linkButton}>{t("prt.p.repeat")}</button>
                            {atStation && (
                                <button type="button" disabled={busy} onClick={onMarkDone} className={linkButton}>{t("prt.p.markDone")}</button>
                            )}
                            <button type="button" onClick={() => setConfirming(true)} className={dangerLink}>{t("prt.p.delete")}</button>
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
}
