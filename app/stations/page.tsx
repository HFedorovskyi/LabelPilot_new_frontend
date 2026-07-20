"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import ErrorModal from "@/app/components/ErrorModal";
import Portal from "@/app/components/Portal";

function cx(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}

type Station = {
    id: number;
    station_name: string;
    station_number: number | null;
    station_uuid: string;
    station_ip: string | null;
    station_port: number;
    is_online: boolean;
    created_at: string;
};

export default function StationsPage() {
    const [stations, setStations] = useState<Station[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [newName, setNewName] = useState("");
    const [newIp, setNewIp] = useState("");
    const [newPort, setNewPort] = useState("5000");
    const [editingUuid, setEditingUuid] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editIp, setEditIp] = useState("");
    const [editPort, setEditPort] = useState("");

    const fetchStations = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const data = await api.stations.list();
            setStations(data);
        } catch (e) {
            console.error(e);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const updateStation = async (uuid: string) => {
        if (!editName.trim()) return;
        try {
            await api.stations.update(uuid, {
                station_name: editName,
                station_ip: editIp || null,
                station_port: parseInt(editPort) || 5000
            });
            setEditingUuid(null);
            fetchStations(true);
        } catch (e) {
            alert("Ошибка при обновлении данных станции");
        }
    };

    const searchStations = async () => {
        setIsSearching(true);
        // Simulate network delay or discovery refresh
        await new Promise(resolve => setTimeout(resolve, 3000));
        await fetchStations();
        setIsSearching(false);
    };

    useEffect(() => {
        fetchStations();
        const interval = setInterval(() => fetchStations(true), 5000);
        return () => clearInterval(interval);
    }, []);

    const addStation = async () => {
        if (!newName.trim()) return;
        try {
            await api.stations.create({
                station_name: newName,
                station_ip: newIp || null,
                station_port: parseInt(newPort) || 5000
            });
            setNewName("");
            setNewIp("");
            setNewPort("5000");
            fetchStations();
        } catch (e) {
            alert("Ошибка при создании станции");
        }
    };

    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorModalTitle, setErrorModalTitle] = useState("");
    const [errorModalMessage, setErrorModalMessage] = useState("");
    const [errorModalDetails, setErrorModalDetails] = useState<any>(null);

    const showError = (title: string, message: string, details?: any) => {
        setErrorModalTitle(title);
        setErrorModalMessage(message);
        setErrorModalDetails(details);
        setErrorModalOpen(true);
    };

    const syncStation = async (uuid: string, name: string) => {
        try {
            await api.stations.sync(uuid);
            // Optional: nice toast here, but alert is fine for success for now
            alert(`Данные успешно отправлены на станцию "${name}"`);
        } catch (e: any) {
            console.error(e);
            showError(
                `Ошибка синхронизации`,
                `Не удалось отправить данные на станцию "${name}".`,
                e.message || e
            );
        }
    };

    const deleteStation = async (uuid: string) => {
        if (!confirm("Удалить станцию?")) return;
        try {
            await api.stations.delete(uuid);
            setStations((prev) => prev.filter((s) => s.station_uuid !== uuid));
        } catch (e: any) {
            showError("Ошибка удаления", "Не удалось удалить станцию", e.message || e);
        }
    };

    // ... (keep logic for viewStationData, loading data etc as is, maybe use showError there too if desired later)

    const [previewData, setPreviewData] = useState<any>(null);
    const [previewName, setPreviewName] = useState("");
    const [serverIp, setServerIp] = useState<string | null>(null);

    const viewStationData = async (uuid: string, name: string) => {
        setIsLoading(true);
        try {
            const data = await api.stations.getFullDump(uuid);
            setPreviewData(data);
            setPreviewName(name);
        } catch (e: any) {
            showError("Ошибка загрузки", "Не удалось загрузить данные станции", e.message || e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        api.stations.getServerIp().then(data => setServerIp(data.ip)).catch(console.error);
    }, []);

    const downloadUpdate = async (uuid: string, name: string) => {
        try {
            const blob = await api.stations.downloadUpdate(uuid);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `update_${name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.lps`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e: any) {
            showError("Ошибка скачивания", "Не удалось скачать обновление", e.message || e);
        }
    };

    const downloadIdentity = async (uuid: string, name: string) => {
        try {
            const blob = await api.stations.downloadIdentity(uuid);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `identity_${name.replace(/\s+/g, '_')}.lpi`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e: any) {
            showError("Ошибка скачивания", "Не удалось скачать идентификатор", e.message || e);
        }
    };

    const handleReportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            await api.stations.uploadReport(file);
            alert("Отчет успешно загружен");
            fetchStations(true);
        } catch (e: any) {
            showError("Ошибка загрузки отчета", "Не удалось обработать отчет", e.message || e);
        } finally {
            e.target.value = ''; // Reset input
        }
    };

    return (
        <div className="p-8">
            <ErrorModal
                isOpen={errorModalOpen}
                onClose={() => setErrorModalOpen(false)}
                title={errorModalTitle}
                message={errorModalMessage}
                details={errorModalDetails}
            />
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Станции маркировки</h1>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 rounded-xl bg-blue-500/20 px-4 py-2 text-blue-300 hover:bg-blue-500/30 cursor-pointer transition">
                        <span>📤 Загрузить отчет (.lpr)</span>
                        <input type="file" accept=".lpr" onChange={handleReportUpload} className="hidden" />
                    </label>

                    {serverIp && (
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                            <span className="text-sm text-white/60">Server IP: </span>
                            <span className="font-mono text-sm font-bold text-emerald-400">{serverIp}</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(serverIp);
                                    alert("IP скопирован");
                                }}
                                className="ml-2 text-white/40 hover:text-white"
                                title="Копировать IP"
                            >
                                📋
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 md:w-3/4">
                <h3 className="mb-4 text-lg font-medium text-white">Добавить станцию</h3>
                <div className="flex flex-wrap gap-3">
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Название (обязательно)"
                        className="flex-1 min-w-[200px] rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-white/20"
                    />
                    <input
                        value={newIp}
                        onChange={(e) => setNewIp(e.target.value)}
                        placeholder="IP адрес (опционально)"
                        className="w-48 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-white/20"
                    />
                    <input
                        value={newPort}
                        onChange={(e) => setNewPort(e.target.value)}
                        placeholder="Порт"
                        className="w-24 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-white/20"
                    />
                    <button
                        onClick={addStation}
                        className="rounded-xl bg-white px-6 py-2 font-medium text-black hover:bg-white/90 transition"
                    >
                        Добавить
                    </button>
                    <button
                        onClick={searchStations}
                        disabled={isSearching}
                        className="rounded-xl bg-blue-500/20 px-6 py-2 font-medium text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50 transition"
                    >
                        {isSearching ? "Поиск..." : "Поиск станций"}
                    </button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stations.map((s) => (
                    <div
                        key={s.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/[0.07]"
                    >
                        <div className="mb-4 flex items-start justify-between">
                            <div className="flex-1">
                                {editingUuid === s.station_uuid ? (
                                    <div className="space-y-2 pr-2">
                                        <input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            placeholder="Название"
                                            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white outline-none"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                value={editIp}
                                                onChange={(e) => setEditIp(e.target.value)}
                                                placeholder="IP адрес"
                                                className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white outline-none"
                                            />
                                            <input
                                                value={editPort}
                                                onChange={(e) => setEditPort(e.target.value)}
                                                placeholder="Порт"
                                                className="w-20 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white outline-none"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => updateStation(s.station_uuid)}
                                                className="flex-1 rounded-lg bg-emerald-500/20 py-1 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30"
                                            >
                                                Сохранить
                                            </button>
                                            <button
                                                onClick={() => setEditingUuid(null)}
                                                className="rounded-lg bg-white/5 px-3 py-1 text-xs text-white/40 hover:bg-white/10"
                                            >
                                                Отмена
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="group flex items-center gap-2">
                                        {s.station_number != null && (
                                            <span className="inline-flex items-center justify-center rounded-lg bg-white/10 px-2 py-0.5 font-mono text-sm font-bold text-white/80 border border-white/10">
                                                #{String(s.station_number).padStart(2, '0')}
                                            </span>
                                        )}
                                        <h3 className="font-semibold text-white">{s.station_name}</h3>
                                        <button
                                            onClick={() => {
                                                setEditingUuid(s.station_uuid);
                                                setEditName(s.station_name);
                                                setEditIp(s.station_ip || "");
                                                setEditPort(String(s.station_port || 5000));
                                            }}
                                            className="opacity-0 transition group-hover:opacity-100 text-white/40 hover:text-blue-400"
                                            title="Редактировать данные станции"
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                )}
                                <div className="mt-1 flex items-center gap-2">
                                    <div
                                        className={cx(
                                            "h-2 w-2 rounded-full",
                                            s.is_online ? "bg-emerald-500" : "bg-rose-500"
                                        )}
                                    />
                                    <span className="text-xs text-white/50">
                                        {s.is_online ? "Online" : "Offline"}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => viewStationData(s.station_uuid, s.station_name)}
                                    className="text-white/40 hover:text-blue-400"
                                    title="Просмотреть данные синхронизации"
                                >
                                    👁️
                                </button>
                                <button
                                    onClick={() => syncStation(s.station_uuid, s.station_name)}
                                    disabled={!s.is_online}
                                    className={cx(
                                        "text-white/40",
                                        s.is_online ? "hover:text-emerald-400" : "opacity-30 cursor-not-allowed"
                                    )}
                                    title={s.is_online ? "Синхронизировать данные" : "Станция офлайн"}
                                >
                                    🔄
                                </button>
                                <button
                                    onClick={() => deleteStation(s.station_uuid)}
                                    className="text-white/40 hover:text-rose-400"
                                    title="Удалить станцию"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>


                        <div className="mb-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                            <button
                                onClick={() => downloadUpdate(s.station_uuid, s.station_name)}
                                className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition"
                            >
                                💾 Обновление (.lps)
                            </button>
                            <button
                                onClick={() => downloadIdentity(s.station_uuid, s.station_name)}
                                className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition"
                            >
                                🆔 Настройка (.lpi)
                            </button>
                        </div>

                        <div className="space-y-2 text-sm text-white/60">
                            <div className="flex justify-between">
                                <span>Номер:</span>
                                <span className="font-mono text-xs font-bold">
                                    {s.station_number != null ? String(s.station_number).padStart(2, '0') : '—'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>UUID:</span>
                                <span className="font-mono text-xs">{s.station_uuid}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Адрес:</span>
                                <div className="flex items-center gap-1">
                                    <span className="font-mono text-xs text-white/80">
                                        {s.station_ip || "—"}:{s.station_port}
                                    </span>
                                    {s.station_ip && (
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${s.station_ip}:${s.station_port}`);
                                                alert("Адрес станции скопирован");
                                            }}
                                            className="text-white/40 hover:text-white"
                                            title="Копировать адрес"
                                        >
                                            📋
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between">
                                <span>Создана:</span>
                                <span className="text-xs">
                                    {new Date(s.created_at).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
                {stations.length === 0 && !isLoading && (
                    <div className="col-span-full py-12 text-center text-white/40">
                        Нет активных станций
                    </div>
                )}
            </div>

            {/* JSON Preview Modal */}
            {previewData && (
                <Portal>
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-white/10 bg-[#0A0A0B] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                            <div>
                                <h3 className="text-xl font-bold text-white">Данные синхронизации</h3>
                                <p className="text-sm text-white/50">{previewName}</p>
                            </div>
                            <button
                                onClick={() => setPreviewData(null)}
                                className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <pre className="rounded-2xl bg-black/50 p-6 text-xs text-blue-300 font-mono scrollbar-thin scrollbar-thumb-white/10">
                                {JSON.stringify(previewData, null, 2)}
                            </pre>
                        </div>
                        <div className="border-t border-white/10 px-6 py-4 flex justify-end">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(JSON.stringify(previewData, null, 2));
                                    alert("Скопировано в буфер обмена");
                                }}
                                className="rounded-xl bg-white px-6 py-2 text-sm font-semibold text-black hover:bg-white/90"
                            >
                                Копировать JSON
                            </button>
                        </div>
                    </div>
                </div>
                </Portal>
            )}
        </div >
    );
}
