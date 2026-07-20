"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n";
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

type TFn = (key: string, params?: Record<string, string | number>) => string;

const buildFieldTypes = (t: TFn) => [
    { value: "constanta", label: t("barcodes.fieldConstanta") },
    { value: "weight_netto_pack", label: t("barcodes.fieldWeightNettoPack") },
    { value: "weight_brutto_pack", label: t("barcodes.fieldWeightBruttoPack") },
    { value: "weight_netto_box", label: t("barcodes.fieldWeightNettoBox") },
    { value: "weight_brutto_box", label: t("barcodes.fieldWeightBruttoBox") },
    { value: "weight_netto_pallet", label: t("barcodes.fieldWeightNettoPallet") },
    { value: "weight_brutto_pallet", label: t("barcodes.fieldWeightBruttoPallet") },
    { value: "weight_brutto_all", label: t("barcodes.fieldWeightBruttoAll") },
    { value: "production_date", label: t("barcodes.fieldProductionDate") },
    { value: "exp_date", label: t("barcodes.fieldExpDate") },
    { value: "pack_number", label: t("barcodes.fieldPackNumber") },
    { value: "box_number", label: t("barcodes.fieldBoxNumber") },
    { value: "pallet_number", label: t("barcodes.fieldPalletNumber") },
    { value: "article", label: t("barcodes.fieldArticle") },
    { value: "pack_count", label: t("barcodes.fieldPackCount") },
    { value: "box_count", label: t("barcodes.fieldBoxCount") },
    { value: "batch_number", label: t("barcodes.fieldBatchNumber") },
    { value: "fnc1", label: t("barcodes.fieldFnc1") },
    { value: "gs", label: t("barcodes.fieldGs") },
    { value: "ai", label: t("barcodes.fieldAi") },
    { value: "extra_data", label: t("barcodes.fieldExtraData") },
];

// One-line help per field type
const buildFieldHelp = (t: TFn): Record<string, string> => ({
    constanta: t("barcodes.helpConstanta"),
    weight_netto_pack: t("barcodes.helpWeightNettoPack"),
    weight_brutto_pack: t("barcodes.helpWeightBruttoPack"),
    weight_netto_box: t("barcodes.helpWeightNettoBox"),
    weight_brutto_box: t("barcodes.helpWeightBruttoBox"),
    weight_netto_pallet: t("barcodes.helpWeightNettoPallet"),
    weight_brutto_pallet: t("barcodes.helpWeightBruttoPallet"),
    weight_brutto_all: t("barcodes.helpWeightBruttoAll"),
    production_date: t("barcodes.helpProductionDate"),
    exp_date: t("barcodes.helpExpDate"),
    pack_number: t("barcodes.helpPackNumber"),
    box_number: t("barcodes.helpBoxNumber"),
    pallet_number: t("barcodes.helpPalletNumber"),
    article: t("barcodes.helpArticle"),
    pack_count: t("barcodes.helpPackCount"),
    box_count: t("barcodes.helpBoxCount"),
    batch_number: t("barcodes.helpBatchNumber"),
    fnc1: t("barcodes.helpFnc1"),
    gs: t("barcodes.helpGs"),
    ai: t("barcodes.helpAi"),
    extra_data: t("barcodes.helpExtraData"),
});

const DATE_FORMATS = [
    { value: "ddMMyy", label: "ddMMyy" },
    { value: "ddMMyyyy", label: "ddMMyyyy" },
    { value: "yyMMdd", label: "yyMMdd" },
    { value: "yyyyMMdd", label: "yyyyMMdd" },
];

const buildAiOptions = (t: TFn) => [
    { value: "00", label: t("barcodes.ai00") },
    { value: "01", label: t("barcodes.ai01") },
    { value: "02", label: t("barcodes.ai02") },
    { value: "10", label: t("barcodes.ai10") },
    { value: "11", label: t("barcodes.ai11") },
    { value: "17", label: t("barcodes.ai17") },
    { value: "21", label: t("barcodes.ai21") },
    { value: "3103", label: t("barcodes.ai3103") },
];

const AI_SET = ["00", "01", "02", "10", "11", "17", "21", "3103"];

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
    editingId: string | null,
    t: TFn
): ValidationResult {
    const errors: string[] = [];
    const fieldErrors: Record<number, string> = {};
    let nameError: string | undefined;

    const trimmedName = templateName.trim();
    if (!trimmedName) {
        nameError = t("barcodes.errNameRequired");
    } else {
        const dup = templates.find(
            (tpl) => tpl.name.trim().toLowerCase() === trimmedName.toLowerCase() && tpl.id !== editingId
        );
        if (dup) {
            nameError = t("barcodes.errNameDuplicate");
        }
    }

    if (!ALLOWED_BARCODE_TYPES.includes(barcodeType)) {
        errors.push(t("barcodes.errInvalidBarcodeType", { type: barcodeType }));
    }

    const isGs1 = GS1_TYPES.includes(barcodeType);

    if (!fields || fields.length === 0) {
        errors.push(t("barcodes.errFieldsEmpty"));
    }

    fields.forEach((field, idx) => {
        const ft = field.field_type;

        if (!ALLOWED_FIELD_TYPES.includes(ft)) {
            fieldErrors[idx] = t("barcodes.errInvalidFieldType", { type: ft });
            return;
        }

        // GS1-only fields
        if (GS1_ONLY_FIELDS.includes(ft) && !isGs1) {
            fieldErrors[idx] = t("barcodes.errGs1Only");
            return;
        }

        if (ft === "constanta") {
            if (!field.value || !field.value.trim()) {
                fieldErrors[idx] = t("barcodes.errConstantaEmpty");
                return;
            }
            if (barcodeType === "ean13" && !isAllDigits(field.value.trim())) {
                fieldErrors[idx] = t("barcodes.errEan13ConstantaDigits");
                return;
            }
        }

        if (ft === "ai") {
            if (!field.value || !AI_SET.includes(field.value)) {
                fieldErrors[idx] = t("barcodes.errAiInvalid");
                return;
            }
        }

        // length / decimalPlaces must be all-digits when present
        if (field.length !== undefined && field.length !== "" && !isAllDigits(field.length)) {
            fieldErrors[idx] = t("barcodes.errLengthDigits");
            return;
        }
        if (field.decimalPlaces !== undefined && field.decimalPlaces !== "" && !isAllDigits(field.decimalPlaces)) {
            fieldErrors[idx] = t("barcodes.errDecimalDigits");
            return;
        }

        // EAN13: only digit-producing fields (no ai/fnc1/gs already covered)
        if (barcodeType === "ean13" && GS1_ONLY_FIELDS.includes(ft)) {
            fieldErrors[idx] = t("barcodes.errEan13NoGs1");
            return;
        }
    });

    return { errors, fieldErrors, nameError };
}

// --- Main Component ---

export default function BarcodeTemplatesManager() {
    const { t } = useTranslation();
    const FIELD_TYPES = buildFieldTypes(t);
    const FIELD_HELP = buildFieldHelp(t);
    const AI_OPTIONS = buildAiOptions(t);

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

    const handleEdit = (tpl: BarcodeTemplate) => {
        setEditingId(tpl.id);
        setTemplateName(tpl.name);
        setBarcodeType(tpl.structure.barcode_type);
        setFields(tpl.structure.fields || []);
        setPreviewPng(null);
        setPreviewDataString(null);
        setPreviewWarnings([]);
        clearMessages();
    };

    // Run validation, push results into state, return whether it's valid.
    const runValidation = (): boolean => {
        const result = validateStructure(barcodeType, fields, templateName, templates, editingId, t);
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
            setBannerErrors([t("barcodes.errPreview", { msg: e.message })]);
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
            setBannerErrors([e?.message || t("barcodes.errSave")]);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.barcodes.delete(id);
            setConfirmDeleteId(null);
            await fetchTemplates();
        } catch (e: any) {
            console.error(e);
            setBannerErrors([e?.message || t("barcodes.errDelete")]);
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-12">
            {/* Left Column: Designer */}
            <div className="md:col-span-7">
                <Card
                    title={editingId ? t("barcodes.editTemplate") : t("barcodes.newTemplate")}
                    subtitle={t("barcodes.designerSubtitle")}
                    right={
                        <div className="flex gap-2">
                            {editingId && (
                                <SmallButton onClick={resetForm}>{t("barcodes.cancel")}</SmallButton>
                            )}
                            <SmallButton variant="primary" onClick={handleSave}>
                                {editingId ? t("barcodes.save") : t("barcodes.create")}
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
                                    {t("barcodes.templateNameLabel")}
                                </label>
                                <Input
                                    value={templateName}
                                    onChange={(v) => {
                                        setTemplateName(v);
                                        if (nameError) setNameError(undefined);
                                    }}
                                    placeholder={t("barcodes.templateNamePlaceholder")}
                                    invalid={!!nameError}
                                />
                                {nameError && (
                                    <p className="text-[11px] text-rose-300">{nameError}</p>
                                )}
                            </div>
                            <div className="grid gap-1">
                                <label className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                                    {t("barcodes.barcodeTypeLabel")}
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
                                <h4 className="text-sm font-medium text-white">{t("barcodes.structureFields")}</h4>
                                <SmallButton variant="secondary" onClick={addField}>
                                    {t("barcodes.addField")}
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
                                                            placeholder={t("barcodes.valuePlaceholder")}
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
                                                                    { value: "", label: t("barcodes.selectAttribute") },
                                                                    ...attributes.map((attr) => ({
                                                                        value: attr.name,
                                                                        label: attr.name,
                                                                    })),
                                                                ]}
                                                            />
                                                            <Input
                                                                placeholder={t("barcodes.lengthDefaultPlaceholder")}
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
                                                                placeholder={t("barcodes.lengthPlaceholder")}
                                                                value={field.length || ""}
                                                                onChange={(v) => updateField(idx, { length: v })}
                                                                invalid={!!fErr}
                                                            />
                                                            <Input
                                                                placeholder={t("barcodes.decimalPlaceholder")}
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
                                                                placeholder={t("barcodes.lengthPlaceholder")}
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
                                                            placeholder={t("barcodes.fieldLengthPlaceholder")}
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
                                                title={t("barcodes.removeFieldTitle")}
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
                                {isPreviewLoading ? t("barcodes.generating") : t("barcodes.checkStructure")}
                            </SmallButton>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Right Column: List & Preview */}
            <div className="md:col-span-5 space-y-6">
                {/* Preview Card */}
                <Card
                    title={t("barcodes.previewTitle")}
                    subtitle={t("barcodes.previewSubtitle")}
                >
                    <div className="mb-4">
                        <Select
                            value={previewProductId}
                            onChange={(v) => setPreviewProductId(v)}
                            options={[
                                { value: "", label: t("barcodes.noProduct") },
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
                                {t("barcodes.previewHint")} <br />
                                <span className="text-black/60">"{t("barcodes.checkStructure")}"</span>
                            </div>
                        )}
                    </div>

                    {/* Assembled data string */}
                    {previewDataString !== null && (
                        <div className="mt-4 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                                    {t("barcodes.dataLabel")}
                                </span>
                                <span className="text-[11px] text-white/40">
                                    {t("barcodes.dataLength", { len: previewDataString.length })}
                                </span>
                            </div>
                            <div className="break-all rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-white/85">
                                {previewDataString || <span className="text-white/40">{t("barcodes.empty")}</span>}
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
                    title={t("barcodes.templatesTitle")}
                    subtitle={isLoading ? t("barcodes.loading") : t("barcodes.total", { count: templates.length })}
                >
                    <div className="space-y-2">
                        {templates.length === 0 && !isLoading && (
                            <p className="py-4 text-center text-sm text-white/40">
                                {t("barcodes.noTemplates")}
                            </p>
                        )}
                        {templates.map((tpl) => (
                            <div
                                key={tpl.id}
                                className="rounded-xl border border-white/5 bg-white/5 p-3 hover:bg-white/10"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium text-white">{tpl.name}</div>
                                        <div className="text-[10px] uppercase text-white/40">{tpl.structure.barcode_type}</div>
                                    </div>
                                    <div className="flex gap-1 shrink-0 ml-4">
                                        <SmallButton onClick={() => handleEdit(tpl)} title={t("barcodes.editShort")}>
                                            {t("barcodes.editShort")}
                                        </SmallButton>
                                        <SmallButton
                                            variant="danger"
                                            onClick={() => setConfirmDeleteId(tpl.id)}
                                            title={t("barcodes.deleteShort")}
                                        >
                                            {t("barcodes.deleteShort")}
                                        </SmallButton>
                                    </div>
                                </div>

                                {/* Inline delete confirmation (replaces confirm()) */}
                                {confirmDeleteId === tpl.id && (
                                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-2">
                                        <span className="text-xs text-rose-100">{t("barcodes.deleteConfirm")}</span>
                                        <div className="flex gap-1 shrink-0">
                                            <SmallButton onClick={() => setConfirmDeleteId(null)}>
                                                {t("barcodes.cancel")}
                                            </SmallButton>
                                            <SmallButton variant="danger" onClick={() => handleDelete(tpl.id)}>
                                                {t("barcodes.delete")}
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
