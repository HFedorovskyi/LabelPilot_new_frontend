"use client";

// Left panel of the editor: the product fields one click puts on the label (and which are
// already there), and the layers with a show/hide eye.

import React from "react";
import type { BarcodeElement, CanvasConfig, LabelElement, TextElement } from "@/lib/label/types";
import { fieldKeys } from "@/lib/label/eu";
import { cx } from "../stations/shared";
import { FIELD_GROUPS, isLine, type FieldDef, type FieldGroup, type T } from "./model";
import { DIcon, type DIconName } from "./ui";

const GROUP_ICON: Record<FieldGroup, DIconName> = { product: "tag", dates: "calendar", weight: "scale", trace: "hash" };

export type ElementKind = "text" | "barcode" | "frame" | "line" | "table" | "image";

export function elementKind(el: LabelElement, canvas: CanvasConfig): ElementKind {
    if (el.type === "rect") return isLine(el, canvas) ? "line" : "frame";
    return el.type as ElementKind;
}

export const KIND_ICON: Record<ElementKind, DIconName> = { text: "text", barcode: "barcode", frame: "frame", line: "line", table: "table", image: "image" };

/** What a person calls an element: its fields ("Масса нетто"), its text, or its kind. */
export function elementName(el: LabelElement, canvas: CanvasConfig, labelOf: Map<string, string>, t: T): string {
    if (el.type === "text") {
        const text = (el as TextElement).text;
        const keys = fieldKeys(text);
        if (keys.length > 0) return keys.map((key) => labelOf.get(key) ?? key).join(" + ");
        return text.trim().replace(/\s+/g, " ") || t("ed.kind.text");
    }
    if (el.type === "barcode") return `${t("ed.kind.barcode")} · ${(el as BarcodeElement).barcodeType}`;
    return t(`ed.kind.${elementKind(el, canvas)}`);
}

export default function FieldsPanel({ t, tab, onTab, fields, used, onAdd, onShow, elements, canvas, labelOf, hidden, selectedId, onSelect, onToggle }: {
    t: T;
    tab: "fields" | "layers";
    onTab: (tab: "fields" | "layers") => void;
    fields: FieldDef[];
    used: Set<string>;
    onAdd: (field: FieldDef) => void;
    onShow: (key: string) => void;
    elements: LabelElement[];
    canvas: CanvasConfig;
    labelOf: Map<string, string>;
    hidden: Set<string>;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onToggle: (id: string) => void;
}) {
    return (
        <aside aria-label={t("ed.panelLabel")} className="lp-glass flex w-[262px] flex-none flex-col overflow-hidden rounded-[20px]">
            <div role="tablist" className="m-2.5 flex gap-0.5 rounded-[11px] bg-lp-ink/[0.05] p-[3px]">
                {(["fields", "layers"] as const).map((id) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        onClick={() => onTab(id)}
                        className={cx(
                            "flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-[8px] text-[13px] font-extrabold transition",
                            tab === id ? "bg-lp-surface text-lp-ink shadow-[0_1px_3px_rgba(16,24,40,.12)]" : "text-lp-ink-3 hover:text-lp-ink",
                        )}
                    >
                        {t(id === "fields" ? "ed.tabFields" : "ed.tabLayers")}
                        {id === "layers" && <span className="font-mono text-[12px] text-lp-ink-3">{elements.length}</span>}
                    </button>
                ))}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pb-3">
                {tab === "fields" ? (
                    <>
                        <p className="m-0 px-1 text-[12px] leading-snug text-lp-ink-3">{t("ed.fieldsHint")}</p>
                        {FIELD_GROUPS.map((group) => {
                            const list = fields.filter((f) => f.group === group);
                            if (list.length === 0) return null;
                            return (
                                <div key={group} className="flex flex-col gap-0.5">
                                    <span className="px-1 pb-0.5 pt-1.5 text-[12px] font-extrabold text-lp-ink-3">{t(`ed.group.${group}`)}</span>
                                    {list.map((field) => {
                                        const on = used.has(field.key);
                                        return (
                                            <button
                                                key={field.key}
                                                type="button"
                                                onClick={() => (on ? onShow(field.key) : onAdd(field))}
                                                title={on ? t("ed.fieldShow") : t("ed.fieldAdd")}
                                                className="group flex min-h-[38px] w-full items-center gap-2.5 rounded-[10px] border border-transparent px-2 text-left text-[13px] font-bold text-lp-ink transition hover:border-lp-line hover:bg-lp-surface"
                                            >
                                                <span className={cx("flex h-6 w-6 flex-none items-center justify-center rounded-[7px]", on ? "bg-lp-ok-bg text-lp-ok" : "bg-lp-accent-bg text-lp-accent-ink")}>
                                                    <DIcon name={GROUP_ICON[group]} className="h-3.5 w-3.5" />
                                                </span>
                                                <span className="min-w-0 flex-1 truncate">{field.label}</span>
                                                {on ? (
                                                    <span className="flex-none whitespace-nowrap text-[12px] font-extrabold text-lp-ok">✓ {t("ed.fieldOn")}</span>
                                                ) : (
                                                    <span className="flex-none whitespace-nowrap text-[12px] font-extrabold text-lp-accent-ink opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">+ {t("ed.fieldAddShort")}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </>
                ) : elements.length === 0 ? (
                    <p className="m-0 px-1 py-6 text-center text-[13px] text-lp-ink-3">{t("ed.noLayers")}</p>
                ) : (
                    <div className="flex flex-col gap-0.5">
                        {[...elements].reverse().map((el) => {
                            const kind = elementKind(el, canvas);
                            const off = hidden.has(el.id);
                            const name = elementName(el, canvas, labelOf, t);
                            return (
                                <div key={el.id} className={cx("flex min-h-[38px] items-center gap-2 rounded-[10px] pl-2 pr-1 text-[13px] font-bold", el.id === selectedId ? "bg-lp-accent-bg text-lp-accent-ink" : "text-lp-ink")}>
                                    <DIcon name={KIND_ICON[kind]} className="h-4 w-4 text-lp-ink-3" />
                                    <button type="button" onClick={() => onSelect(el.id)} title={name} className={cx("min-w-0 flex-1 truncate text-left", off && "text-lp-ink-3 line-through")}>
                                        {name}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onToggle(el.id)}
                                        aria-label={t(off ? "ed.layerShow" : "ed.layerHide", { name })}
                                        title={t(off ? "ed.layerShow" : "ed.layerHide", { name })}
                                        className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] text-lp-ink-3 transition hover:bg-lp-surface hover:text-lp-ink"
                                    >
                                        <DIcon name={off ? "eyeOff" : "eye"} className="h-4 w-4" />
                                    </button>
                                </div>
                            );
                        })}
                        <p className="m-0 px-1 pt-2 text-[12px] leading-snug text-lp-ink-3">{t("ed.layersHint")}</p>
                    </div>
                )}
            </div>
        </aside>
    );
}
