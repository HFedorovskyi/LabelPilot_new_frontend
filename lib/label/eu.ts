/**
 * EU check of a consumer pack label: are the mandatory food particulars on it
 * (Regulation (EU) 1169/2011, Art. 9 and 13, plus the lot of Directive 2011/91/EU),
 * and is their text large enough to read.
 *
 * The check only sees what a template can know: fields placed on it ({{ key }}) and,
 * for particulars that are often the same for every product (storage, producer),
 * fixed text that names them. Values are filled in at the station from the product.
 */

import type { CanvasConfig, LabelDoc, TextElement } from "./types";

export type EuRequirement = "name" | "net" | "best" | "lot" | "ingredients" | "storage" | "producer";

export const EU_REQUIREMENTS: EuRequirement[] = ["name", "net", "best", "lot", "ingredients", "storage", "producer"];

/** Built-in product fields that satisfy a requirement. */
const BUILT_IN: Partial<Record<EuRequirement, string[]>> = {
    name: ["name"],
    net: ["weight_netto_pack"],
    best: ["exp_date_full"],
    lot: ["batch_number"],
};

/** Extra product fields (named on the Products page) that satisfy a requirement, in ru/uk/en/de. */
export const EXTRA_FIELD: Partial<Record<EuRequirement, RegExp>> = {
    ingredients: /состав|склад|ingredient|zutat/i,
    storage: /хранени|зберіган|storage|lagerung|aufbewahr/i,
    producer: /производител|изготовител|виробник|manufactur|producer|hersteller|lebensmittelunternehm/i,
};

/** Fixed text that states a particular outright, e.g. "Хранить при 0…+6 °C". */
const FIXED_TEXT: Partial<Record<EuRequirement, RegExp>> = {
    storage: /хранить|зберігати|store at|keep (?:refrigerated|chilled|cool)|lagern|kühl/i,
    producer: /производител|изготовител|виробник|manufactur|producer|hersteller/i,
};

const VAR = /{{\s*([^{}]+?)\s*}}/g;

/** Field keys a text uses, in order. */
export function fieldKeys(text: string): string[] {
    return [...text.matchAll(VAR)].map((match) => match[1].trim());
}

/** Does this field key (built-in or an extra field's name) state the requirement? */
export function keySatisfies(requirement: EuRequirement, key: string): boolean {
    if (BUILT_IN[requirement]?.includes(key)) return true;
    const extra = EXTRA_FIELD[requirement];
    return !!extra && extra.test(key);
}

function textSatisfies(requirement: EuRequirement, text: string): boolean {
    if (fieldKeys(text).some((key) => keySatisfies(requirement, key))) return true;
    const fixed = FIXED_TEXT[requirement];
    return !!fixed && fixed.test(text.replace(VAR, " "));
}

/**
 * Lower-case letter height as a share of the font size: the OS/2 x-height of the fonts
 * the stations print with (public/fonts/label-fonts); anything else prints as Inter.
 */
const X_HEIGHT: Record<string, number> = {
    inter: 0.545,
    roboto: 0.528,
    montserrat: 0.517,
    ubuntu: 0.52,
};

export function xHeightRatio(fontFamily: string | undefined): number {
    return X_HEIGHT[(fontFamily || "inter").trim().toLowerCase()] ?? X_HEIGHT.inter;
}

/** Canvas pixels per millimetre of the label. */
export function pxPerMm(canvas: CanvasConfig): number {
    const mm = (canvas.widthCm || 10) * 10;
    return canvas.width > 0 && mm > 0 ? canvas.width / mm : (canvas.dpi || 203) / 25.4;
}

/** Height of the lower-case letters of a text element, in mm. */
export function xHeightMm(el: Pick<TextElement, "fontSize" | "fontFamily">, canvas: CanvasConfig): number {
    return (el.fontSize / pxPerMm(canvas)) * xHeightRatio(el.fontFamily);
}

/** Smallest x-height the regulation allows (Annex IV): 1.2 mm, 0.9 mm on packs whose largest side is under 80 cm². */
export const MIN_X_HEIGHT_MM = 1.2;
export const MIN_X_HEIGHT_SMALL_PACK_MM = 0.9;

/**
 * "ok": readable on any pack. "smallPack": allowed only when the pack's largest side is
 * under 80 cm² (a label of 80 cm² or more rules that out). "tooSmall": below both.
 */
export type TextSize = "ok" | "smallPack" | "tooSmall";

export function textSize(el: Pick<TextElement, "fontSize" | "fontFamily">, canvas: CanvasConfig): TextSize {
    const x = xHeightMm(el, canvas) + 1e-6;
    if (x >= MIN_X_HEIGHT_MM) return "ok";
    const labelCm2 = (canvas.widthCm || 0) * (canvas.heightCm || 0);
    if (labelCm2 >= 80) return "tooSmall";
    return x >= MIN_X_HEIGHT_SMALL_PACK_MM ? "smallPack" : "tooSmall";
}

export type EuItem = {
    requirement: EuRequirement;
    /** The text element that states it, if any (the largest one when several do). */
    element: TextElement | null;
    size: TextSize | null;
};

export type EuCheck = {
    items: EuItem[];
    /** Present and not too small to read. */
    ready: number;
    total: number;
    gaps: EuRequirement[];
};

/** Only consumer pack labels carry the particulars; boxes and pallet sheets are not checked. */
export function isEuChecked(doc: Pick<LabelDoc, "canvas">): boolean {
    return (doc.canvas.labelType || "pack") === "pack";
}

export function euCheck(doc: LabelDoc, hidden: ReadonlySet<string> = new Set()): EuCheck {
    const texts = doc.elements.filter((el): el is TextElement => el.type === "text" && !hidden.has(el.id));
    const items = EU_REQUIREMENTS.map((requirement): EuItem => {
        const stating = texts.filter((el) => textSatisfies(requirement, el.text));
        if (stating.length === 0) return { requirement, element: null, size: null };
        const element = stating.reduce((a, b) => (xHeightMm(b, doc.canvas) > xHeightMm(a, doc.canvas) ? b : a));
        return { requirement, element, size: textSize(element, doc.canvas) };
    });
    const ready = items.filter((item) => item.element && item.size !== "tooSmall").length;
    return {
        items,
        ready,
        total: items.length,
        gaps: items.filter((item) => !item.element || item.size === "tooSmall").map((item) => item.requirement),
    };
}

/** Is this text element one of the mandatory particulars? */
export function isMandatoryText(el: TextElement): boolean {
    return EU_REQUIREMENTS.some((requirement) => textSatisfies(requirement, el.text));
}
