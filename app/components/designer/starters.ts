// Ready layouts a new template starts from (the one-click gallery). Pack labels carry every
// mandatory particular for the EU (Regulation 1169/2011) in a readable size: x-height of at
// least 1.2 mm, i.e. Inter from 6.5 pt; the ℮ starter prints the nominal quantity in figures
// at least 4 mm high (Directive 76/211/EEC, packs of 200 g to 1 kg).

import type { LabelDoc, LabelElement, TableElement } from "@/lib/label/types";
import { uid } from "@/lib/label/helpers";
import type { EuRequirement } from "@/lib/label/eu";
import { barcodeElement, blankDoc, fieldText, textElement, type BarcodeTemplate, type LType, type T } from "./model";

export type Starter = { id: string; type: LType; w: number; h: number; euFields: boolean };

export const STARTERS: Starter[] = [
    { id: "weighed", type: "pack", w: 58, h: 40, euFields: true },
    { id: "fixed", type: "pack", w: 58, h: 60, euFields: true },
    { id: "sliced", type: "pack", w: 80, h: 60, euFields: true },
    { id: "box", type: "box", w: 100, h: 150, euFields: false },
    { id: "boxSquare", type: "box", w: 100, h: 100, euFields: false },
    { id: "pallet", type: "pallet", w: 148, h: 210, euFields: false },
];

/** Names of the extra product fields a pack starter shows (they are created if missing). */
export type ExtraNames = Partial<Record<Extract<EuRequirement, "ingredients" | "storage" | "producer">, string>>;

type Line = { y: number; h: number; text: string; pt: number; bold?: boolean; w?: number; x?: number; align?: "left" | "center" | "right" };

export function buildStarter(starter: Starter, t: T, extras: ExtraNames, barcode: BarcodeTemplate | undefined): LabelDoc {
    const doc = blankDoc(starter.type, starter.w, starter.h);
    const c = doc.canvas;
    const field = (key: string, extra = false) => fieldText(key, extra, t);
    const extra = (which: keyof ExtraNames) => (extras[which] ? field(extras[which]!, true) : null);
    const lines: Line[] = [];
    let code: { x: number; y: number; w: number; h: number } | null = null;

    if (starter.id === "weighed") {
        lines.push(
            { y: 1.5, h: 4.6, text: field("name"), pt: 10, bold: true },
            { y: 6.3, h: 4, text: field("weight_netto_pack"), pt: 9, bold: true },
            { y: 10.5, h: 3, text: field("exp_date_full"), pt: 6.5 },
            { y: 13.6, h: 3, text: `${field("production_date")}   ${field("batch_number")}`, pt: 6.5 },
        );
        const ing = extra("ingredients");
        if (ing) lines.push({ y: 16.8, h: 8.6, text: ing, pt: 6.5 });
        const storage = extra("storage");
        if (storage) lines.push({ y: 25.8, h: 3, text: storage, pt: 6.5, w: 29 });
        const producer = extra("producer");
        if (producer) lines.push({ y: 29, h: 8.4, text: producer, pt: 6.5, w: 29 });
        code = { x: 33, y: 25.8, w: 23, h: 12.6 };
    } else if (starter.id === "fixed") {
        lines.push(
            { y: 2, h: 8.6, text: field("name"), pt: 11, bold: true },
            { y: 11, h: 7.8, text: `{{ weight_netto_pack }} ${t("ed.unitKg")} ℮`, pt: 18, bold: true },
            { y: 19.4, h: 3, text: field("exp_date_full"), pt: 6.5 },
            { y: 22.6, h: 3, text: `${field("production_date")}   ${field("batch_number")}`, pt: 6.5 },
        );
        const ing = extra("ingredients");
        if (ing) lines.push({ y: 26, h: 11.4, text: ing, pt: 6.5 });
        const storage = extra("storage");
        if (storage) lines.push({ y: 38, h: 3, text: storage, pt: 6.5, w: 29 });
        const producer = extra("producer");
        if (producer) lines.push({ y: 41.4, h: 11, text: producer, pt: 6.5, w: 29 });
        code = { x: 33, y: 40.5, w: 23, h: 16 };
    } else if (starter.id === "sliced") {
        lines.push(
            { y: 2, h: 6.4, text: field("name"), pt: 14, bold: true },
            { y: 9, h: 5, text: field("weight_netto_pack"), pt: 12, bold: true },
            { y: 14.6, h: 3.6, text: field("exp_date_full"), pt: 8 },
            { y: 18.4, h: 3.6, text: `${field("production_date")}   ${field("batch_number")}`, pt: 8 },
        );
        const ing = extra("ingredients");
        if (ing) lines.push({ y: 22.4, h: 12, text: ing, pt: 7 });
        const storage = extra("storage");
        if (storage) lines.push({ y: 35, h: 3.4, text: storage, pt: 7, w: 44 });
        const producer = extra("producer");
        if (producer) lines.push({ y: 38.8, h: 12, text: producer, pt: 7, w: 44 });
        code = { x: 50, y: 42, w: 28, h: 15 };
    } else if (starter.id === "box") {
        lines.push(
            { y: 6, h: 20, text: field("name"), pt: 22, bold: true, align: "center", x: 5, w: 90 },
            { y: 27, h: 6, text: field("article"), pt: 12, align: "center", x: 5, w: 90 },
            { y: 36, h: 8, text: field("close_box_counter"), pt: 16, bold: true },
            { y: 44.5, h: 8, text: field("weight_netto_box"), pt: 16, bold: true },
            { y: 53, h: 6, text: field("weight_brutto_box"), pt: 12 },
            { y: 61, h: 6, text: field("production_date"), pt: 12 },
            { y: 67.5, h: 6, text: field("exp_date_full"), pt: 12, bold: true },
            { y: 74, h: 6, text: field("batch_number"), pt: 12 },
            { y: 80.5, h: 6, text: field("box_number"), pt: 12 },
        );
        code = { x: 10, y: 100, w: 80, h: 40 };
    } else if (starter.id === "boxSquare") {
        lines.push(
            { y: 4, h: 13, text: field("name"), pt: 16, bold: true, x: 4, w: 92 },
            { y: 18, h: 6, text: field("close_box_counter"), pt: 12, bold: true },
            { y: 24.5, h: 6, text: field("weight_netto_box"), pt: 12, bold: true },
            { y: 31, h: 5, text: field("weight_brutto_box"), pt: 10 },
            { y: 36.5, h: 5, text: field("production_date"), pt: 10 },
            { y: 42, h: 5, text: field("exp_date_full"), pt: 10, bold: true },
            { y: 47.5, h: 5, text: field("batch_number"), pt: 10 },
            { y: 53, h: 5, text: field("box_number"), pt: 10 },
        );
        code = { x: 10, y: 61, w: 80, h: 32 };
    } else if (starter.id === "pallet") {
        return { ...doc, elements: palletLayout(doc.canvas.width, doc.canvas.height, t) };
    }

    const margin = starter.w >= 100 ? 5 : 2;
    const elements: LabelElement[] = lines.map((line) =>
        textElement(c, { x: line.x ?? margin, y: line.y, w: line.w ?? starter.w - margin * 2, h: line.h }, line.text, line.pt, { bold: line.bold, align: line.align }),
    );
    if (code && barcode) elements.push(barcodeElement(c, barcode, code));
    return { ...doc, elements };
}

/** Pallet sheet: heading, pallet number and dates, the table of what is on it, totals. */
export function palletLayout(width: number, height: number, t: T): LabelElement[] {
    const W = width;
    const H = height;
    const pad = Math.round(W * 0.05);
    const innerW = W - pad * 2;
    const titleFs = Math.max(18, Math.round(H * 0.026));
    const fs = Math.max(12, Math.round(H * 0.015));
    const lineH = Math.round(fs * 1.7);
    const text = (x: number, y: number, w: number, h: number, value: string, size: number, bold = false, align: "left" | "center" = "left"): LabelElement => ({
        id: uid(), type: "text", x, y, w, h, rotation: 0, text: value, fontSize: size, color: "#000000",
        fontWeight: bold ? 700 : 400, fontFamily: "Inter", textAlign: align, fontStyle: "normal", textDecoration: "none",
    });

    const els: LabelElement[] = [];
    let y = pad;
    els.push(text(pad, y, innerW, Math.round(titleFs * 1.4), t("ed.pallet.title"), titleFs, true, "center"));
    y += Math.round(titleFs * 1.4) + Math.round(H * 0.012);
    els.push(text(pad, y, innerW, lineH, fieldText("pallet_number", false, t), fs, true));
    y += lineH;
    els.push(text(pad, y, Math.round(innerW / 2), lineH, fieldText("shipping_date", false, t), fs));
    els.push(text(pad + Math.round(innerW / 2), y, Math.round(innerW / 2), lineH, fieldText("production_date", false, t), fs));
    y += lineH + Math.round(H * 0.015);

    const totalsH = lineH * 2 + Math.round(H * 0.02);
    const tableH = Math.max(160, H - y - totalsH - pad);
    const table: TableElement = {
        id: uid(), type: "table", x: pad, y, w: innerW, h: tableH, rotation: 0,
        columns: [
            { id: uid(), key: "name", title: t("designer.colName"), widthRatio: 42 },
            { id: uid(), key: "batch_number", title: t("designer.colBatch"), widthRatio: 20 },
            { id: uid(), key: "quantity", title: t("designer.colQuantity"), widthRatio: 13 },
            { id: uid(), key: "weight_brutto_pack", title: t("ed.pallet.weight"), widthRatio: 25 },
        ],
        groupBy: "none", sortBy: "none", fontSize: Math.max(10, Math.round(fs * 0.85)),
        showHeaders: true, showBorders: true, fontFamily: "Inter", fontStyle: "normal",
    };
    els.push(table);

    let ty = y + tableH + Math.round(H * 0.012);
    els.push(text(pad, ty, innerW, lineH, `${fieldText("total_count", false, t)}        ${fieldText("total_boxes", false, t)}`, fs, true));
    ty += lineH;
    els.push(text(pad, ty, innerW, lineH, fieldText("weight_total", false, t), fs, true));
    return els;
}
