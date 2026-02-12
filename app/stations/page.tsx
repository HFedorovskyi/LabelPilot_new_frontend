"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

function cx(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}

type Station = {
    id: number;
    station_name: string;
    station_number: number | null;
    station_uuid: string;
    station_ip: string | null;
    is_online: boolean;
    created_at: string;
};

export default function StationsPage() {
    const [stations, setStations] = useState<Station[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [newName, setNewName] = useState("");
    const [editingUuid, setEditingUuid] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

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

    const updateStationName = async (uuid: string) => {
        if (!editName.trim()) return;
        try {
            await api.stations.update(uuid, { station_name: editName });
            setEditingUuid(null);
            fetchStations(true);
        } catch (e) {
            alert("Ошибка при переименовании");
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
            await api.stations.create({ station_name: newName });
            setNewName("");
            fetchStations();
        } catch (e) {
            alert("Ошибка при создании станции");
        }
    };

    const syncStation = async (uuid: string, name: string) => {
        try {
            await api.stations.sync(uuid);
            alert(`Данные успешно отправлены на станцию "${name}"`);
        } catch (e) {
            console.error(e);
            alert(`Ошибка при отправке данных на станцию "${name}"`);
        }
    };

    const deleteStation = async (uuid: string) => {
        if (!confirm("Удалить станцию?")) return;
        try {
            await api.stations.delete(uuid);
            setStations((prev) => prev.filter((s) => s.station_uuid !== uuid));
        } catch (e) {
            alert("Ошибка при удалении");
        }
    };

    const [previewData, setPreviewData] = useState<any>(null);
    const [previewName, setPreviewName] = useState("");
    const [serverIp, setServerIp] = useState<string | null>(null);

    const viewStationData = async (uuid: string, name: string) => {
        setIsLoading(true);
        try {
            const data = await api.stations.getFullDump(uuid);
            setPreviewData(data);
            setPreviewName(name);
        } catch (e) {
            alert("Ошибка при загрузке данных");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        api.stations.getServerIp().then(data => setServerIp(data.ip)).catch(console.error);
    }, []);

    return (
        <div className="p-8">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Станции маркировки</h1>
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

            <div className="mb-8 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 md:w-1/2">
                <h3 className="text-lg font-medium text-white">Добавить станцию</h3>
                <div className="flex gap-2">
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Название станции"
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-white/20"
                    />
                    <button
                        onClick={addStation}
                        className="rounded-xl bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
                    >
                        Добавить
                    </button>
                    <button
                        onClick={searchStations}
                        disabled={isSearching}
                        className="rounded-xl bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
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
                                    <div className="flex gap-2">
                                        <input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            autoFocus
                                            className="w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-sm text-white outline-none"
                                        />
                                        <button
                                            onClick={() => updateStationName(s.station_uuid)}
                                            className="text-emerald-500 hover:text-emerald-400"
                                        >
                                            ✓
                                        </button>
                                        <button
                                            onClick={() => setEditingUuid(null)}
                                            className="text-white/40 hover:text-white"
                                        >
                                            ✕
                                        </button>
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
                                            }}
                                            className="opacity-0 transition group-hover:opacity-100 hover:text-blue-400"
                                            title="Переименовать"
                                        >
                                            edit
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
                                <span>IP:</span>
                                <div className="flex items-center gap-1">
                                    <span className="font-mono text-xs">{s.station_ip || "—"}</span>
                                    {s.station_ip && (
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(s.station_ip!);
                                                alert("IP станции скопирован");
                                            }}
                                            className="text-white/40 hover:text-white"
                                            title="Копировать IP станции"
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
            )}
        </div >
    );
}
