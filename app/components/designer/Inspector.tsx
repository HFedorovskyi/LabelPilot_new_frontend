"use client";

// Right panel of the editor: the selected element's text, font, barcode or table, its
// place in mm; with nothing selected, the label itself (type, size, printer, zones).

import React, { useEffect, useRef, useState } from "react";
import type {
    BarcodeElement, CanvasConfig, ImageElement, LabelDoc, LabelElement, PrintedZone, RectElement, TableElement, TextElement,
} from "@/lib/label/types";
import { cmToPx, uid } from "@/lib/label/helpers";
import { isEuChecked, isMandatoryText, textSize, xHeightMm, MIN_X_HEIGHT_MM, MIN_X_HEIGHT_SMALL_PACK_MM } from "@/lib/label/eu";
import { cx } from "../stations/shared";
import { dangerLink, linkButton } from "../print/shared";
import { elementKind, elementName, KIND_ICON } from "./FieldsPanel";
import {
    fmt, fromMm, fromPt, labelType, LTYPES, PRINT_DPI, PRINT_FONTS, QUARTER_TURNS, sizeMm, toMm, toPt, withDpi,
    type BarcodeTemplate, type FieldDef, type T,
} from "./model";
import { DIcon, inputClass, Labeled, Note, NumField, Seg, TypeChip } from "./ui";

const TABLE_COLUMN_KEYS = [
    ["name", "designer.colName"],
    ["article", "designer.colArticle"],
    ["quantity", "designer.colQuantity"],
    ["batch_number", "designer.colBatch"],
    ["production_date_batch", "designer.colProductionDate"],
    ["exp_date_full", "designer.colExpDate"],
    ["weight_netto_pack", "designer.colWeightNettoUnit"],
    ["weight_brutto_pack", "designer.colWeightBruttoUnit"],
    ["weight_netto_batch", "designer.colWeightNettoBatch"],
    ["weight_brutto_batch", "designer.colWeightBruttoBatch"],
    ["weight_netto_nomenclature", "designer.colWeightNettoNomencl"],
    ["weight_brutto_nomenclature", "designer.colWeightBruttoNomencl"],
] as const;

const COUNTER = /{{\s*(pack_number|box_number|pallet_number|pack_counter)\s*}}/;

function Sec({ title, children, className }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <section className={cx("flex flex-col gap-2 border-t border-lp-line px-3.5 py-3 first:border-t-0", className)}>
            {title && <h3 className="m-0 text-[13px] font-extrabold text-lp-ink-3">{title}</h3>}
            {children}
        </section>
    );
}

type Props = {
    t: T;
    lang: string;
    doc: LabelDoc;
    selected: LabelElement | null;
    update: (patch: Partial<LabelElement>) => void;
    setDoc: (update: (doc: LabelDoc) => LabelDoc) => void;
    barcodeTemplates: BarcodeTemplate[];
    fields: FieldDef[];
    labelOf: Map<string, string>;
    focusText: number;
    onDuplicate: () => void;
    onDelete: () => void;
    onLayer: (dir: "up" | "down") => void;
    onReplaceImage: () => void;
};

export default function Inspector(props: Props) {
    const { t, selected } = props;
    return (
        <aside aria-label={t("ed.inspectorLabel")} className="lp-glass flex w-[304px] flex-none flex-col overflow-hidden rounded-[20px]">
            <div className="min-h-0 flex-1 overflow-y-auto">
                {selected ? <ElementInspector {...props} el={selected} /> : <LabelInspector {...props} />}
            </div>
        </aside>
    );
}

function ElementInspector({ t, lang, doc, el, update, barcodeTemplates, fields, labelOf, focusText, onDuplicate, onDelete, onLayer, onReplaceImage }: Props & { el: LabelElement }) {
    const c = doc.canvas;
    const kind = elementKind(el, c);
    const mm = (px: number) => toMm(px, c);
    const turn = QUARTER_TURNS.includes(((Math.round(el.rotation) % 360) + 360) % 360) ? ((Math.round(el.rotation) % 360) + 360) % 360 : null;
    return (
        <>
            <Sec>
                <div className="flex items-center gap-2">
                    <DIcon name={KIND_ICON[kind]} className="h-[18px] w-[18px] text-lp-accent-ink" />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-lp-ink">{elementName(el, c, labelOf, t)}</span>
                    <span className="text-[12px] font-bold text-lp-ink-3">{t(`ed.kind.${kind}`)}</span>
                </div>
            </Sec>

            {el.type === "text" && <TextSection t={t} lang={lang} doc={doc} el={el as TextElement} update={update} fields={fields} focusText={focusText} />}
            {el.type === "barcode" && <BarcodeSection t={t} el={el as BarcodeElement} update={update} barcodeTemplates={barcodeTemplates} fields={fields} />}
            {el.type === "rect" && <RectSection t={t} lang={lang} c={c} el={el as RectElement} update={update} line={kind === "line"} />}
            {el.type === "table" && <TableSection t={t} lang={lang} c={c} el={el as TableElement} update={update} />}
            {el.type === "image" && (
                <Sec title={t("ed.kind.image")}>
                    <button type="button" onClick={onReplaceImage} className="flex min-h-[36px] items-center gap-2 self-start rounded-[10px] border border-lp-line-2 bg-lp-surface px-3 text-[13px] font-extrabold text-lp-ink transition hover:bg-lp-raised">
                        <DIcon name="upload" className="h-4 w-4" />
                        {t("ed.imageReplace")}
                    </button>
                    <ImageRatio t={t} el={el as ImageElement} update={update} />
                    <Note tone="info">{t("ed.imageNote")}</Note>
                </Sec>
            )}

            <Sec title={t("ed.placeMm")}>
                <div className="grid grid-cols-4 gap-1.5">
                    {(["x", "y", "w", "h"] as const).map((key) => (
                        <Labeled key={key} id={`i-${key}`} label={t(`ed.axis.${key}`)}>
                            <NumField
                                id={`i-${key}`}
                                lang={lang}
                                value={mm(el[key])}
                                min={key === "w" || key === "h" ? 0.1 : undefined}
                                step={0.5}
                                onCommit={(v) => update({ [key]: fromMm(v, c) } as Partial<LabelElement>)}
                                className="px-1.5 text-[12px]"
                            />
                        </Labeled>
                    ))}
                </div>
                <Seg
                    label={t("ed.rotation")}
                    size="sm"
                    value={turn}
                    onChange={(deg) => update({ rotation: deg })}
                    options={QUARTER_TURNS.map((deg) => ({ value: deg, label: `${deg}°` }))}
                />
                {turn === null && <Note tone="warn">{t("ed.rotationOdd", { deg: fmt(el.rotation, lang) })}</Note>}
            </Sec>

            <Sec>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button type="button" className={linkButton} onClick={onDuplicate}>{t("ed.duplicate")}</button>
                    <button type="button" className={cx(linkButton, "flex items-center gap-1")} onClick={() => onLayer("up")} title={t("ed.layerUpHint")}>
                        <DIcon name="up" className="h-3.5 w-3.5" />{t("ed.layerUp")}
                    </button>
                    <button type="button" className={cx(linkButton, "flex items-center gap-1")} onClick={() => onLayer("down")} title={t("ed.layerDownHint")}>
                        <DIcon name="down" className="h-3.5 w-3.5" />{t("ed.layerDown")}
                    </button>
                    <button type="button" className={cx(dangerLink, "ml-auto")} onClick={onDelete}>{t("ed.delete")}</button>
                </div>
            </Sec>
        </>
    );
}

function FieldPicker({ t, fields, onPick }: { t: T; fields: FieldDef[]; onPick: (key: string) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);
    return (
        <div ref={ref} className="relative">
            <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={cx(linkButton, "flex items-center gap-1 whitespace-nowrap")}>
                <DIcon name="plus" className="h-3.5 w-3.5" />
                {t("ed.insertField")}
            </button>
            {open && (
                <div role="menu" className="lp-card absolute right-0 top-7 z-40 flex max-h-[280px] w-[230px] flex-col overflow-y-auto p-1.5">
                    {fields.map((field) => (
                        <button
                            key={field.key}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                onPick(field.key);
                                setOpen(false);
                            }}
                            className="flex min-h-[34px] flex-col justify-center rounded-[8px] px-2 text-left hover:bg-lp-raised"
                        >
                            <span className="truncate text-[13px] font-bold text-lp-ink">{field.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function TextSection({ t, lang, doc, el, update, fields, focusText }: { t: T; lang: string; doc: LabelDoc; el: TextElement; update: Props["update"]; fields: FieldDef[]; focusText: number }) {
    const c = doc.canvas;
    const area = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (focusText > 0 && area.current) {
            area.current.focus();
            area.current.select();
        }
    }, [focusText]);

    const insert = (key: string) => {
        const node = area.current;
        const token = `{{ ${key} }}`;
        const start = node?.selectionStart ?? el.text.length;
        const end = node?.selectionEnd ?? el.text.length;
        const next = el.text.slice(0, start) + token + el.text.slice(end);
        update({ text: next } as Partial<TextElement>);
        requestAnimationFrame(() => {
            node?.focus();
            node?.setSelectionRange(start + token.length, start + token.length);
        });
    };

    const pt = toPt(el.fontSize, c);
    const family = el.fontFamily || "Inter";
    const printable = PRINT_FONTS.some((f) => f.toLowerCase() === family.toLowerCase());
    const mandatory = isEuChecked(doc) && isMandatoryText(el);
    const size = textSize(el, c);
    const x = fmt(xHeightMm(el, c), lang, 2);
    const minPt = (xh: number) => fmt(Math.ceil((xh / (xHeightMm({ ...el, fontSize: fromPt(1, c) }, c))) * 2) / 2, lang);

    return (
        <>
            <Sec title={t("ed.kind.text")}>
                <label htmlFor="i-text" className="sr-only">{t("ed.textLabel")}</label>
                <textarea
                    id="i-text"
                    ref={area}
                    value={el.text}
                    onChange={(e) => update({ text: e.target.value } as Partial<TextElement>)}
                    rows={3}
                    className={cx(inputClass, "min-h-[64px] resize-y py-2 font-mono text-[12px] font-medium leading-relaxed")}
                />
                <div className="flex items-start gap-2">
                    <span className="flex-1 text-[12px] leading-snug text-lp-ink-3">{t("ed.textHint")}</span>
                    <FieldPicker t={t} fields={fields} onPick={insert} />
                </div>
            </Sec>
            <Sec title={t("ed.font")}>
                <div className="grid grid-cols-2 gap-2">
                    <Labeled id="i-font" label={t("ed.fontFamily")}>
                        <select id="i-font" value={printable ? PRINT_FONTS.find((f) => f.toLowerCase() === family.toLowerCase()) : family} onChange={(e) => update({ fontFamily: e.target.value } as Partial<TextElement>)} className={inputClass}>
                            {!printable && <option value={family}>{family}</option>}
                            {PRINT_FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
                        </select>
                    </Labeled>
                    <Labeled id="i-size" label={t("ed.fontSizePt")}>
                        <NumField id="i-size" lang={lang} value={pt} min={2} max={200} step={0.5} onCommit={(v) => update({ fontSize: Math.round(fromPt(v, c) * 10) / 10 } as Partial<TextElement>)} />
                    </Labeled>
                </div>
                <Seg
                    label={t("ed.weight")}
                    size="sm"
                    value={(el.fontWeight || 400) >= 600 ? "bold" : "regular"}
                    onChange={(v) => update({ fontWeight: v === "bold" ? 700 : 400 } as Partial<TextElement>)}
                    options={[{ value: "regular", label: t("ed.regular") }, { value: "bold", label: t("ed.bold") }]}
                />
                <Seg
                    label={t("ed.align")}
                    size="sm"
                    value={el.textAlign || "left"}
                    onChange={(v) => update({ textAlign: v } as Partial<TextElement>)}
                    options={[{ value: "left", label: t("ed.alignLeft") }, { value: "center", label: t("ed.alignCenter") }, { value: "right", label: t("ed.alignRight") }]}
                />
                <label className="flex min-h-[30px] items-center gap-2 text-[13px] font-bold text-lp-ink">
                    <input type="checkbox" checked={el.textDecoration === "underline"} onChange={(e) => update({ textDecoration: e.target.checked ? "underline" : "none" } as Partial<TextElement>)} className="h-4 w-4 accent-[rgb(var(--lp-accent))]" />
                    {t("ed.underline")}
                </label>
                {!printable && <Note tone="warn">{t("ed.fontNotPrinted", { font: family })}</Note>}
                {mandatory && size === "ok" && <Note tone="ok">{t("ed.sizeOk", { pt: fmt(pt, lang), x })}</Note>}
                {mandatory && size === "smallPack" && <Note tone="info">{t("ed.sizeSmallPack", { pt: fmt(pt, lang), x, min: minPt(MIN_X_HEIGHT_MM) })}</Note>}
                {mandatory && size === "tooSmall" && <Note tone="warn">{t("ed.sizeTooSmall", { pt: fmt(pt, lang), x, min: minPt(MIN_X_HEIGHT_MM), minSmall: minPt(MIN_X_HEIGHT_SMALL_PACK_MM) })}</Note>}
            </Sec>
            {COUNTER.test(el.text) && (
                <Sec title={t("ed.counter")}>
                    <Labeled id="i-len" label={t("ed.counterLength")}>
                        <NumField id="i-len" lang={lang} digits={0} value={el.minLength || 0} min={0} max={50} onCommit={(v) => update({ minLength: v > 0 ? Math.round(v) : undefined } as Partial<TextElement>)} />
                    </Labeled>
                </Sec>
            )}
        </>
    );
}

function BarcodeSection({ t, el, update, barcodeTemplates, fields }: { t: T; el: BarcodeElement; update: Props["update"]; barcodeTemplates: BarcodeTemplate[]; fields: FieldDef[] }) {
    const current = barcodeTemplates.find((tpl) => (el.templateId ? tpl.id === el.templateId : tpl.name === el.barcodeType));
    return (
        <Sec title={t("ed.kind.barcode")}>
            {barcodeTemplates.length === 0 ? (
                <Note tone="warn">{t("ed.noBarcodeTemplates")}</Note>
            ) : (
                <Labeled id="i-bc" label={t("ed.barcodeTemplate")}>
                    <select
                        id="i-bc"
                        value={current ? String(current.id) : ""}
                        onChange={(e) => {
                            const tpl = barcodeTemplates.find((b) => String(b.id) === e.target.value);
                            if (tpl) update({ barcodeType: tpl.name, templateId: tpl.id, imageData: undefined, error: undefined } as Partial<BarcodeElement>);
                        }}
                        className={inputClass}
                    >
                        {!current && <option value="">{el.barcodeType}</option>}
                        {barcodeTemplates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
                    </select>
                </Labeled>
            )}
            <Labeled id="i-bcv" label={t("ed.barcodeValue")}>
                <div className="flex items-center gap-2">
                    <input id="i-bcv" value={el.value} onChange={(e) => update({ value: e.target.value, imageData: undefined } as Partial<BarcodeElement>)} className={cx(inputClass, "font-mono text-[12px] font-medium")} />
                    <FieldPicker t={t} fields={fields} onPick={(key) => update({ value: `{{ ${key} }}`, imageData: undefined } as Partial<BarcodeElement>)} />
                </div>
            </Labeled>
            <label className="flex min-h-[30px] items-center gap-2 text-[13px] font-bold text-lp-ink">
                <input type="checkbox" checked={el.showText} onChange={(e) => update({ showText: e.target.checked } as Partial<BarcodeElement>)} className="h-4 w-4 accent-[rgb(var(--lp-accent))]" />
                {t("ed.showDigits")}
            </label>
            {el.error ? <Note tone="warn">{t("ed.barcodeError", { error: el.error })}</Note> : <Note tone="info">{t("ed.barcodeNote")}</Note>}
        </Sec>
    );
}

function RectSection({ t, lang, c, el, update, line }: { t: T; lang: string; c: CanvasConfig; el: RectElement; update: Props["update"]; line: boolean }) {
    const filled = !!el.fill && el.fill !== "transparent" && el.fill.toLowerCase() !== "#ffffff";
    if (line) {
        const horizontal = el.w >= el.h;
        return (
            <Sec title={t("ed.kind.line")}>
                <Labeled id="i-thick" label={t("ed.thicknessMm")}>
                    <NumField id="i-thick" lang={lang} digits={2} step={0.1} min={0.1} max={1.5} value={toMm(horizontal ? el.h : el.w, c)} onCommit={(v) => update((horizontal ? { h: fromMm(v, c) } : { w: fromMm(v, c) }) as Partial<RectElement>)} />
                </Labeled>
            </Sec>
        );
    }
    return (
        <Sec title={t("ed.kind.frame")}>
            <Labeled id="i-border" label={t("ed.borderMm")}>
                <NumField id="i-border" lang={lang} digits={2} step={0.1} min={0} max={10} value={toMm(el.borderWidth, c)} onCommit={(v) => update({ borderWidth: Math.round(fromMm(v, c) * 10) / 10 } as Partial<RectElement>)} />
            </Labeled>
            <Seg
                label={t("ed.fill")}
                size="sm"
                value={filled ? "black" : "none"}
                onChange={(v) => update({ fill: v === "black" ? "#000000" : "transparent" } as Partial<RectElement>)}
                options={[{ value: "none", label: t("ed.fillNone") }, { value: "black", label: t("ed.fillBlack") }]}
            />
        </Sec>
    );
}

function ImageRatio({ t, el, update }: { t: T; el: ImageElement; update: Props["update"] }) {
    const [ratio, setRatio] = useState<number | null>(null);
    useEffect(() => {
        const img = new Image();
        img.onload = () => setRatio(img.naturalHeight / img.naturalWidth);
        img.src = el.src;
    }, [el.src]);
    if (!ratio || Math.abs(el.h / el.w - ratio) < 0.01) return null;
    return (
        <button type="button" className={cx(linkButton, "self-start")} onClick={() => update({ h: el.w * ratio } as Partial<ImageElement>)}>
            {t("ed.imageRatio")}
        </button>
    );
}

function TableSection({ t, lang, c, el, update }: { t: T; lang: string; c: CanvasConfig; el: TableElement; update: Props["update"] }) {
    const setColumns = (columns: TableElement["columns"]) => update({ columns } as Partial<TableElement>);
    return (
        <>
            <Sec title={t("ed.columns")}>
                <div className="flex flex-col gap-1.5">
                    {el.columns.map((col) => (
                        <div key={col.id} className="flex items-center gap-1">
                            <input
                                aria-label={t("ed.columnTitle")}
                                value={col.title}
                                onChange={(e) => setColumns(el.columns.map((x) => (x.id === col.id ? { ...x, title: e.target.value } : x)))}
                                className={cx(inputClass, "min-h-[32px] min-w-0 flex-1 px-2 text-[12px]")}
                            />
                            <select
                                aria-label={t("ed.columnData")}
                                value={col.key}
                                onChange={(e) => setColumns(el.columns.map((x) => (x.id === col.id ? { ...x, key: e.target.value } : x)))}
                                className={cx(inputClass, "min-h-[32px] w-[96px] flex-none px-1 text-[12px]")}
                            >
                                {TABLE_COLUMN_KEYS.map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
                            </select>
                            <input
                                aria-label={t("ed.columnWidth")}
                                title={t("ed.columnWidth")}
                                inputMode="numeric"
                                value={col.widthRatio}
                                onChange={(e) => setColumns(el.columns.map((x) => (x.id === col.id ? { ...x, widthRatio: Math.max(1, Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 1)) } : x)))}
                                className={cx(inputClass, "min-h-[32px] w-[42px] flex-none px-1 text-center font-mono text-[12px]")}
                            />
                            <button type="button" aria-label={t("ed.columnDelete")} title={t("ed.columnDelete")} onClick={() => setColumns(el.columns.filter((x) => x.id !== col.id))} className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] text-lp-ink-3 hover:bg-lp-bad-bg hover:text-lp-bad">
                                <DIcon name="trash" className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
                <button type="button" className={cx(linkButton, "flex items-center gap-1 self-start")} onClick={() => setColumns([...el.columns, { id: uid(), key: "name", title: t("designer.newColumn"), widthRatio: 15 }])}>
                    <DIcon name="plus" className="h-3.5 w-3.5" />{t("ed.columnAdd")}
                </button>
                <span className="text-[12px] text-lp-ink-3">{t("ed.columnsHint")}</span>
            </Sec>
            <Sec title={t("ed.tableRows")}>
                <div className="grid grid-cols-2 gap-2">
                    <Labeled id="i-group" label={t("designer.grouping")}>
                        <select id="i-group" value={el.groupBy} onChange={(e) => update({ groupBy: e.target.value } as Partial<TableElement>)} className={inputClass}>
                            <option value="none">{t("designer.none")}</option>
                            <option value="nomenclature">{t("designer.byProduct")}</option>
                            <option value="batch">{t("designer.byBatch")}</option>
                        </select>
                    </Labeled>
                    <Labeled id="i-sort" label={t("designer.sorting")}>
                        <select id="i-sort" value={el.sortBy} onChange={(e) => update({ sortBy: e.target.value } as Partial<TableElement>)} className={inputClass}>
                            <option value="none">{t("designer.none")}</option>
                            <option value="name">{t("designer.byName")}</option>
                            <option value="date">{t("designer.byDate")}</option>
                        </select>
                    </Labeled>
                </div>
                <Labeled id="i-rows" label={t("ed.maxRows")}>
                    <NumField id="i-rows" lang={lang} digits={0} value={el.maxRows || 0} min={0} max={100} onCommit={(v) => update({ maxRows: v > 0 ? Math.round(v) : undefined } as Partial<TableElement>)} />
                </Labeled>
            </Sec>
            <Sec title={t("ed.font")}>
                <div className="grid grid-cols-2 gap-2">
                    <Labeled id="i-tfont" label={t("ed.fontFamily")}>
                        <select id="i-tfont" value={el.fontFamily || "Inter"} onChange={(e) => update({ fontFamily: e.target.value } as Partial<TableElement>)} className={inputClass}>
                            {!PRINT_FONTS.includes(el.fontFamily || "Inter") && <option value={el.fontFamily}>{el.fontFamily}</option>}
                            {PRINT_FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
                        </select>
                    </Labeled>
                    <Labeled id="i-tsize" label={t("ed.fontSizePt")}>
                        <NumField id="i-tsize" lang={lang} value={toPt(el.fontSize, c)} min={2} max={72} step={0.5} onCommit={(v) => update({ fontSize: Math.round(fromPt(v, c) * 10) / 10 } as Partial<TableElement>)} />
                    </Labeled>
                </div>
                <div className="flex flex-wrap gap-x-5">
                    <label className="flex min-h-[30px] items-center gap-2 text-[13px] font-bold text-lp-ink">
                        <input type="checkbox" checked={el.showHeaders} onChange={(e) => update({ showHeaders: e.target.checked } as Partial<TableElement>)} className="h-4 w-4 accent-[rgb(var(--lp-accent))]" />
                        {t("designer.headers")}
                    </label>
                    <label className="flex min-h-[30px] items-center gap-2 text-[13px] font-bold text-lp-ink">
                        <input type="checkbox" checked={el.showBorders} onChange={(e) => update({ showBorders: e.target.checked } as Partial<TableElement>)} className="h-4 w-4 accent-[rgb(var(--lp-accent))]" />
                        {t("designer.borders")}
                    </label>
                </div>
            </Sec>
        </>
    );
}

function LabelInspector({ t, lang, doc, setDoc }: Props) {
    const c = doc.canvas;
    const type = labelType(doc);
    const size = sizeMm(c);
    const setSize = (side: "w" | "h", value: number) => setDoc((d) => {
        const cm = Math.max(1, Math.min(1000, value)) / 10;
        return side === "w"
            ? { ...d, canvas: { ...d.canvas, widthCm: cm, width: cmToPx(cm, d.canvas.dpi) } }
            : { ...d, canvas: { ...d.canvas, heightCm: cm, height: cmToPx(cm, d.canvas.dpi) } };
    });
    const setZones = (zones: (list: PrintedZone[]) => PrintedZone[]) => setDoc((d) => ({ ...d, canvas: { ...d.canvas, printedZones: zones(d.canvas.printedZones) } }));
    return (
        <>
            <Sec>
                <div className="flex items-center gap-2">
                    <TypeChip type={type}>{t(`tpl.type.${type}`)}</TypeChip>
                    <span className="text-[15px] font-extrabold text-lp-ink">{t("ed.label")}</span>
                </div>
                <span className="text-[12px] leading-snug text-lp-ink-3">{t("ed.labelHint")}</span>
            </Sec>
            <Sec title={t("ed.labelType")}>
                <Seg
                    label={t("ed.labelType")}
                    size="sm"
                    value={type}
                    onChange={(v) => setDoc((d) => ({ ...d, canvas: { ...d.canvas, labelType: v } }))}
                    options={LTYPES.map((v) => ({ value: v, label: t(`tpl.type.${v}`) }))}
                />
                <span className="text-[12px] leading-snug text-lp-ink-3">{t(`ed.typeHint.${type}`)}</span>
            </Sec>
            <Sec title={t("ed.sizeMm")}>
                <div className="grid grid-cols-2 gap-2">
                    <Labeled id="l-w" label={t("tpl.widthMm")}>
                        <NumField id="l-w" lang={lang} value={size.w} min={10} max={1000} step={1} onCommit={(v) => setSize("w", v)} />
                    </Labeled>
                    <Labeled id="l-h" label={t("tpl.heightMm")}>
                        <NumField id="l-h" lang={lang} value={size.h} min={10} max={1000} step={1} onCommit={(v) => setSize("h", v)} />
                    </Labeled>
                </div>
            </Sec>
            <Sec title={t("ed.printer")}>
                <Seg
                    label={t("ed.dpi")}
                    size="sm"
                    value={PRINT_DPI.includes(c.dpi) ? c.dpi : null}
                    onChange={(dpi) => setDoc((d) => withDpi(d, dpi))}
                    options={PRINT_DPI.map((dpi) => ({ value: dpi, label: `${dpi} dpi` }))}
                />
                <span className="text-[12px] leading-snug text-lp-ink-3">{t("ed.dpiHint")}</span>
            </Sec>
            <Sec title={t("ed.zones")}>
                <span className="text-[12px] leading-snug text-lp-ink-3">{t("ed.zonesHint")}</span>
                {c.printedZones.map((zone, i) => (
                    <div key={zone.id} className="flex flex-col gap-2 rounded-[12px] border border-lp-line bg-lp-surface/70 p-2.5">
                        <div className="flex items-center gap-2">
                            <span className="h-3 w-3 flex-none rounded-[3px]" style={{ background: zone.color }} aria-hidden="true" />
                            <input aria-label={t("ed.zoneName", { n: i + 1 })} value={zone.label} onChange={(e) => setZones((list) => list.map((z) => (z.id === zone.id ? { ...z, label: e.target.value } : z)))} className={cx(inputClass, "min-h-[32px] flex-1 text-[12px]")} />
                            <button type="button" aria-label={t("ed.zoneDelete", { name: zone.label })} onClick={() => setZones((list) => list.filter((z) => z.id !== zone.id))} className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] text-lp-ink-3 hover:bg-lp-bad-bg hover:text-lp-bad">
                                <DIcon name="trash" className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)_72px_36px] items-end gap-1.5">
                            <Labeled id={`z-side-${zone.id}`} label={t("ed.zoneSide")}>
                                <select id={`z-side-${zone.id}`} value={zone.side} onChange={(e) => setZones((list) => list.map((z) => (z.id === zone.id ? { ...z, side: e.target.value as PrintedZone["side"] } : z)))} className={cx(inputClass, "min-h-[32px] text-[12px]")}>
                                    {(["top", "bottom", "left", "right"] as const).map((side) => <option key={side} value={side}>{t(`ed.side.${side}`)}</option>)}
                                </select>
                            </Labeled>
                            <Labeled id={`z-size-${zone.id}`} label={t("ed.zoneMm")}>
                                <NumField id={`z-size-${zone.id}`} lang={lang} value={zone.sizeMm} min={0} max={500} step={0.5} onCommit={(v) => setZones((list) => list.map((z) => (z.id === zone.id ? { ...z, sizeMm: v } : z)))} className="min-h-[32px] text-[12px]" />
                            </Labeled>
                            <input type="color" aria-label={t("ed.zoneColor")} title={t("ed.zoneColor")} value={zone.color} onChange={(e) => setZones((list) => list.map((z) => (z.id === zone.id ? { ...z, color: e.target.value } : z)))} className="h-8 w-9 cursor-pointer rounded-[8px] border border-lp-line-2 bg-lp-surface p-0.5" />
                        </div>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => setZones((list) => [...list, { id: uid(), label: t("designer.zoneHeader"), side: "top", sizeMm: 10, color: "#1e40af" }])}
                    className="flex min-h-[36px] items-center gap-1.5 self-start rounded-[10px] border border-lp-line-2 bg-lp-surface px-3 text-[13px] font-extrabold text-lp-ink transition hover:bg-lp-raised"
                >
                    <DIcon name="plus" className="h-4 w-4" />
                    {t("ed.zoneAdd")}
                </button>
            </Sec>
        </>
    );
}
