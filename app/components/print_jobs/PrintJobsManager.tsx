"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n";

function cx(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}

type Station = {
    id: number;
    station_name: string;
    station_number: string | null;
    station_uuid: string;
    station_ip: string | null;
    station_port: number;
    is_online: boolean;
};

type Nomenclature = {
    id: number;
    name: string;
    article: string;
};

type PrintJob = {
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
};

const STATUS_CONFIG: Record<PrintJob["status"], { labelKey: string; color: string; bg: string; icon: string }> = {
    pending: { labelKey: "printjobs.statusPending", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/20", icon: "⏳" },
    sent: { labelKey: "printjobs.statusSent", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/20", icon: "📨" },
    completed: { labelKey: "printjobs.statusCompleted", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/20", icon: "✅" },
    error: { labelKey: "printjobs.statusError", color: "text-rose-400", bg: "bg-rose-500/15 border-rose-500/20", icon: "❌" },
};

export default function PrintJobsManager() {
    const { t } = useTranslation();
    const [jobs, setJobs] = useState<PrintJob[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [nomenclatures, setNomenclatures] = useState<Nomenclature[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState<number | null>(null);

    // Form state
    const [selectedStation, setSelectedStation] = useState("");
    const [selectedNomenclature, setSelectedNomenclature] = useState("");
    const [quantity, setQuantity] = useState("");
    const [quantityUnit, setQuantityUnit] = useState<"kg" | "pcs">("pcs");
    const [batchNumber, setBatchNumber] = useState("");
    const [markingDate, setMarkingDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [isCreating, setIsCreating] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Search filter for nomenclature
    const [nomenclatureSearch, setNomenclatureSearch] = useState("");
    const [showNomenclatureDropdown, setShowNomenclatureDropdown] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [jobsData, stationsData, nomenclatureData] = await Promise.all([
                api.printJobs.list(),
                api.stations.list(),
                api.nomenclature.list(),
            ]);
            setJobs(jobsData);
            setStations(stationsData);
            setNomenclatures(nomenclatureData);
        } catch (e) {
            console.error("Failed to load data:", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const resetForm = () => {
        setSelectedStation("");
        setSelectedNomenclature("");
        setQuantity("");
        setQuantityUnit("pcs");
        setBatchNumber("");
        setMarkingDate(new Date().toISOString().split('T')[0]);
        setFormError(null);
    };

    const handleCreate = async () => {
        if (!selectedStation || !selectedNomenclature || !quantity) {
            setFormError(t("printjobs.errorRequiredFields"));
            return;
        }
        const qtyNum = parseFloat(quantity);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            setFormError(t("printjobs.errorInvalidQuantity"));
            return;
        }

        setIsCreating(true);
        setFormError(null);
        try {
            await api.printJobs.create({
                station: parseInt(selectedStation),
                nomenclature: parseInt(selectedNomenclature),
                quantity: qtyNum,
                quantity_unit: quantityUnit,
                batch_number: batchNumber,
                marking_date: markingDate,
            });
            resetForm();
            const updatedJobs = await api.printJobs.list();
            setJobs(updatedJobs);
        } catch (e: any) {
            setFormError(e.message || t("printjobs.errorCreate"));
        } finally {
            setIsCreating(false);
        }
    };

    const handleSend = async (jobId: number) => {
        setIsSending(jobId);
        try {
            await api.printJobs.sendToStation(jobId);
            const updatedJobs = await api.printJobs.list();
            setJobs(updatedJobs);
        } catch (e: any) {
            alert(e.message || t("printjobs.errorSend"));
        } finally {
            setIsSending(null);
        }
    };

    const handleDelete = async (jobId: number) => {
        if (!confirm(t("printjobs.confirmDelete"))) return;
        try {
            await api.printJobs.delete(jobId);
            setJobs((prev) => prev.filter((j) => j.id !== jobId));
        } catch (e: any) {
            alert(e.message || t("printjobs.errorDelete"));
        }
    };

    const handleStatusChange = async (jobId: number, newStatus: PrintJob["status"]) => {
        try {
            await api.printJobs.update(jobId, { status: newStatus });
            const updatedJobs = await api.printJobs.list();
            setJobs(updatedJobs);
        } catch (e: any) {
            alert(e.message || t("printjobs.errorUpdateStatus"));
        }
    };

    const triggerDownload = (blob: Blob, filename: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const handleDownloadUsb = async (jobId: number) => {
        try {
            const blob = await api.printJobs.downloadForUsb(jobId);
            triggerDownload(blob, `job_${jobId}.lpj`);
            const updatedJobs = await api.printJobs.list();
            setJobs(updatedJobs);
        } catch (e: any) {
            alert(e.message || t("printjobs.errorDownload"));
        }
    };

    const handleDownloadBundle = async () => {
        try {
            const blob = await api.printJobs.downloadUsbBundle();
            const now = new Date();
            const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
            triggerDownload(blob, `print_jobs_${ts}.lpj`);
            const updatedJobs = await api.printJobs.list();
            setJobs(updatedJobs);
        } catch (e: any) {
            alert(e.message || t("printjobs.errorNoPendingJobs"));
        }
    };

    const filteredNomenclatures = nomenclatures.filter((n) => {
        const q = nomenclatureSearch.toLowerCase();
        return n.name.toLowerCase().includes(q) || n.article.toLowerCase().includes(q);
    });

    const selectedNomObj = nomenclatures.find((n) => String(n.id) === selectedNomenclature);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400" />
                    <span className="text-sm text-white/50">{t("printjobs.loadingData")}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-4">
            {/* ── Creation Form ─────────────────────────────────────── */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur relative z-30">
                <h2 className="mb-5 text-lg font-semibold text-white flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </span>
                    {t("printjobs.newJobTitle")}
                </h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/* Station Selector */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-medium uppercase tracking-wider text-white/50">
                            {t("printjobs.labelStation")}
                        </label>
                        <select
                            value={selectedStation}
                            onChange={(e) => setSelectedStation(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 [&>option]:bg-neutral-900 [&>option]:text-white"
                        >
                            <option value="">{t("printjobs.selectStationPlaceholder")}</option>
                            {stations.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.station_number ? `[${s.station_number}] ` : ""}
                                    {s.station_name}
                                    {s.is_online ? " 🟢" : " 🔴"}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Nomenclature Selector with search */}
                    <div className="space-y-1.5 relative">
                        <label className="block text-xs font-medium uppercase tracking-wider text-white/50">
                            {t("printjobs.labelNomenclature")}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={selectedNomObj ? `${selectedNomObj.article} — ${selectedNomObj.name}` : nomenclatureSearch}
                                onChange={(e) => {
                                    setNomenclatureSearch(e.target.value);
                                    setSelectedNomenclature("");
                                    setShowNomenclatureDropdown(true);
                                }}
                                onFocus={() => setShowNomenclatureDropdown(true)}
                                placeholder={t("printjobs.searchNomenclaturePlaceholder")}
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                            />
                            {selectedNomObj && (
                                <button
                                    onClick={() => {
                                        setSelectedNomenclature("");
                                        setNomenclatureSearch("");
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        {showNomenclatureDropdown && !selectedNomObj && (
                            <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-white/10 bg-neutral-900/95 backdrop-blur shadow-2xl">
                                {filteredNomenclatures.length === 0 ? (
                                    <div className="px-4 py-3 text-sm text-white/40">{t("printjobs.nothingFound")}</div>
                                ) : (
                                    filteredNomenclatures.slice(0, 50).map((n) => (
                                        <button
                                            key={n.id}
                                            onClick={() => {
                                                setSelectedNomenclature(String(n.id));
                                                setNomenclatureSearch("");
                                                setShowNomenclatureDropdown(false);
                                            }}
                                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/5 transition"
                                        >
                                            <span className="font-mono text-xs text-indigo-400/80">{n.article}</span>
                                            <span className="truncate">{n.name}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Batch Number */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-medium uppercase tracking-wider text-white/50">
                            {t("printjobs.labelBatchNumber")}
                        </label>
                        <input
                            type="text"
                            value={batchNumber}
                            onChange={(e) => setBatchNumber(e.target.value)}
                            placeholder={t("printjobs.batchNumberPlaceholder")}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    {/* Marking Date */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-medium uppercase tracking-wider text-white/50">
                            {t("printjobs.labelMarkingDate")}
                        </label>
                        <input
                            type="date"
                            value={markingDate}
                            onChange={(e) => setMarkingDate(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 [color-scheme:dark]"
                        />
                    </div>

                    {/* Quantity + Unit */}
                    <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                        <label className="block text-xs font-medium uppercase tracking-wider text-white/50">
                            {t("printjobs.labelQuantity")}
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                min="0"
                                step={quantityUnit === "kg" ? "0.01" : "1"}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0"
                                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <div className="flex rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                                <button
                                    onClick={() => setQuantityUnit("pcs")}
                                    className={cx(
                                        "px-4 py-2.5 text-sm font-medium transition",
                                        quantityUnit === "pcs"
                                            ? "bg-indigo-500 text-white"
                                            : "text-white/50 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {t("printjobs.unitPcs")}
                                </button>
                                <button
                                    onClick={() => setQuantityUnit("kg")}
                                    className={cx(
                                        "px-4 py-2.5 text-sm font-medium transition",
                                        quantityUnit === "kg"
                                            ? "bg-indigo-500 text-white"
                                            : "text-white/50 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {t("printjobs.unitKg")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {formError && (
                    <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">
                        {formError}
                    </div>
                )}

                <div className="mt-5 flex justify-end">
                    <button
                        onClick={handleCreate}
                        disabled={isCreating}
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-neutral-950 shadow-[0_4px_20px_rgba(255,255,255,0.15)] transition hover:bg-white/90 disabled:opacity-50"
                    >
                        {isCreating ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-neutral-950" />
                                {t("printjobs.creating")}
                            </>
                        ) : (
                            <>{t("printjobs.createJob")}</>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Click outside to close dropdown overlay ───────── */}
            {showNomenclatureDropdown && !selectedNomObj && (
                <div className="fixed inset-0 z-20" onClick={() => setShowNomenclatureDropdown(false)} />
            )}

            {/* ── Jobs List ─────────────────────────────────────────── */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">
                        {t("printjobs.jobsHeader")}
                        <span className="ml-2 text-sm font-normal text-white/40">({jobs.length})</span>
                    </h2>
                    <div className="flex items-center gap-2">
                        {jobs.some((j) => j.status === "pending") && (
                            <button
                                onClick={handleDownloadBundle}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/25 transition"
                                title={t("printjobs.downloadAllUsbTitle")}
                            >
                                💾 {t("printjobs.downloadAllUsb")}
                            </button>
                        )}
                        <button
                            onClick={fetchData}
                            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition"
                        >
                            🔄 {t("printjobs.refresh")}
                        </button>
                    </div>
                </div>

                {jobs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
                        <div className="text-3xl mb-2">📋</div>
                        <div className="text-sm text-white/40">{t("printjobs.emptyTitle")}</div>
                        <div className="text-xs text-white/25 mt-1">{t("printjobs.emptyHint")}</div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {jobs.map((job) => {
                            const status = STATUS_CONFIG[job.status];
                            return (
                                <div
                                    key={job.id}
                                    className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.05]"
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex-1 space-y-2">
                                            {/* Top row: badge + nomenclature */}
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span
                                                    className={cx(
                                                        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium",
                                                        status.bg,
                                                        status.color
                                                    )}
                                                >
                                                    {status.icon} {t(status.labelKey)}
                                                </span>
                                                <span className="text-sm font-semibold text-white">
                                                    {job.nomenclature_name}
                                                </span>
                                                <span className="font-mono text-xs text-white/40">
                                                    {job.nomenclature_article}
                                                </span>
                                            </div>

                                            {/* Details row */}
                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-white/50">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="text-white/30">{t("printjobs.detailStation")}</span>
                                                    <span className="text-white/70">{job.station_name}</span>
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="text-white/30">{t("printjobs.detailQuantity")}</span>
                                                    <span className="font-mono font-semibold text-white/70">
                                                        {job.quantity} {job.quantity_unit === "kg" ? t("printjobs.unitKg") : t("printjobs.unitPcs")}
                                                    </span>
                                                </span>
                                                {job.batch_number && (
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="text-white/30">{t("printjobs.detailBatch")}</span>
                                                        <span className="font-mono text-white/70">{job.batch_number}</span>
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1.5">
                                                    <span className="text-white/30">{t("printjobs.detailMarkingDate")}</span>
                                                    <span className="text-white/70">{job.marking_date ? new Date(job.marking_date).toLocaleDateString() : '—'}</span>
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="text-white/30">{t("printjobs.detailCreated")}</span>
                                                    <span>{new Date(job.created_at).toLocaleString()}</span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {job.status === "pending" && (
                                                <>
                                                    <button
                                                        onClick={() => handleSend(job.id)}
                                                        disabled={isSending === job.id}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/30 transition disabled:opacity-50"
                                                    >
                                                        {isSending === job.id ? (
                                                            <div className="h-3 w-3 animate-spin rounded-full border border-indigo-300/30 border-t-indigo-300" />
                                                        ) : (
                                                            "📤"
                                                        )}
                                                        {t("printjobs.send")}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownloadUsb(job.id)}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/25 transition"
                                                        title={t("printjobs.downloadUsbTitle")}
                                                    >
                                                        💾 USB
                                                    </button>
                                                </>
                                            )}
                                            {job.status === "error" && (
                                                <button
                                                    onClick={() => handleStatusChange(job.id, "pending")}
                                                    className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 border border-amber-500/20 hover:bg-amber-500/30 transition"
                                                >
                                                    🔁 {t("printjobs.retry")}
                                                </button>
                                            )}
                                            {job.status === "sent" && (
                                                <button
                                                    onClick={() => handleStatusChange(job.id, "completed")}
                                                    className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/30 transition"
                                                >
                                                    ✅ {t("printjobs.markCompleted")}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(job.id)}
                                                className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/40 hover:bg-rose-500/15 hover:text-rose-400 transition"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
