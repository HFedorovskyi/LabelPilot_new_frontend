"use client";

import * as React from "react";
import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api/client";
import { cx } from "../catalog/utils";

// --- Components ---

interface CardProps {
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    children?: React.ReactNode;
}

function Card({ title, subtitle, right, children }: CardProps) {
    return (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-base font-semibold text-white">{title}</h3>
                    {subtitle ? <p className="mt-1 text-sm text-white/65">{subtitle}</p> : null}
                </div>
                {right ? <div className="shrink-0">{right}</div> : null}
            </div>
            <div className="mt-4">{children}</div>
        </section>
    );
}

interface SmallButtonProps {
    children?: React.ReactNode;
    onClick?: () => void;
    variant?: "primary" | "secondary" | "ghost" | "danger";
    disabled?: boolean;
    title?: string;
    className?: string;
}

function SmallButton({
    children,
    onClick,
    variant = "secondary",
    disabled,
    title,
    className,
}: SmallButtonProps) {
    const base =
        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed";
    const styles =
        variant === "primary"
            ? "bg-white text-neutral-950 hover:bg-white/90"
            : variant === "danger"
                ? "bg-rose-500/15 text-rose-100 hover:bg-rose-500/20 border border-rose-500/25"
                : variant === "secondary"
                    ? "bg-white/10 text-white hover:bg-white/15 border border-white/10"
                    : "text-white/75 hover:text-white hover:bg-white/10";
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={onClick}
            className={cx(base, styles, className)}
        >
            {children}
        </button>
    );
}

function Input({
    value,
    onChange,
    placeholder,
    type = "text",
    className,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: "text" | "number";
    className?: string;
}) {
    return (
        <input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            className={cx(
                "h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20 focus:bg-white/10",
                className
            )}
        />
    );
}

function Select({
    value,
    onChange,
    options,
    className,
}: {
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
    className?: string;
}) {
    return (
        <select
            value={value}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
            className={cx(
                "h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20 focus:bg-white/10",
                className
            )}
        >
            {options.map((o) => (
                <option key={o.value} value={o.value} className="bg-neutral-950">
                    {o.label}
                </option>
            ))}
        </select>
    );
}

// --- Constants & Types ---

const BARCODE_TYPES = [
    { value: "ean13", label: "EAN13" },
    { value: "code128", label: "Code128" },
    { value: "qrcode", label: "QRcode" },
    { value: "databarexpandedstacked", label: "GS1-DataBar Expanded Stacked" },
    { value: "gs1qrcode", label: "GS1 QR Code" },
];

const FIELD_TYPES = [
    { value: "constanta", label: "Константа" },
    { value: "weight_netto_pack", label: "Вес нетто упаковки" },
    { value: "weight_brutto_pack", label: "Вес брутто упаковки" },
    { value: "weight_netto_box", label: "Вес нетто короба" },
    { value: "weight_brutto_box", label: "Вес брутто короба" },
    { value: "weight_netto_pallet", label: "Вес нетто паллета" },
    { value: "weight_brutto_pallet", label: "Вес брутто паллета" },
    { value: "weight_brutto_all", label: "Общий вес брутто паллета (с поддоном)" },
    { value: "production_date", label: "Дата производства" },
    { value: "exp_date", label: "Годен до" },
    { value: "pack_number", label: "Номер упаковки" },
    { value: "box_number", label: "Номер короба" },
    { value: "pallet_number", label: "Номер паллеты" },
    { value: "article", label: "Артикул" },
    { value: "pack_count", label: "Количество вложений в коробе" },
    { value: "box_count", label: "Количество коробов на паллете" },
    { value: "batch_number", label: "Номер партии" },
    { value: "fnc1", label: "FNC1 (GS1)" },
    { value: "gs", label: "Group Separator (ASCII 29)" },
    { value: "ai", label: "Идентификатор AI" },
];

const DATE_FORMATS = [
    { value: "ddMMyy", label: "ddMMyy" },
    { value: "ddMMyyyy", label: "ddMMyyyy" },
    { value: "yyMMdd", label: "yyMMdd" },
    { value: "yyyyMMdd", label: "yyyyMMdd" },
];

const AI_OPTIONS = [
    { value: "00", label: "(00) SSCC - 18 симв." },
    { value: "01", label: "(01) GTIN - 14 симв." },
    { value: "02", label: "(02) GTIN Contained - 14 симв." },
    { value: "10", label: "(10) Batch/Lot - до 20 симв." },
    { value: "11", label: "(11) Prod Date - 6 симв." },
    { value: "17", label: "(17) Expiry Date - 6 симв." },
    { value: "21", label: "(21) Serial Number - до 20 симв." },
    { value: "3103", label: "(3103) Net Weight (kg) - 6 симв." },
];

export type BarcodeField = {
    field_type: string;
    value?: string;
    length?: string;
    decimalPlaces?: string;
    dateFormat?: string;
};

export type BarcodeTemplate = {
    id: string;
    name: string;
    structure: {
        barcode_type: string;
        barcode_name: string;
        fields: BarcodeField[];
    };
};

// --- Main Component ---

export default function BarcodeTemplatesManager() {
    const [templates, setTemplates] = useState<BarcodeTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [templateName, setTemplateName] = useState("");
    const [barcodeType, setBarcodeType] = useState("ean13");
    const [fields, setFields] = useState<BarcodeField[]>([
        { field_type: "constanta", value: "460" },
    ]);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Preview State
    const [previewPng, setPreviewPng] = useState<string | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const data = await api.barcodes.list();
            const items = Array.isArray(data) ? data : data.results || [];

            const mapped = items.map((item: any) => ({
                id: item.id.toString(),
                name: item.name,
                structure: typeof item.structure === 'string' ? JSON.parse(item.structure.replace(/'/g, '"')) : item.structure,
            }));
            setTemplates(mapped);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const addField = () => {
        setFields([...fields, { field_type: "constanta", value: "" }]);
    };

    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const updateField = (index: number, patch: Partial<BarcodeField>) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], ...patch };
        setFields(newFields);
    };

    const resetForm = () => {
        setTemplateName("");
        setBarcodeType("ean13");
        setFields([{ field_type: "constanta", value: "460" }]);
        setEditingId(null);
        setPreviewPng(null);
    };

    const handleEdit = (t: BarcodeTemplate) => {
        setEditingId(t.id);
        setTemplateName(t.name);
        setBarcodeType(t.structure.barcode_type);
        setFields(t.structure.fields || []);
        setPreviewPng(null);
    };

    const handlePreview = async () => {
        if (!templateName) return alert("Введите название шаблона");
        setIsPreviewLoading(true);
        try {
            const structure = {
                barcode_type: barcodeType,
                barcode_name: templateName,
                fields,
            };
            const res = await api.barcodes.generate(structure);
            if (res.png) {
                setPreviewPng(res.png);
            }
        } catch (e: any) {
            alert("Ошибка предпросмотра: " + e.message);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleSave = async () => {
        if (!templateName.trim()) return alert("Введите название");
        const structure = {
            barcode_type: barcodeType,
            barcode_name: templateName,
            fields,
        };

        const payload = {
            name: templateName,
            structure: JSON.stringify(structure),
        };

        try {
            if (editingId) {
                await api.barcodes.update(editingId, payload);
            } else {
                await api.barcodes.create(payload);
            }
            fetchTemplates();
            resetForm();
        } catch (e) {
            console.error(e);
            alert("Ошибка сохранения");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Удалить этот шаблон?")) return;
        try {
            await api.barcodes.delete(id);
            fetchTemplates();
        } catch (e) {
            console.error(e);
            alert("Ошибка удаления");
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-12">
            {/* Left Column: Designer */}
            <div className="md:col-span-7">
                <Card
                    title={editingId ? "Редактировать шаблон" : "Новый шаблон штрихкода"}
                    subtitle="Настройте структуру штрихкода, добавляя константы и динамические поля."
                    right={
                        <div className="flex gap-2">
                            {editingId && (
                                <SmallButton onClick={resetForm}>Отмена</SmallButton>
                            )}
                            <SmallButton variant="primary" onClick={handleSave}>
                                {editingId ? "Сохранить" : "Создать"}
                            </SmallButton>
                        </div>
                    }
                >
                    <div className="space-y-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-1">
                                <label className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                                    Название шаблона
                                </label>
                                <Input
                                    value={templateName}
                                    onChange={setTemplateName}
                                    placeholder="Напр. Этикетка короба EAN13"
                                />
                            </div>
                            <div className="grid gap-1">
                                <label className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                                    Тип штрихкода
                                </label>
                                <Select
                                    value={barcodeType}
                                    onChange={setBarcodeType}
                                    options={BARCODE_TYPES}
                                />
                            </div>
                        </div>

                        <hr className="border-white/10" />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-white">Поля структуры</h4>
                                <SmallButton variant="secondary" onClick={addField}>
                                    + Добавить поле
                                </SmallButton>
                            </div>

                            <div className="space-y-3">
                                {fields.map((field, idx) => (
                                    <div
                                        key={idx}
                                        className="group relative flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
                                    >
                                        <div className="flex-1 space-y-3">
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <Select
                                                    value={field.field_type}
                                                    onChange={(v) => updateField(idx, { field_type: v })}
                                                    options={FIELD_TYPES}
                                                />

                                                {/* Dynamic Settings Based on f_type */}
                                                {field.field_type === "constanta" && (
                                                    <Input
                                                        value={field.value || ""}
                                                        onChange={(v) => updateField(idx, { value: v })}
                                                        placeholder="Значение..."
                                                    />
                                                )}

                                                {field.field_type === "ai" && (
                                                    <Select
                                                        value={field.value || ""}
                                                        onChange={(v) => updateField(idx, { value: v })}
                                                        options={AI_OPTIONS}
                                                    />
                                                )}

                                                {[
                                                    "weight_netto_pack", "weight_brutto_pack",
                                                    "weight_netto_box", "weight_brutto_box",
                                                    "weight_netto_pallet", "weight_brutto_pallet", "weight_brutto_all"
                                                ].includes(field.field_type) && (
                                                        <div className="flex gap-2">
                                                            <Input
                                                                className="w-20"
                                                                placeholder="Длина"
                                                                value={field.length || ""}
                                                                onChange={(v) => updateField(idx, { length: v })}
                                                            />
                                                            <Input
                                                                placeholder="Точек"
                                                                value={field.decimalPlaces || ""}
                                                                onChange={(v) => updateField(idx, { decimalPlaces: v })}
                                                            />
                                                        </div>
                                                    )}

                                                {["production_date", "exp_date"].includes(field.field_type) && (
                                                    <div className="flex gap-2">
                                                        <Input
                                                            className="w-20"
                                                            placeholder="Длина"
                                                            value={field.length || ""}
                                                            onChange={(v) => updateField(idx, { length: v })}
                                                        />
                                                        <Select
                                                            className="flex-1"
                                                            value={field.dateFormat || "ddMMyy"}
                                                            onChange={(v) => updateField(idx, { dateFormat: v })}
                                                            options={DATE_FORMATS}
                                                        />
                                                    </div>
                                                )}

                                                {[
                                                    "pack_number", "box_number", "pallet_number",
                                                    "article", "pack_count", "box_count", "batch_number"
                                                ].includes(field.field_type) && (
                                                        <Input
                                                            placeholder="Длина поля..."
                                                            value={field.length || ""}
                                                            onChange={(v) => updateField(idx, { length: v })}
                                                        />
                                                    )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => removeField(idx)}
                                            className="mt-2 text-white/30 transition-colors hover:text-rose-400"
                                            title="Удалить поле"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-center pt-4">
                            <SmallButton
                                variant="primary"
                                className="w-full max-w-xs"
                                disabled={isPreviewLoading}
                                onClick={handlePreview}
                            >
                                {isPreviewLoading ? "Генерация..." : "Проверить структуру"}
                            </SmallButton>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Right Column: List & Preview */}
            <div className="md:col-span-5 space-y-6">
                {/* Preview Card */}
                <Card title="Предпросмотр">
                    <div className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/40 p-4">
                        {previewPng ? (
                            <img
                                src={`data:image/png;base64,${previewPng}`}
                                alt="Barcode Preview"
                                className="max-h-32 object-contain filter invert"
                            />
                        ) : (
                            <div className="text-center text-sm text-white/40">
                                Настройте поля и нажмите <br />
                                <span className="text-white/60">"Проверить структуру"</span>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Templates List */}
                <Card
                    title="Шаблоны"
                    subtitle={isLoading ? "Загрузка..." : `Всего: ${templates.length}`}
                >
                    <div className="space-y-2">
                        {templates.length === 0 && !isLoading && (
                            <p className="py-4 text-center text-sm text-white/40">
                                Нет сохраненных шаблонов
                            </p>
                        )}
                        {templates.map((t) => (
                            <div
                                key={t.id}
                                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 hover:bg-white/10"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium text-white">{t.name}</div>
                                    <div className="text-[10px] uppercase text-white/40">{t.structure.barcode_type}</div>
                                </div>
                                <div className="flex gap-1 shrink-0 ml-4">
                                    <SmallButton onClick={() => handleEdit(t)} title="Изм.">
                                        Изм.
                                    </SmallButton>
                                    <SmallButton
                                        variant="danger"
                                        onClick={() => handleDelete(t.id)}
                                        title="Удал."
                                    >
                                        Удал.
                                    </SmallButton>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
