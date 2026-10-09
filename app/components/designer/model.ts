// What the label template editor and the template list share: units, the product fields
// a template can show, sample data for the preview, new elements and the starter layouts.

import type {
    BarcodeElement, CanvasConfig, ImageElement, LabelDoc, LabelElement, RectElement, TableElement, TextElement,
} from "@/lib/label/types";
import { cmToPx, formatDate, uid, DPI_203 } from "@/lib/label/helpers";
import { defaultDoc, validateDoc } from "@/lib/label/document";
import { EXTRA_FIELD, fieldKeys, pxPerMm, type EuRequirement } from "@/lib/label/eu";

export type LType = "pack" | "box" | "pallet";
export type T = (key: string, params?: Record<string, string | number | undefined>) => string;

export const LTYPES: LType[] = ["pack", "box", "pallet"];

/** Fonts the stations print with; any other family prints as Inter. */
export const PRINT_FONTS = ["Inter", "Roboto", "Montserrat", "Ubuntu"];
export const PRINT_DPI = [203, 300, 600];
/** Rotations the stations print. */
export const QUARTER_TURNS = [0, 90, 180, 270];

const PT_MM = 25.4 / 72;

// ── units: elements are stored in canvas pixels; people think in mm and pt ──
export const toMm = (px: number, canvas: CanvasConfig) => px / pxPerMm(canvas);
export const fromMm = (mm: number, canvas: CanvasConfig) => mm * pxPerMm(canvas);
export const toPt = (px: number, canvas: CanvasConfig) => toMm(px, canvas) / PT_MM;
export const fromPt = (pt: number, canvas: CanvasConfig) => fromMm(pt * PT_MM, canvas);

/** "12,5" in the user's language, at most `digits` decimals, no trailing zeros. */
export function fmt(value: number, lang: string, digits = 1): string {
    return new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(value);
}

/** Number typed by a person: accepts "12,5" and "12.5". */
export function parseNum(text: string): number | null {
    const value = Number(text.trim().replace(",", "."));
    return text.trim() !== "" && Number.isFinite(value) ? value : null;
}

export function labelType(doc: Pick<LabelDoc, "canvas">): LType {
    const type = doc.canvas.labelType;
    return type === "box" || type === "pallet" ? type : "pack";
}

export function sizeMm(canvas: CanvasConfig): { w: number; h: number } {
    return { w: Math.round((canvas.widthCm || 0) * 100) / 10, h: Math.round((canvas.heightCm || 0) * 100) / 10 };
}

/** A saved template's scheme, whether the server sent an object or a JSON string. */
export function parseScheme(template: { scheme?: unknown; structure?: unknown } | null | undefined): LabelDoc | null {
    let scheme: unknown = template?.scheme;
    if (!scheme || typeof scheme !== "object") {
        const structure = template?.structure ?? template?.scheme;
        if (typeof structure === "string") {
            try {
                scheme = JSON.parse(structure);
            } catch {
                scheme = null;
            }
        }
    }
    // Templates made before the format had a version number are version 1.
    if (scheme && typeof scheme === "object" && !("version" in scheme)) scheme = { ...scheme, version: 1 };
    return validateDoc(scheme);
}

/** Content of a template without the barcode pictures the editor fetches for its preview. */
export function signature(doc: LabelDoc): string {
    return JSON.stringify(doc, (key, value) => (key === "imageData" || key === "error" ? undefined : value));
}

// ── product fields ──
export type FieldGroup = "product" | "dates" | "weight" | "trace";
export const FIELD_GROUPS: FieldGroup[] = ["product", "dates", "weight", "trace"];

export type FieldDef = { key: string; label: string; group: FieldGroup; extra?: boolean };

const BUILT_IN: Record<LType, Array<[string, string, FieldGroup]>> = {
    pack: [
        ["name", "designer.attrName", "product"],
        ["article", "designer.attrArticle", "product"],
        ["production_date", "designer.attrProductionDate", "dates"],
        ["exp_date_full", "designer.attrExpDateFullDate", "dates"],
        ["exp_date", "designer.attrExpDateDays", "dates"],
        ["weight_netto_pack", "designer.attrWeightNettoPack", "weight"],
        ["weight_brutto_pack", "designer.attrWeightBruttoPack", "weight"],
        ["batch_number", "designer.attrBatchNumber", "trace"],
        ["pack_number", "designer.attrPackNumber", "trace"],
        ["operator", "designer.attrOperatorNum", "trace"],
        ["operator_name", "designer.attrOperatorName", "trace"],
    ],
    box: [
        ["name", "designer.attrName", "product"],
        ["article", "designer.attrArticle", "product"],
        ["production_date", "designer.attrProductionDate", "dates"],
        ["exp_date_full", "designer.attrExpDateFullDate", "dates"],
        ["exp_date", "designer.attrExpDateDays", "dates"],
        ["weight_netto_box", "designer.attrWeightNettoBox", "weight"],
        ["weight_brutto_box", "designer.attrWeightBruttoBox", "weight"],
        ["close_box_counter", "designer.attrCloseBoxCounter", "trace"],
        ["batch_number", "designer.attrBatchNumber", "trace"],
        ["box_number", "designer.attrBoxNumber", "trace"],
        ["operator", "designer.attrOperatorNum", "trace"],
        ["operator_name", "designer.attrOperatorName", "trace"],
    ],
    pallet: [
        ["shipping_date", "designer.attrShippingDate", "dates"],
        ["production_date", "designer.attrProductionDate", "dates"],
        ["production_date_batch", "designer.attrProductionDateBatch", "dates"],
        ["exp_date_full", "designer.attrExpDateFull", "dates"],
        ["weight_total", "designer.attrWeightTotal", "weight"],
        ["weight_netto_pallet", "designer.attrWeightNettoPallet", "weight"],
        ["weight_brutto_pallet", "designer.attrWeightBruttoPallet", "weight"],
        ["weight_netto_batch", "designer.attrWeightNettoBatch", "weight"],
        ["weight_brutto_batch", "designer.attrWeightBruttoBatch", "weight"],
        ["weight_netto_nomenclature", "designer.attrWeightNettoNomenclature", "weight"],
        ["weight_brutto_nomenclature", "designer.attrWeightBruttoNomenclature", "weight"],
        ["pallet_number", "designer.attrPalletNumber", "trace"],
        ["total_count", "designer.attrTotalCount", "trace"],
        ["total_places", "designer.attrTotalPlaces", "trace"],
        ["total_boxes", "designer.attrTotalBoxes", "trace"],
        ["operator", "designer.attrOperatorNum", "trace"],
        ["operator_name", "designer.attrOperatorName", "trace"],
    ],
};

/** Fields a template of this type can show: the built-in ones and the extra fields of products. */
export function fieldsFor(type: LType, extraNames: string[], t: T): FieldDef[] {
    const builtIn = BUILT_IN[type].map(([key, label, group]) => ({ key, label: t(label), group }));
    const extras = extraNames.map((name) => ({ key: name, label: name, group: "product" as const, extra: true }));
    const product = builtIn.filter((f) => f.group === "product");
    return [...product, ...extras, ...builtIn.filter((f) => f.group !== "product")];
}

/** Which requirement an extra field states, if any. */
function extraRequirement(name: string): EuRequirement | null {
    for (const [requirement, pattern] of Object.entries(EXTRA_FIELD)) {
        if (pattern && pattern.test(name)) return requirement as EuRequirement;
    }
    return null;
}

/** The text a field goes on the label with, e.g. "Масса нетто: {{ weight_netto_pack }} кг". */
export function fieldText(key: string, extra: boolean, t: T): string {
    const v = `{{ ${key} }}`;
    if (extra) {
        // Storage conditions read as a sentence of their own ("Хранить при 0…+6 °C").
        return extraRequirement(key) === "storage" ? v : `${key}: ${v}`;
    }
    const pattern = t(`ed.ins.${key}`);
    return pattern === `ed.ins.${key}` ? v : pattern.replace("{v}", v);
}

/** The extra field that states a requirement, if products have one. */
export function extraFieldFor(requirement: EuRequirement, extraNames: string[]): string | null {
    const pattern = EXTRA_FIELD[requirement];
    return pattern ? extraNames.find((name) => pattern.test(name)) ?? null : null;
}

/** Built-in field that states a requirement on a pack label. */
export const REQUIREMENT_FIELD: Partial<Record<EuRequirement, string>> = {
    name: "name",
    net: "weight_netto_pack",
    best: "exp_date_full",
    lot: "batch_number",
};

// ── preview data ──
const SAMPLE_ROWS = [
    { name: "Колбаса «Молочная»", article: "ART-1001" },
    { name: "Сосиски «Сливочные»", article: "ART-1002" },
    { name: "Сардельки «Говяжьи»", article: "ART-1003" },
];

/** What a label shows for a product: its own fields plus sample scale, counter and batch values. */
export function previewDataFor(product: Record<string, any> | null, tableRows = 12): Record<string, any> {
    const day = 24 * 60 * 60 * 1000;
    const shelfDays = Number(product?.exp_date) || 30;
    const today = formatDate(new Date());
    const data: Record<string, any> = {
        name: product?.name || "Пример товара",
        article: product?.article || "ART-00000",
        exp_date: String(product?.exp_date || "30"),
        pack_counter: "1",
        close_box_counter: String(product?.close_box_counter || "10"),
        weight_netto_pack: "0.512",
        weight_brutto_pack: "0.524",
        weight_netto_box: "5.120",
        weight_brutto_box: "5.360",
        weight_netto_pallet: "99.999",
        weight_brutto_pallet: "99.999",
        pack_number: "000000000001",
        box_number: "000000000001",
        pallet_number: "000000000001",
        production_date: today,
        exp_date_full: formatDate(new Date(Date.now() + shelfDays * day)),
        batch_number: "0610-1",
        operator: "07",
        operator_name: "Иванов И.И.",
        items: [],
    };
    const batches = [
        { num: "LOT-1001", prod: today, exp: formatDate(new Date(Date.now() + 30 * day)) },
        { num: "LOT-1002", prod: formatDate(new Date(Date.now() - day)), exp: formatDate(new Date(Date.now() + 29 * day)) },
    ];
    let sumNetto = 0;
    let sumBrutto = 0;
    let sumQty = 0;
    for (let i = 0; i < tableRows; i++) {
        const row = SAMPLE_ROWS[i % SAMPLE_ROWS.length];
        const batch = batches[i % batches.length];
        const qty = 8 + (i % 5) * 2;
        const netto = 9.5 + (i % 4) * 0.75;
        const brutto = netto + 0.4;
        sumNetto += netto;
        sumBrutto += brutto;
        sumQty += qty;
        data.items.push({
            name: row.name,
            article: row.article,
            quantity: String(qty),
            weight_netto_pack: netto.toFixed(3),
            weight_brutto_pack: brutto.toFixed(3),
            batch_number: batch.num,
            production_date_batch: batch.prod,
            exp_date_full: batch.exp,
            weight_netto_batch: (netto * qty).toFixed(3),
            weight_brutto_batch: (brutto * qty).toFixed(3),
            weight_netto_nomenclature: netto.toFixed(3),
            weight_brutto_nomenclature: brutto.toFixed(3),
        });
    }
    data.weight_total = sumBrutto.toFixed(3);
    data.weight_netto_pallet = sumNetto.toFixed(3);
    data.weight_brutto_pallet = sumBrutto.toFixed(3);
    data.total_count = String(sumQty);
    data.total_positions = String(tableRows);
    data.total_places = String(tableRows);
    data.total_boxes = String(sumQty);
    data.shipping_date = today;
    if (product?.extra_data && typeof product.extra_data === "object") {
        for (const [key, value] of Object.entries(product.extra_data)) data[key] = String(value);
    }
    return data;
}

/** Data that shows each field by name, e.g. "{Масса нетто}", for the «Поля» view. */
export function fieldNamesData(fields: FieldDef[], base: Record<string, any>): Record<string, any> {
    const data: Record<string, any> = { ...base };
    for (const field of fields) data[field.key] = `{${field.label}}`;
    return data;
}

// ── new elements (sizes in mm, fonts in pt, stored as canvas px) ──
type Box = { x: number; y: number; w: number; h: number };

export function textElement(canvas: CanvasConfig, box: Box, text: string, pt: number, opts: { bold?: boolean; align?: TextElement["textAlign"] } = {}): TextElement {
    return {
        id: uid(),
        type: "text",
        x: fromMm(box.x, canvas),
        y: fromMm(box.y, canvas),
        w: fromMm(box.w, canvas),
        h: fromMm(box.h, canvas),
        rotation: 0,
        text,
        fontSize: Math.round(fromPt(pt, canvas) * 10) / 10,
        fontWeight: opts.bold ? 700 : 400,
        color: "#000000",
        fontFamily: "Inter",
        fontStyle: "normal",
        textAlign: opts.align ?? "left",
        textDecoration: "none",
        ...(/{{\s*(pack_number|box_number)\s*}}/.test(text) ? { minLength: 12 } : {}),
    };
}

export function frameElement(canvas: CanvasConfig, box: Box): RectElement {
    return {
        id: uid(),
        type: "rect",
        x: fromMm(box.x, canvas),
        y: fromMm(box.y, canvas),
        w: fromMm(box.w, canvas),
        h: fromMm(box.h, canvas),
        rotation: 0,
        fill: "transparent",
        borderColor: "#000000",
        borderWidth: Math.max(1, Math.round(fromMm(0.3, canvas))),
        borderRadius: 0,
    };
}

export function lineElement(canvas: CanvasConfig, box: { x: number; y: number; w: number }): RectElement {
    return {
        id: uid(),
        type: "rect",
        x: fromMm(box.x, canvas),
        y: fromMm(box.y, canvas),
        w: fromMm(box.w, canvas),
        h: Math.max(1, Math.round(fromMm(0.3, canvas))),
        rotation: 0,
        fill: "#000000",
        borderColor: "#000000",
        borderWidth: 0,
        borderRadius: 0,
    };
}

/** A filled bar no thicker than 1.5 mm reads as a line, not a frame. */
export function isLine(el: LabelElement, canvas: CanvasConfig): boolean {
    if (el.type !== "rect") return false;
    const rect = el as RectElement;
    const filled = rect.fill && rect.fill !== "transparent" && rect.fill.toLowerCase() !== "#ffffff";
    return !!filled && rect.borderWidth === 0 && Math.min(toMm(rect.w, canvas), toMm(rect.h, canvas)) <= 1.5;
}

export type BarcodeTemplate = { id: number; name: string; structure?: { barcode_type?: string } };

export function is2D(template: BarcodeTemplate | undefined): boolean {
    const type = String(template?.structure?.barcode_type || "").toLowerCase();
    return ["qrcode", "gs1qrcode", "datamatrix", "gs1datamatrix", "azteccode"].includes(type);
}

const isEan13 = (template: BarcodeTemplate) => String(template.structure?.barcode_type || template.name).toLowerCase().replace(/[^a-z0-9]/g, "").includes("ean13");

export function barcodeElement(canvas: CanvasConfig, template: BarcodeTemplate, box: Box): BarcodeElement {
    let w = fromMm(box.w, canvas);
    // EAN-13 is 95 modules wide: keep a whole number of dots per module so it scans.
    if (isEan13(template)) w = Math.max(1, Math.round(w / 95)) * 95;
    return {
        id: uid(),
        type: "barcode",
        x: fromMm(box.x, canvas),
        y: fromMm(box.y, canvas),
        w,
        h: fromMm(box.h, canvas),
        rotation: 0,
        value: "{{ barcode }}",
        barcodeType: template.name,
        showText: !is2D(template),
        templateId: template.id,
    };
}

/** The barcode template a new label starts with: EAN-13 if there is one, else the first. */
export function defaultBarcode(templates: BarcodeTemplate[]): BarcodeTemplate | undefined {
    return templates.find(isEan13) ?? templates[0];
}

export function tableElement(canvas: CanvasConfig, box: Box, t: T): TableElement {
    return {
        id: uid(),
        type: "table",
        x: fromMm(box.x, canvas),
        y: fromMm(box.y, canvas),
        w: fromMm(box.w, canvas),
        h: fromMm(box.h, canvas),
        rotation: 0,
        columns: [
            { id: uid(), key: "name", title: t("designer.colName"), widthRatio: 40 },
            { id: uid(), key: "batch_number", title: t("designer.colBatch"), widthRatio: 30 },
            { id: uid(), key: "weight_netto_pack", title: t("designer.colWeightNettoUnit"), widthRatio: 30 },
        ],
        groupBy: "none",
        sortBy: "none",
        fontSize: Math.round(fromPt(8, canvas)),
        showHeaders: true,
        showBorders: true,
        fontFamily: "Inter",
        fontStyle: "normal",
    };
}

export function imageElement(canvas: CanvasConfig, src: string, box: Box): ImageElement {
    return {
        id: uid(),
        type: "image",
        x: fromMm(box.x, canvas),
        y: fromMm(box.y, canvas),
        w: fromMm(box.w, canvas),
        h: fromMm(box.h, canvas),
        rotation: 0,
        src,
    };
}

/** A picture file scaled down to what a label printer can show, as a PNG data URI. */
export function readPicture(file: File, maxSide = 1200): Promise<{ src: string; ratio: number }> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
            const w = Math.max(1, Math.round(img.naturalWidth * k));
            const h = Math.max(1, Math.round(img.naturalHeight * k));
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            URL.revokeObjectURL(url);
            if (!ctx) return reject(new Error("canvas"));
            // Transparent areas print as paper.
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve({ src: canvas.toDataURL("image/png"), ratio: h / w });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("image"));
        };
        img.src = url;
    });
}

/** Scale a template to another printer resolution without changing its physical size. */
export function withDpi(doc: LabelDoc, dpi: number): LabelDoc {
    const k = dpi / (doc.canvas.dpi || DPI_203);
    if (!Number.isFinite(k) || k === 1) return doc;
    const scale = (v: number) => Math.round(v * k * 100) / 100;
    return {
        ...doc,
        canvas: {
            ...doc.canvas,
            dpi,
            width: cmToPx(doc.canvas.widthCm, dpi),
            height: cmToPx(doc.canvas.heightCm, dpi),
        },
        elements: doc.elements.map((el) => {
            const moved = { ...el, x: scale(el.x), y: scale(el.y), w: scale(el.w), h: scale(el.h) };
            if (el.type === "text" || el.type === "table") return { ...moved, fontSize: scale((el as TextElement).fontSize) } as LabelElement;
            if (el.type === "rect") {
                const rect = el as RectElement;
                return { ...moved, borderWidth: scale(rect.borderWidth), borderRadius: scale(rect.borderRadius) } as LabelElement;
            }
            if (el.type === "barcode") return { ...moved, imageData: undefined } as LabelElement;
            return moved as LabelElement;
        }),
    };
}

/** Field keys used anywhere on the template (texts, barcode values, table columns). */
export function usedKeys(doc: LabelDoc): Set<string> {
    const keys = new Set<string>();
    for (const el of doc.elements) {
        if (el.type === "text") fieldKeys((el as TextElement).text).forEach((key) => keys.add(key));
        if (el.type === "barcode") fieldKeys((el as BarcodeElement).value || "").forEach((key) => keys.add(key));
        if (el.type === "table") (el as TableElement).columns.forEach((col) => keys.add(col.key));
    }
    return keys;
}

// ── blank documents ──
export function blankDoc(type: LType, wMm: number, hMm: number): LabelDoc {
    const base = defaultDoc();
    const widthCm = Math.max(10, Math.min(1000, wMm)) / 10;
    const heightCm = Math.max(10, Math.min(1000, hMm)) / 10;
    return {
        ...base,
        canvas: {
            ...base.canvas,
            labelType: type,
            widthCm,
            heightCm,
            width: cmToPx(widthCm, base.canvas.dpi),
            height: cmToPx(heightCm, base.canvas.dpi),
            showGrid: false,
        },
        elements: [],
    };
}
