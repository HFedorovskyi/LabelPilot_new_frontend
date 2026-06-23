import React, { useState, useMemo } from "react";
import { api } from "@/lib/api/client";
import { SmallButton, Select, Card } from "./ProductCatalog";
import type { GlobalAttribute, Packaging, LabelTemplate } from "./types";

interface ImportModalProps {
    onClose: () => void;
    onSuccess: () => void;
    globalAttributes: GlobalAttribute[];
    packs: Packaging[];
    templates: LabelTemplate[];
}

export default function ImportModal({ onClose, onSuccess, globalAttributes, packs, templates }: ImportModalProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorInfo, setErrorInfo] = useState<string | null>(null);
    const [separator, setSeparator] = useState<string>("auto");

    // Preview Phase
    const [columns, setColumns] = useState<string[]>([]);
    const [previewRows, setPreviewRows] = useState<any[]>([]);

    // Mapping Phase
    const [mapping, setMapping] = useState({
        article: "",
        name: "",
        exp_date: "",
        close_box_counter: "",
        extra_data_map: {} as Record<string, string>
    });

    // Result Phase
    const [staticMapping, setStaticMapping] = useState({
        portionContainerId: "",
        boxContainerId: "",
        packLabelId: "",
        boxLabelId: ""
    });

    const [importResult, setImportResult] = useState<{
        imported: number;
        error_count: number;
        errors: string[];
    } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const guessMapping = (cols: string[]) => {
        const guess = {
            article: "",
            name: "",
            exp_date: "",
            close_box_counter: "",
            extra_data_map: {} as Record<string, string>
        };

        // Initialize empty map for all global attributes
        globalAttributes.forEach(attr => {
            guess.extra_data_map[attr.name] = "";
        });

        // Simple heuristic guessing
        for (const c of cols) {
            const lower = c.toLowerCase();
            if (!guess.article && (lower.includes("арт") || lower.includes("sku"))) guess.article = c;
            else if (!guess.name && (lower.includes("наим") || lower.includes("назв") || lower.includes("тов") || lower.includes("name"))) guess.name = c;
            else if (!guess.exp_date && (lower.includes("срок") || lower.includes("годн"))) guess.exp_date = c;
            else if (!guess.close_box_counter && (lower.includes("влож") || lower.includes("короб") || lower.includes("шт"))) guess.close_box_counter = c;
            // if it matched a global attribute exactly
            const matchedAttr = globalAttributes.find(attr => attr.name.toLowerCase() === lower);
            if (matchedAttr) {
                guess.extra_data_map[matchedAttr.name] = c;
            }
        }
        setMapping(guess);
    };

    const handlePreview = async () => {
        if (!file) return;
        setIsLoading(true);
        setErrorInfo(null);
        try {
            const res = await api.nomenclature.previewImport(file, separator);
            setColumns(res.columns || []);
            setPreviewRows(res.preview || []);
            guessMapping(res.columns || []);
            setStep(2);
        } catch (e: any) {
            console.error(e);
            setErrorInfo(e.message || "Ошибка загрузки файла для предпросмотра");
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        if (!file) return;
        setIsLoading(true);
        setErrorInfo(null);
        try {
            const payloadMapping = {
                ...mapping,
                staticValues: staticMapping
            };
            const res = await api.nomenclature.executeImport(file, separator, payloadMapping);
            setImportResult({
                imported: res.imported,
                error_count: res.error_count,
                errors: res.errors
            });
            setStep(3);
        } catch (e: any) {
            console.error(e);
            setErrorInfo(e.message || "Ошибка во время импорта");
        } finally {
            setIsLoading(false);
        }
    };

    // (Toggle Extra Column function removed as we now use explicit selects)

    const colOptions = useMemo(() => {
        return columns.map(c => ({ value: c, label: c }));
    }, [columns]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">

                <div className="p-4 border-b border-white/10 flex justify-between items-center shrink-0">
                    <h3 className="text-xl font-semibold text-white">Импорт номенклатуры (Excel, CSV)</h3>
                    <button onClick={onClose} className="text-white/50 hover:text-white">&times;</button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {errorInfo && (
                        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-200 text-sm">
                            {errorInfo}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="flex flex-col items-center justify-center py-10">
                            <div className="text-white mb-4">Выберите файл .xlsx, .xls или .csv</div>
                            <input
                                type="file"
                                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                onChange={handleFileChange}
                                className="mb-6 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20"
                            />

                            {file?.name.toLowerCase().endsWith(".csv") && (
                                <div className="mb-6 w-full max-w-sm grid gap-1">
                                    <label className="text-xs text-white/70 font-medium">Разделитель (для CSV)</label>
                                    <Select
                                        options={[
                                            { value: "auto", label: "Автоматически" },
                                            { value: ";", label: "Точка с запятой (;)" },
                                            { value: ",", label: "Запятая (,)" },
                                            { value: "\\t", label: "Табуляция" },
                                        ]}
                                        value={separator}
                                        onChange={setSeparator}
                                        placeholder="Выберите разделитель..."
                                    />
                                </div>
                            )}

                            <div className="text-sm text-white/50 bg-white/5 p-4 rounded-xl mb-6 max-w-lg">
                                <p><strong>Важно:</strong></p>
                                <ul className="list-disc ml-5 mt-2 space-y-1">
                                    <li>Первая строка файла должна содержать заголовки.</li>
                                    <li>Если артикул уже существует в базе, его данные будут обновлены.</li>
                                    <li>Если артикул новый, будет создан новый товар.</li>
                                </ul>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <SmallButton onClick={onClose}>Отмена</SmallButton>
                                <SmallButton variant="primary" onClick={handlePreview} disabled={!file || isLoading}>
                                    {isLoading ? "Обработка..." : "Далее: Настройка колонок"}
                                </SmallButton>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="text-sm text-white/70">
                                Мы попытались автоматически сопоставить колонки. Проверьте и исправьте при необходимости.
                            </div>

                            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                <div className="space-y-4 border-r border-white/10 pr-4">
                                    <h4 className="text-white font-medium mb-2 border-b border-white/10 pb-2">Основные поля</h4>

                                    <div className="grid gap-1">
                                        <label className="text-xs text-rose-300 font-medium">Артикул / SKU (Обязательно)</label>
                                        <Select
                                            options={colOptions}
                                            value={mapping.article}
                                            onChange={v => setMapping({ ...mapping, article: v })}
                                            placeholder="Выберите колонку..."
                                        />
                                    </div>

                                    <div className="grid gap-1">
                                        <label className="text-xs text-rose-300 font-medium">Название товара (Обязательно)</label>
                                        <Select
                                            options={colOptions}
                                            value={mapping.name}
                                            onChange={v => setMapping({ ...mapping, name: v })}
                                            placeholder="Выберите колонку..."
                                        />
                                    </div>

                                    <div className="grid gap-1 mt-4">
                                        <label className="text-xs text-white/70 font-medium">Срок годности (сут)</label>
                                        <Select
                                            options={colOptions}
                                            value={mapping.exp_date}
                                            onChange={v => setMapping({ ...mapping, exp_date: v })}
                                            placeholder="Пропустить"
                                        />
                                    </div>

                                    <div className="grid gap-1">
                                        <label className="text-xs text-white/70 font-medium">Кол-во вложений в: короб</label>
                                        <Select
                                            options={colOptions}
                                            value={mapping.close_box_counter}
                                            onChange={v => setMapping({ ...mapping, close_box_counter: v })}
                                            placeholder="Пропустить"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-0 pl-2">
                                    <h4 className="text-white font-medium mb-2 border-b border-white/10 pb-2">Дополнительные поля</h4>
                                    <div className="text-xs text-white/40 mb-3">
                                        Выберите колонки, которые нужно загрузить как дополнительные атрибуты.
                                    </div>
                                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                        {globalAttributes.length === 0 ? (
                                            <div className="text-xs text-white/30 italic">В системе пока нет дополнительных параметров товара (их можно добавить в Настройках таблицы).</div>
                                        ) : (
                                            globalAttributes.map(attr => (
                                                <div key={attr.id} className="grid gap-1">
                                                    <label className="text-xs text-white/70 font-medium">{attr.name}</label>
                                                    <Select
                                                        options={colOptions}
                                                        value={mapping.extra_data_map[attr.name] || ""}
                                                        onChange={v => setMapping({
                                                            ...mapping,
                                                            extra_data_map: { ...mapping.extra_data_map, [attr.name]: v }
                                                        })}
                                                        placeholder="Пропустить"
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/10 md:col-span-2">
                                    <h4 className="text-white font-medium mb-1">Общие настройки (применяются ко всем импортируемым товарам)</h4>
                                    <div className="text-xs text-white/40 mb-4">
                                        Значения, выбранные ниже, будут установлены для всех товаров в этом файле. Вы можете изменить их позже.
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-1">
                                            <label className="text-xs text-white/70 font-medium">Упаковка (порция)</label>
                                            <Select
                                                options={[{ value: "", label: "Пропустить" }, ...packs.map(p => ({ value: p.id, label: p.name }))]}
                                                value={staticMapping.portionContainerId}
                                                onChange={v => setStaticMapping({ ...staticMapping, portionContainerId: v })}
                                                placeholder="Пропустить"
                                            />
                                        </div>
                                        <div className="grid gap-1">
                                            <label className="text-xs text-white/70 font-medium">Этикетка (порция)</label>
                                            <Select
                                                options={[{ value: "", label: "Пропустить" }, ...templates.map(t => ({ value: t.id, label: t.name }))]}
                                                value={staticMapping.packLabelId}
                                                onChange={v => setStaticMapping({ ...staticMapping, packLabelId: v })}
                                                placeholder="Пропустить"
                                            />
                                        </div>
                                        <div className="grid gap-1">
                                            <label className="text-xs text-white/70 font-medium">Упаковка (короб)</label>
                                            <Select
                                                options={[{ value: "", label: "Пропустить" }, ...packs.map(p => ({ value: p.id, label: p.name }))]}
                                                value={staticMapping.boxContainerId}
                                                onChange={v => setStaticMapping({ ...staticMapping, boxContainerId: v })}
                                                placeholder="Пропустить"
                                            />
                                        </div>
                                        <div className="grid gap-1">
                                            <label className="text-xs text-white/70 font-medium">Этикетка (короб)</label>
                                            <Select
                                                options={[{ value: "", label: "Пропустить" }, ...templates.map(t => ({ value: t.id, label: t.name }))]}
                                                value={staticMapping.boxLabelId}
                                                onChange={v => setStaticMapping({ ...staticMapping, boxLabelId: v })}
                                                placeholder="Пропустить"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {previewRows.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    <h4 className="text-white text-sm font-medium mb-2">Предпросмотр данных (первые 3 строки)</h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs text-white/60">
                                            <thead className="bg-white/5 text-white/80 uppercase">
                                                <tr>
                                                    {columns.slice(0, 6).map(c => (
                                                        <th key={c} className="px-3 py-2 font-medium truncate max-w-[150px]">{c}</th>
                                                    ))}
                                                    {columns.length > 6 && <th className="px-3 py-2">...</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 bg-black/20">
                                                {previewRows.slice(0, 3).map((row, i) => (
                                                    <tr key={i}>
                                                        {columns.slice(0, 6).map(c => (
                                                            <td key={c} className="px-3 py-2 truncate max-w-[150px]">{String(row[c] ?? '')}</td>
                                                        ))}
                                                        {columns.length > 6 && <td className="px-3 py-2">...</td>}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-white/10">
                                <SmallButton onClick={() => setStep(1)}>Назад</SmallButton>
                                <SmallButton
                                    variant="primary"
                                    onClick={handleImport}
                                    disabled={!mapping.article || !mapping.name || isLoading}
                                >
                                    {isLoading ? "Импортируем..." : "Начать импорт"}
                                </SmallButton>
                            </div>
                        </div>
                    )}

                    {step === 3 && importResult && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-6">
                            <div className={importResult.error_count > 0 ? "text-amber-400 text-lg font-medium" : "text-emerald-400 text-lg font-medium"}>
                                Импорт завершен
                            </div>

                            <div className="grid grid-cols-2 gap-4 w-full max-w-sm text-center">
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <div className="text-3xl font-bold text-white mb-1">{importResult.imported}</div>
                                    <div className="text-xs text-white/50 uppercase">Успешно</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <div className="text-3xl font-bold text-rose-400 mb-1">{importResult.error_count}</div>
                                    <div className="text-xs text-white/50 uppercase">Ошибок</div>
                                </div>
                            </div>

                            {importResult.errors.length > 0 && (
                                <div className="w-full max-w-lg bg-black/40 border border-white/5 rounded-xl p-4 max-h-[200px] overflow-y-auto">
                                    <div className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">Примеры ошибок:</div>
                                    <ul className="text-xs text-rose-300 space-y-1 list-disc pl-4">
                                        {importResult.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex gap-3 mt-4">
                                <SmallButton variant="primary" onClick={onSuccess}>
                                    Готово
                                </SmallButton>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
