"use client";

import * as React from "react";
import { useEffect, useState } from "react";
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
    invalid,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: "text" | "number";
    className?: string;
    invalid?: boolean;
}) {
    return (
        <input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            className={cx(
                "h-10 w-full rounded-xl border bg-white/5 px-3 text-sm text-white placeholder:text-white/35 outline-none focus:bg-white/10",
                invalid
                    ? "border-rose-500/60 focus:border-rose-400"
                    : "border-white/10 focus:border-white/20",
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
    invalid,
}: {
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
    className?: string;
    invalid?: boolean;
}) {
    return (
        <select
            value={value}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
            className={cx(
                "h-10 w-full rounded-xl border bg-white/5 px-3 text-sm text-white outline-none focus:bg-white/10",
                invalid
                    ? "border-rose-500/60 focus:border-rose-400"
                    : "border-white/10 focus:border-white/20",
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

// Shared contract sets
const ALLOWED_BARCODE_TYPES = ["ean13", "code128", "qrcode", "databarexpandedstacked", "gs1qrcode"];
const GS1_TYPES = ["databarexpandedstacked", "gs1qrcode"];
const GS1_ONLY_FIELDS = ["ai", "fnc1", "gs"];

const ALLOWED_FIELD_TYPES = [
    "constanta", "weight_netto_pack", "weight_brutto_pack", "weight_netto_box", "weight_brutto_box",
    "weight_netto_pallet", "weight_brutto_pallet", "weight_brutto_all", "production_date", "exp_date",
    "pack_number", "box_number", "pallet_number", "article", "pack_count", "box_count", "batch_number",
    "fnc1", "gs", "ai", "extra_data",
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
    { value: "extra_data", label: "Глобальный атрибут (Доп. поле)" },
];

// One-line help per field type
const FIELD_HELP: Record<string, string> = {
    constanta: "Фиксированный текст. Для EAN13 значение должно быть только из цифр.",
    weight_netto_pack: "Вес нетто упаковки из товара (граммы → кг). Длина/Точек форматируют число.",
    weight_brutto_pack: "Вес брутто упаковки из товара (граммы → кг). Длина/Точек форматируют число.",
    weight_netto_box: "Вес нетто короба из товара (граммы → кг). Длина/Точек форматируют число.",
    weight_brutto_box: "Вес брутто короба из товара (граммы → кг). Длина/Точек форматируют число.",
    weight_netto_pallet: "Вес нетто паллета из товара (граммы → кг). Длина/Точек форматируют число.",
    weight_brutto_pallet: "Вес брутто паллета из товара (граммы → кг). Длина/Точек форматируют число.",
    weight_brutto_all: "Общий вес брутто паллета с поддоном. Длина/Точек форматируют число.",
    production_date: "Дата производства (сегодня). Формат задаётся ниже.",
    exp_date: "Срок годности (сегодня + срок из товара). Формат задаётся ниже.",
    pack_number: "Номер упаковки. В предпросмотре используются образцовые данные.",
    box_number: "Номер короба. В предпросмотре используются образцовые данные.",
    pallet_number: "Номер паллеты. В предпросмотре используются образцовые данные.",
    article: "Артикул товара. Берётся из выбранного товара.",
    pack_count: "Количество вложений в коробе. Берётся из товара.",
    box_count: "Количество коробов на паллете. В предпросмотре — образец.",
    batch_number: "Номер партии. В предпросмотре используются образцовые данные.",
    fnc1: "Разделитель FNC1 (только GS1). Для GS1 вставляется автоматически.",
    gs: "Group Separator ASCII 29 (только GS1).",
    ai: "Идентификатор применения GS1 (только GS1). Выберите AI из списка.",
    extra_data: "Глобальный атрибут товара (доп. поле) по имени атрибута.",
};

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

const AI_SET = AI_OPTIONS.map((o) => o.value);

const WEIGHT_FIELDS = [
    "weight_netto_pack", "weight_brutto_pack",
    "weight_netto_box", "weight_brutto_box",
    "weight_netto_pallet", "weight_brutto_pallet", "weight_brutto_all",
];

const DATE_FIELDS = ["production_date", "exp_date"];

const LENGTH_FIELDS = [
    "pack_number", "box_number", "pallet_number",
    "article", "pack_count", "box_count", "batch_number",
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

// --- Validation (mirrors backend validate_structure) ---

const isAllDigits = (s: string) => /^\d+$/.test(s);

export type ValidationResult = {
    errors: string[];                 // general / banner errors
    fieldErrors: Record<number, string>; // per-field-index errors
    nameError?: string;
};

function validateStructure(
    barcodeType: string,
    fields: BarcodeField[],
    templateName: string,
    templates: BarcodeTemplate[],
    editingId: string | null
): ValidationResult {
    const errors: string[] = [];
    const fieldErrors: Record<number, string> = {};
    let nameError: string | undefined;

    const trimmedName = templateName.trim();
    if (!trimmedName) {
        nameError = "Введите название шаблона.";
    } else {
        const dup = templates.find(
            (t) => t.name.trim().toLowerCase() === trimmedName.toLowerCase() && t.id !== editingId
        );
        if (dup) {
            nameError = "Шаблон с таким названием уже существует.";
        }
    }

    if (!ALLOWED_BARCODE_TYPES.includes(barcodeType)) {
        errors.push(`Недопустимый тип штрихкода: ${barcodeType}.`);
    }

    const isGs1 = GS1_TYPES.includes(barcodeType);

    if (!fields || fields.length === 0) {
        errors.push("Список полей не может быть пустым.");
    }

    fields.forEach((field, idx) => {
        const ft = field.field_type;

        if (!ALLOWED_FIELD_TYPES.includes(ft)) {
            fieldErrors[idx] = `Недопустимый тип поля: ${ft}.`;
            return;
        }

        // GS1-only fields
        if (GS1_ONLY_FIELDS.includes(ft) && !isGs1) {
            fieldErrors[idx] = "Поле ai/fnc1/gs допустимо только для GS1-типов штрихкода.";
            return;
        }

        if (ft === "constanta") {
            if (!field.value || !field.value.trim()) {
                fieldErrors[idx] = "Константа должна иметь непустое значение.";
                return;
            }
            if (barcodeType === "ean13" && !isAllDigits(field.value.trim())) {
                fieldErrors[idx] = "Для EAN13 значение константы должно состоять только из цифр.";
                return;
            }
        }

        if (ft === "ai") {
            if (!field.value || !AI_SET.includes(field.value)) {
                fieldErrors[idx] = "Выберите корректный идентификатор AI.";
                return;
            }
        }

        // length / decimalPlaces must be all-digits when present
        if (field.length !== undefined && field.length !== "" && !isAllDigits(field.length)) {
            fieldErrors[idx] = "Длина должна состоять только из цифр.";
            return;
        }
        if (field.decimalPlaces !== undefined && field.decimalPlaces !== "" && !isAllDigits(field.decimalPlaces)) {
            fieldErrors[idx] = "Количество знаков после запятой должно состоять только из цифр.";
            return;
        }

        // EAN13: only digit-producing fields (no ai/fnc1/gs already covered)
        if (barcodeType === "ean13" && GS1_ONLY_FIELDS.includes(ft)) {
            fieldErrors[idx] = "Поля ai/fnc1/gs недопустимы для EAN13.";
            return;
        }
    });

    return { errors, fieldErrors, nameError };
}

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
    const [attributes, setAttributes] = useState<{ id: number; name: string }[]>([]);

    // Product selection for preview
    const [products, setProducts] = useState<any[]>([]);
    const [previewProductId, setPreviewProductId] = useState<string>("");

    // Preview State
    const [previewPng, setPreviewPng] = useState<string | null>(null);
    const [previewDataString, setPreviewDataString] = useState<string | null>(null);
    const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    // Validation / messaging State
    const [bannerErrors, setBannerErrors] = useState<string[]>([]);
    const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});
    const [nameError, setNameError] = useState<string | undefined>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const data = await api.barcodes.list();
            const items = Array.isArray(data) ? data : data.results || [];

            const mapped: BarcodeTemplate[] = [];
            for (const item of items) {
                let structure: any = item.structure;
                // Defensive: legacy rows may have stored structure as a JSON string.
                if (typeof structure === "string") {
                    try {
                        structure = JSON.parse(structure);
                    } catch {
                        // Unparseable legacy row — skip it rather than throwing.
                        continue;
                    }
                }
                if (!structure || typeof structure !== "object") continue;
                mapped.push({
                    id: item.id.toString(),
                    name: item.name,
                    structure,
                });
            }
            setTemplates(mapped);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAttributes = async () => {
        try {
            const data = await api.attributes.list();
            const items = Array.isArray(data) ? data : data.results || [];
            setAttributes(items);
        } catch (e) {
            console.error("Failed to load attributes", e);
        }
    };

    const fetchProducts = async () => {
        try {
            const data = await api.nomenclature.list();
            const items = Array.isArray(data) ? data : data.results || [];
            setProducts(items);
        } catch (e) {
            console.error("Failed to load products", e);
        }
    };

    useEffect(() => {
        fetchTemplates();
        fetchAttributes();
        fetchProducts();
    }, []);

    // Field-type options gated by selected barcode_type:
    // hide ai/fnc1/gs unless the barcode is a GS1 type.
    const isGs1 = GS1_TYPES.includes(barcodeType);
    const fieldTypeOptions = isGs1
        ? FIELD_TYPES
        : FIELD_TYPES.filter((o) => !GS1_ONLY_FIELDS.includes(o.value));

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

    const clearMessages = () => {
        setBannerErrors([]);
        setFieldErrors({});
        setNameError(undefined);
    };

    const resetForm = () => {
        setTemplateName("");
        setBarcodeType("ean13");
        setFields([{ field_type: "constanta", value: "460" }]);
        setEditingId(null);
        setPreviewPng(null);
        setPreviewDataString(null);
        setPreviewWarnings([]);
        clearMessages();
    };

    const handleEdit = (t: BarcodeTemplate) => {
        setEditingId(t.id);
        setTemplateName(t.name);
        setBarcodeType(t.structure.barcode_type);
        setFields(t.structure.fields || []);
        setPreviewPng(null);
        setPreviewDataString(null);
        setPreviewWarnings([]);
        clearMessages();
    };

    // Run validation, push results into state, return whether it's valid.
    const runValidation = (): boolean => {
        const result = validateStructure(barcodeType, fields, templateName, templates, editingId);
        setBannerErrors(result.errors);
        setFieldErrors(result.fieldErrors);
        setNameError(result.nameError);
        return (
            result.errors.length === 0 &&
            Object.keys(result.fieldErrors).length === 0 &&
            !result.nameError
        );
    };

    const handlePreview = async () => {
        if (!runValidation()) return;

        setIsPreviewLoading(true);
        setPreviewWarnings([]);
        try {
            const structure = {
                barcode_type: barcodeType,
                barcode_name: templateName,
                fields,
            };
            const payload: any = { barcode_structure: structure };
            if (previewProductId) {
                payload.product_id = previewProductId;
            }

            const res = await api.barcodes.generate(payload);

            // New response shape: { success, png, data_string, warnings }
            if (Array.isArray(res.errors) && res.errors.length) {
                setBannerErrors(res.errors);
                setPreviewPng(null);
                setPreviewDataString(null);
                setPreviewWarnings([]);
                return;
            }

            setPreviewPng(res.png || null);
            setPreviewDataString(res.data_string ?? null);
            setPreviewWarnings(Array.isArray(res.warnings) ? res.warnings : []);
        } catch (e: any) {
            setBannerErrors([`Ошибка предпросмотра: ${e.message}`]);
            setPreviewPng(null);
            setPreviewDataString(null);
            setPreviewWarnings([]);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleSave = async () => {
        if (!runValidation()) return;

        const structure = {
            barcode_type: barcodeType,
            barcode_name: templateName,
            fields,
        };

        // Send structure as a RAW OBJECT (no JSON.stringify) so DRF JSONField
        // stores a real dict.
        const payload = {
            name: templateName,
            structure,
        };

        try {
            if (editingId) {
                await api.barcodes.update(editingId, payload);
            } else {
                await api.barcodes.create(payload);
            }
            await fetchTemplates();
            resetForm();
        } catch (e: any) {
            console.error(e);
            setBannerErrors([e?.message || "Ошибка сохранения"]);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.barcodes.delete(id);
            setConfirmDeleteId(null);
            await fetchTemplates();
        } catch (e: any) {
            console.error(e);
            setBannerErrors([e?.message || "Ошибка удаления"]);
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
                        {/* Inline banner errors */}
                        {bannerErrors.length > 0 && (
                            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                                <ul className="list-disc space-y-1 pl-5">
                                    {bannerErrors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-1">
                                <label className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                                    Название шаблона
                                </label>
                                <Input
                                    value={templateName}
                                    onChange={(v) => {
                                        setTemplateName(v);
                                        if (nameError) setNameError(undefined);
                                    }}
                                    placeholder="Напр. Этикетка короба EAN13"
                                    invalid={!!nameError}
                                />
                                {nameError && (
                                    <p className="text-[11px] text-rose-300">{nameError}</p>
                                )}
                            </div>
                            <div className="grid gap-1">
                                <label className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                                    Тип штрихкода
                                </label>
                                <Select
                                    value={barcodeType}
                                    onChange={(v) => {
                                        setBarcodeType(v);
                                        setFieldErrors({});
                                        setBannerErrors([]);
                                    }}
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
                                {fields.map((field, idx) => {
                                    const fErr = fieldErrors[idx];
                                    return (
                                        <div
                                            key={idx}
                                            className={cx(
                                                "group relative flex items-start gap-3 rounded-xl border bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]",
                                                fErr
                                                    ? "border-rose-500/50"
                                                    : "border-white/5 hover:border-white/10"
                                            )}
                                        >
                                            <div className="flex-1 space-y-2">
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <Select
                                                        value={field.field_type}
                                                        onChange={(v) => updateField(idx, { field_type: v })}
                                                        options={fieldTypeOptions}
                                                        invalid={!!fErr}
                                                    />

                                                    {/* Dynamic Settings Based on field_type */}
                                                    {field.field_type === "constanta" && (
                                                        <Input
                                                            value={field.value || ""}
                                                            onChange={(v) => updateField(idx, { value: v })}
                                                            placeholder="Значение..."
                                                            invalid={!!fErr}
                                                        />
                                                    )}

                                                    {field.field_type === "ai" && (
                                                        <Select
                                                            value={field.value || ""}
                                                            onChange={(v) => updateField(idx, { value: v })}
                                                            options={AI_OPTIONS}
                                                            invalid={!!fErr}
                                                        />
                                                    )}

                                                    {field.field_type === "extra_data" && (
                                                        <div className="flex flex-col gap-2">
                                                            <Select
                                                                value={field.value || ""}
                                                                onChange={(v) => updateField(idx, { value: v })}
                                                                options={[
                                                                    { value: "", label: "— Выберите атрибут —" },
                                                                    ...attributes.map((attr) => ({
                                                                        value: attr.name,
                                                                        label: attr.name,
                                                                    })),
                                                                ]}
                                                            />
                                                            <Input
                                                                placeholder="Длина (значение по умолч.)"
                                                                value={field.length || ""}
                                                                onChange={(v) => updateField(idx, { length: v })}
                                                                invalid={!!fErr}
                                                            />
                                                        </div>
                                                    )}

                                                    {WEIGHT_FIELDS.includes(field.field_type) && (
                                                        <div className="flex gap-2">
                                                            <Input
                                                                className="w-20"
                                                                placeholder="Длина"
                                                                value={field.length || ""}
                                                                onChange={(v) => updateField(idx, { length: v })}
                                                                invalid={!!fErr}
                                                            />
                                                            <Input
                                                                placeholder="Точек"
                                                                value={field.decimalPlaces || ""}
                                                                onChange={(v) => updateField(idx, { decimalPlaces: v })}
                                                                invalid={!!fErr}
                                                            />
                                                        </div>
                                                    )}

                                                    {DATE_FIELDS.includes(field.field_type) && (
                                                        <div className="flex gap-2">
                                                            <Input
                                                                className="w-20"
                                                                placeholder="Длина"
                                                                value={field.length || ""}
                                                                onChange={(v) => updateField(idx, { length: v })}
                                                                invalid={!!fErr}
                                                            />
                                                            <Select
                                                                className="flex-1"
                                                                value={field.dateFormat || "ddMMyy"}
                                                                onChange={(v) => updateField(idx, { dateFormat: v })}
                                                                options={DATE_FORMATS}
                                                            />
                                                        </div>
                                                    )}

                                                    {LENGTH_FIELDS.includes(field.field_type) && (
                                                        <Input
                                                            placeholder="Длина поля..."
                                                            value={field.length || ""}
                                                            onChange={(v) => updateField(idx, { length: v })}
                                                            invalid={!!fErr}
                                                        />
                                                    )}
                                                </div>

                                                {/* One-line help text under each field type */}
                                                {FIELD_HELP[field.field_type] && (
                                                    <p className="text-[11px] text-white/40">
                                                        {FIELD_HELP[field.field_type]}
                                                    </p>
                                                )}

                                                {/* Inline per-field error */}
                                                {fErr && (
                                                    <p className="text-[11px] text-rose-300">{fErr}</p>
                                                )}
                                            </div>

                                            <button
                                                type="button"
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
                                    );
                                })}
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
                <Card
                    title="Предпросмотр"
                    subtitle="Выберите товар для теста динамических полей"
                >
                    <div className="mb-4">
                        <Select
                            value={previewProductId}
                            onChange={(v) => setPreviewProductId(v)}
                            options={[
                                { value: "", label: "— Без товара (фиктивные данные) —" },
                                ...products.map((p) => ({
                                    value: p.id.toString(),
                                    label: `${p.article} — ${p.name}`,
                                })),
                            ]}
                        />
                    </div>

                    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white p-4">
                        {previewPng ? (
                            <img
                                src={`data:image/png;base64,${previewPng}`}
                                alt="Barcode Preview"
                                className="max-w-full max-h-[180px] object-contain"
                            />
                        ) : (
                            <div className="text-center text-sm text-black/40">
                                Настройте поля и нажмите <br />
                                <span className="text-black/60">"Проверить структуру"</span>
                            </div>
                        )}
                    </div>

                    {/* Assembled data string */}
                    {previewDataString !== null && (
                        <div className="mt-4 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                                    Данные штрихкода
                                </span>
                                <span className="text-[11px] text-white/40">
                                    длина: {previewDataString.length}
                                </span>
                            </div>
                            <div className="break-all rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-white/85">
                                {previewDataString || <span className="text-white/40">(пусто)</span>}
                            </div>
                        </div>
                    )}

                    {/* Warnings */}
                    {previewWarnings.length > 0 && (
                        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
                            <ul className="list-disc space-y-1 pl-5">
                                {previewWarnings.map((w, i) => (
                                    <li key={i}>{w}</li>
                                ))}
                            </ul>
                        </div>
                    )}
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
                                className="rounded-xl border border-white/5 bg-white/5 p-3 hover:bg-white/10"
                            >
                                <div className="flex items-center justify-between">
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
                                            onClick={() => setConfirmDeleteId(t.id)}
                                            title="Удал."
                                        >
                                            Удал.
                                        </SmallButton>
                                    </div>
                                </div>

                                {/* Inline delete confirmation (replaces confirm()) */}
                                {confirmDeleteId === t.id && (
                                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-2">
                                        <span className="text-xs text-rose-100">Удалить этот шаблон?</span>
                                        <div className="flex gap-1 shrink-0">
                                            <SmallButton onClick={() => setConfirmDeleteId(null)}>
                                                Отмена
                                            </SmallButton>
                                            <SmallButton variant="danger" onClick={() => handleDelete(t.id)}>
                                                Удалить
                                            </SmallButton>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
