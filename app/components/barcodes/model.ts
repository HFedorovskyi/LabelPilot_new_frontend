// What a barcode template is made of and the rules it must follow. Lengths and defaults
// follow the station's generator (client src-tauri/src/barcode.rs), which the server's
// preview mirrors: numbers are padded with zeros and never cut, an empty length means
// "as is", an article of 14 digits becomes a GTIN-14, a date's length is its format.

export type BarcodeField = {
    field_type: string;
    value?: string;
    length?: string;
    decimalPlaces?: string;
    dateFormat?: string;
};

export type BarcodeStructure = { barcode_type: string; barcode_name?: string; fields: BarcodeField[] };
export type BarcodeTemplate = { id: number; name: string; structure: BarcodeStructure };

export type T = (key: string, params?: Record<string, string | number | undefined>) => string;

export const SYMBOLOGIES = ["ean13", "code128", "databarexpandedstacked", "gs1qrcode", "qrcode"] as const;
export type Symbology = (typeof SYMBOLOGIES)[number];
export const SYMBOLOGY_LABEL: Record<string, string> = {
    ean13: "EAN-13",
    code128: "Code 128",
    databarexpandedstacked: "GS1 DataBar",
    gs1qrcode: "GS1 QR",
    qrcode: "QR",
};
export const isGs1 = (type: string) => type === "databarexpandedstacked" || type === "gs1qrcode";
export const is2D = (type: string) => type === "qrcode" || type === "gs1qrcode";

export const WEIGHT_KINDS = [
    "weight_netto_pack", "weight_brutto_pack", "weight_netto_box", "weight_brutto_box",
    "weight_netto_pallet", "weight_brutto_pallet", "weight_brutto_all",
];
export const DATE_KINDS = ["production_date", "exp_date"];
const RUNTIME_KINDS = ["pack_number", "box_number", "pallet_number", "box_count", "batch_number"];
export const GS1_ONLY = ["ai", "fnc1", "gs"];

/** Groups of the "add a part" menu. */
export const KIND_GROUPS: Array<[string, string[]]> = [
    ["product", ["article", "extra_data"]],
    ["weight", WEIGHT_KINDS],
    ["dates", DATE_KINDS],
    ["trace", ["batch_number", "pack_number", "box_number", "pallet_number", "pack_count", "box_count"]],
    ["text", ["constanta"]],
    ["gs1", ["ai", "gs", "fnc1"]],
];
export const ALL_KINDS = KIND_GROUPS.flatMap(([, kinds]) => kinds);

export const AI_CODES = ["01", "02", "3103", "15", "17", "11", "10", "21", "00"];
/** Fixed data length after a GS1 application identifier. */
export const AI_LENGTH: Record<string, number> = { "00": 18, "01": 14, "02": 14, "3103": 6, "11": 6, "15": 6, "17": 6 };
const AI_DATES = ["11", "15", "17"];

export const DATE_FORMATS = ["ddMMyy", "ddMMyyyy", "yyMMdd", "yyyyMMdd"];

const COUNT_KINDS = ["pack_count", "box_count"];

/** The station's length of a part when none is set; 0 means "as is". */
export function defaultLength(kind: string): number {
    if (kind === "article") return 14;
    if (WEIGHT_KINDS.includes(kind)) return 6;
    return 0;
}

/** Parts whose number of digits can be set (dates take theirs from the format). */
export const hasLength = (kind: string) =>
    kind === "article" || kind === "extra_data" || WEIGHT_KINDS.includes(kind) || RUNTIME_KINDS.includes(kind) || COUNT_KINDS.includes(kind);

export const DEFAULT_DATE_FORMAT = "yyMMdd";

const toInt = (text: string | undefined, fallback: number) => {
    const n = Number(text);
    return text !== undefined && text !== "" && Number.isInteger(n) && n >= 0 ? n : fallback;
};

export const lengthOf = (field: BarcodeField) => toInt(field.length, defaultLength(field.field_type));
export const decimalsOf = (field: BarcodeField) => toInt(field.decimalPlaces, 3);

/** A part printed "as is": its length is whatever the product's value is. */
export const isVariable = (field: BarcodeField) => hasLength(field.field_type) && lengthOf(field) === 0;

/** Characters a part puts into the data string: "(01)" for an AI, nothing for GS and FNC1. */
export function charsOf(field: BarcodeField): number {
    switch (field.field_type) {
        case "constanta": return (field.value ?? "").length;
        case "ai": return (field.value ?? "").length + 2;
        case "gs":
        case "fnc1": return 0;
        default:
            if (DATE_KINDS.includes(field.field_type)) return (field.dateFormat || DEFAULT_DATE_FORMAT).length;
            return lengthOf(field);
    }
}

/** Digits a part contributes to what the scanner reads (no AI brackets, no separators). */
export function digitsOf(field: BarcodeField): number {
    if (field.field_type === "ai" || field.field_type === "gs" || field.field_type === "fnc1") return 0;
    return charsOf(field);
}

/** Heaviest weight that fits a weight part, e.g. 5 digits with 3 decimals → 99.999 kg. */
export function maxWeightKg(field: BarcodeField): number {
    return (10 ** lengthOf(field) - 1) / 10 ** decimalsOf(field);
}

export type Problem = { index: number | null; key: string; params?: Record<string, string | number> };

/** Everything that stops a template from turning into a barcode (server and GS1 rules). */
export function problemsOf(structure: BarcodeStructure): Problem[] {
    const out: Problem[] = [];
    const type = structure.barcode_type;
    const fields = structure.fields ?? [];
    if (!SYMBOLOGIES.includes(type as Symbology)) out.push({ index: null, key: "bc.prob.type" });
    if (fields.length === 0) out.push({ index: null, key: "bc.prob.empty" });
    fields.forEach((field, index) => {
        const kind = field.field_type;
        if (!ALL_KINDS.includes(kind)) {
            out.push({ index, key: "bc.prob.kind" });
            return;
        }
        if (GS1_ONLY.includes(kind) && !isGs1(type)) out.push({ index, key: "bc.prob.gs1Only" });
        if (kind === "constanta") {
            const value = (field.value ?? "").trim();
            if (!value) out.push({ index, key: "bc.prob.constEmpty" });
            else if (type === "ean13" && !/^\d+$/.test(value)) out.push({ index, key: "bc.prob.constDigits" });
        }
        if (kind === "ai" && !AI_CODES.includes(field.value ?? "")) out.push({ index, key: "bc.prob.ai" });
        if (kind === "extra_data" && !(field.value ?? "").trim()) out.push({ index, key: "bc.prob.extraEmpty" });
        for (const attr of ["length", "decimalPlaces"] as const) {
            const v = field[attr];
            if (v !== undefined && v !== "" && !/^\d+$/.test(v)) out.push({ index, key: "bc.prob.digitsOnly" });
        }
        if (kind === "ai" && AI_LENGTH[field.value ?? ""]) {
            const next = fields[index + 1];
            const need = AI_LENGTH[field.value ?? ""];
            const got = next ? digitsOf(next) : 0;
            if (!(next && isVariable(next)) && got !== need) out.push({ index: index + 1 < fields.length ? index + 1 : index, key: "bc.prob.aiLength", params: { ai: field.value ?? "", need, got } });
            if (next && AI_DATES.includes(field.value ?? "") && DATE_KINDS.includes(next.field_type) && (next.dateFormat || DEFAULT_DATE_FORMAT) !== "yyMMdd") {
                out.push({ index: index + 1, key: "bc.prob.aiDate", params: { ai: field.value ?? "" } });
            }
        }
    });
    // With a part printed "as is" only the station knows the length; the preview checks it.
    if (type === "ean13" && fields.length > 0 && !fields.some(isVariable)) {
        const digits = fields.reduce((sum, f) => sum + digitsOf(f), 0);
        if (digits !== 12) out.push({ index: null, key: "bc.prob.ean12", params: { got: digits } });
    }
    return out;
}

/** Splits the server's data string into the parts of the template (null if they do not line up). */
export function splitData(structure: BarcodeStructure, data: string): string[] | null {
    const parts: string[] = [];
    let at = 0;
    for (const field of structure.fields) {
        const n = charsOf(field);
        parts.push(data.slice(at, at + n));
        at += n;
    }
    if (structure.barcode_type === "ean13" && data.length === at + 1) return [...parts, data.slice(at)];
    return at === data.length ? parts : null;
}

/** EAN-13 check digit for 12 digits. */
export function ean13Check(digits12: string): string {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(digits12[i]) * (i % 2 ? 3 : 1);
    return String((10 - (sum % 10)) % 10);
}

/** Templates (by label template) whose barcode elements point at this barcode template. */
export function labelsUsing(template: BarcodeTemplate, labels: Array<{ id: number; name: string; scheme?: unknown }>): Array<{ id: number; name: string }> {
    return labels.filter((label) => barcodeRefs(label.scheme).some((ref) => (ref.templateId ? ref.templateId === template.id : ref.name === template.name)));
}

export function barcodeRefs(scheme: unknown): Array<{ templateId: number | null; name: string }> {
    const elements = (scheme as { elements?: unknown })?.elements;
    if (!Array.isArray(elements)) return [];
    return elements
        .filter((el) => el && typeof el === "object" && (el as { type?: string }).type === "barcode")
        .map((el) => {
            const e = el as { templateId?: unknown; barcodeType?: unknown };
            return { templateId: typeof e.templateId === "number" && e.templateId > 0 ? e.templateId : null, name: String(e.barcodeType ?? "") };
        });
}

// ── one-click starters ──
export type Starter = { id: string; type: Symbology; fields: BarcodeField[]; needsGtin?: boolean };

const GTIN = "{gtin}";
export const STARTERS: Starter[] = [
    { id: "weighed", type: "ean13", fields: [{ field_type: "constanta", value: "21" }, { field_type: "article", length: "5" }, { field_type: "weight_netto_pack", length: "5", decimalPlaces: "3" }] },
    {
        id: "gs1Retail", type: "databarexpandedstacked", needsGtin: true, fields: [
            { field_type: "ai", value: "01" }, { field_type: "extra_data", value: GTIN, length: "14" },
            { field_type: "ai", value: "3103" }, { field_type: "weight_netto_pack", length: "6", decimalPlaces: "3" },
            { field_type: "ai", value: "17" }, { field_type: "exp_date", length: "6", dateFormat: "yyMMdd" },
            { field_type: "ai", value: "10" }, { field_type: "batch_number", length: "10" },
        ],
    },
    {
        id: "gs1Qr", type: "gs1qrcode", needsGtin: true, fields: [
            { field_type: "ai", value: "01" }, { field_type: "extra_data", value: GTIN, length: "14" },
            { field_type: "ai", value: "17" }, { field_type: "exp_date", length: "6", dateFormat: "yyMMdd" },
            { field_type: "ai", value: "10" }, { field_type: "batch_number", length: "10" },
        ],
    },
    { id: "piece", type: "ean13", needsGtin: true, fields: [{ field_type: "extra_data", value: GTIN, length: "12" }] },
    { id: "boxNumber", type: "code128", fields: [{ field_type: "box_number", length: "12" }] },
    { id: "internalQr", type: "qrcode", fields: [{ field_type: "article", length: "5" }, { field_type: "constanta", value: "-" }, { field_type: "batch_number", length: "10" }] },
];

/** A starter's fields with the GTIN field name filled in. */
export function starterFields(starter: Starter, gtinField: string): BarcodeField[] {
    return starter.fields.map((f) => (f.value === GTIN ? { ...f, value: gtinField } : { ...f }));
}

/** The product field that holds the GTIN, if products have one. */
export function gtinFieldOf(names: string[]): string | null {
    return names.find((name) => /gtin|ean|штрих|barcode/i.test(name)) ?? null;
}

export function parseTemplate(raw: Record<string, unknown>): BarcodeTemplate | null {
    let structure: unknown = raw.structure;
    if (typeof structure === "string") {
        try {
            structure = JSON.parse(structure);
        } catch {
            return null;
        }
    }
    if (!structure || typeof structure !== "object") return null;
    const s = structure as Partial<BarcodeStructure>;
    return {
        id: Number(raw.id),
        name: String(raw.name ?? ""),
        structure: { barcode_type: String(s.barcode_type ?? "ean13"), barcode_name: s.barcode_name, fields: Array.isArray(s.fields) ? (s.fields as BarcodeField[]) : [] },
    };
}
