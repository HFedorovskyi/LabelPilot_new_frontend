"use client";

// One product on its own page: a sticky bar (back to the list, the neighbours in it, save
// state, Save) and the product in cards on two columns. Leaving with unsaved changes asks
// first — inside the catalogue with a prompt, from the side menu through the leave guard.

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useTranslation, type Lang } from "@/lib/i18n";
import { setLeaveGuard } from "@/lib/navGuard";
import {
    isBoxTemplate, isPackTemplate, tolerableNegativeError,
    type Attribute, type Folder, type Pack, type Product, type Template,
} from "@/lib/products";
import { cx, whenText } from "@/app/components/stations/shared";
import { dangerLink, linkButton, primaryButton } from "@/app/components/print/shared";

type T = (key: string, params?: Record<string, string | number>) => string;
type Draft = {
    name: string;
    article: string;
    folder: string;
    days: string;
    perBox: string;
    fixed: boolean;
    grams: string;
    min: string;
    max: string;
    label: string;
    boxLabel: string;
    pack: string;
    box: string;
    extra: Record<string, string>;
};
type Target = "back" | "fields" | "copy" | number;

export type Position = { index: number; total: number; prevId: number | null; nextId: number | null };

type Props = {
    /** null: a new product. */
    product: Product | null;
    /** A new product filled from this one ("Create a copy"). */
    copyOf?: Product;
    products: Product[];
    folders: Folder[];
    attributes: Attribute[];
    packs: Pack[];
    templates: Template[];
    defaultFolder: number | null;
    /** Where the product sits in the list as filtered; null when it is not in it. */
    position: Position | null;
    /** true: changed after a station last got the data; null: no station takes data. */
    behindStations: boolean | null;
    onBack: () => void;
    onOpen: (id: number) => void;
    onCopy: (product: Product) => void;
    onFields: () => void;
    onSaved: (product: Product, created: boolean) => void;
    onDeleted: (product: Product) => void;
};

const text = (n: number | null | undefined) => (n == null || n === 0 ? "" : String(n));
const ref = (n: number | null) => (n == null ? "" : String(n));
const num = (s: string) => Number.parseFloat(s.replace(",", ".")) || 0;
const digits = (s: string) => s.replace(/\D/g, "");
const decimal = (s: string) => s.replace(/[^\d.,]/g, "");

function toDraft(product: Product | null | undefined, folder: number | null): Draft {
    if (!product) {
        return { name: "", article: "", folder: ref(folder), days: "", perBox: "", fixed: false, grams: "", min: "", max: "", label: "", boxLabel: "", pack: "", box: "", extra: {} };
    }
    const extra: Record<string, string> = {};
    for (const [key, value] of Object.entries(product.extra_data ?? {})) if (value != null) extra[key] = String(value);
    return {
        name: product.name, article: product.article, folder: ref(product.folder),
        days: text(product.exp_date), perBox: text(product.close_box_counter),
        fixed: product.is_fixed_weight, grams: text(product.fixed_weight_grams), min: text(product.min_weight_grams), max: text(product.max_weight_grams),
        label: ref(product.templates_pack_label), boxLabel: ref(product.templates_box_label), pack: ref(product.portion_container), box: ref(product.box_container),
        extra,
    };
}

function toPayload(draft: Draft, attributes: Attribute[]) {
    const extra_data: Record<string, string> = {};
    for (const attribute of attributes) {
        const value = (draft.extra[attribute.name] ?? "").trim();
        if (value) extra_data[attribute.name] = value;
    }
    const id = (s: string) => (s ? Number(s) : null);
    return {
        name: draft.name.trim(),
        article: draft.article.trim(),
        exp_date: Number.parseInt(draft.days, 10) || 0,
        close_box_counter: Number.parseInt(draft.perBox, 10) || 0,
        is_fixed_weight: draft.fixed,
        fixed_weight_grams: draft.fixed ? num(draft.grams) : 0,
        min_weight_grams: draft.fixed ? num(draft.min) : 0,
        max_weight_grams: draft.fixed ? num(draft.max) : 0,
        portion_container: id(draft.pack),
        box_container: id(draft.box),
        templates_pack_label: id(draft.label),
        templates_box_label: id(draft.boxLabel),
        folder: id(draft.folder),
        extra_data,
    };
}

function problem(draft: Draft, self: Product | null, products: Product[], t: T): string | null {
    const article = draft.article.trim();
    if (!draft.name.trim()) return t("prd.v.name");
    if (!article) return t("prd.v.article");
    if (products.some((p) => p.article === article && p.id !== self?.id)) return t("prd.v.articleTaken", { article });
    if (!(Number.parseInt(draft.days, 10) > 0)) return t("prd.v.days");
    if (!(Number.parseInt(draft.perBox, 10) > 0)) return t("prd.v.perBox");
    if (draft.fixed) {
        const grams = num(draft.grams);
        if (!(grams > 0)) return t("prd.v.grams");
        if (draft.min && num(draft.min) > grams) return t("prd.v.min");
        if (draft.max && num(draft.max) < grams) return t("prd.v.max");
    }
    return null;
}

const input = "min-h-[44px] w-full rounded-[10px] border border-lp-line-2 bg-lp-surface px-3 text-[14px] text-lp-ink outline-none focus:border-lp-accent";
const labelCls = "text-[12px] font-bold text-lp-ink-3";
const card = "flex flex-col gap-3 lp-card px-[18px] py-4";

export default function ProductPage(props: Props) {
    const { product, copyOf, products, folders, attributes, packs, templates, position, behindStations } = props;
    const { t, lang } = useTranslation();
    const initial = useMemo(
        () => (copyOf ? { ...toDraft(copyOf, null), name: t("prd.copyName", { name: copyOf.name }), article: "" } : toDraft(product, props.defaultFolder)),
        // The page is keyed by product: the draft starts once per product.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const [base, setBase] = useState<Draft>(initial);
    const [draft, setDraft] = useState<Draft>(initial);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState<Target | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [busy, setBusy] = useState(false);
    const dirty = JSON.stringify(draft) !== JSON.stringify(base);
    const change = (patch: Partial<Draft>) => {
        setDraft((d) => ({ ...d, ...patch }));
        setSaved(false);
    };

    useEffect(() => {
        if (!dirty) return;
        setLeaveGuard(() => window.confirm(t("prd.leaveConfirm")));
        const onUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", onUnload);
        return () => {
            setLeaveGuard(null);
            window.removeEventListener("beforeunload", onUnload);
        };
    }, [dirty, t]);

    const go = (target: Target, current: Product | null = product) => {
        if (target === "back") props.onBack();
        else if (target === "fields") props.onFields();
        else if (target === "copy") { if (current) props.onCopy(current); }
        else props.onOpen(target);
    };
    const nav = (target: Target) => (dirty ? setPending(target) : go(target));

    const save = async (): Promise<Product | null> => {
        const reason = problem(draft, product, products, t);
        if (reason) {
            setError(reason);
            setPending(null);
            return null;
        }
        setBusy(true);
        setError(null);
        try {
            const body = toPayload(draft, attributes);
            const result: Product = product ? await api.nomenclature.update(product.id, body) : await api.nomenclature.create(body);
            setBase(draft);
            setSaved(true);
            props.onSaved(result, product === null);
            return result;
        } catch (e) {
            setError(t("prd.err", { message: e instanceof Error ? e.message : String(e) }));
            setPending(null);
            return null;
        } finally {
            setBusy(false);
        }
    };
    const saveAndGo = async () => {
        const target = pending;
        const result = await save();
        if (result && target !== null) {
            setPending(null);
            go(target, result);
        }
    };
    const remove = async () => {
        if (!product) return;
        setBusy(true);
        try {
            await api.nomenclature.delete(product.id);
            setBase(draft);
            props.onDeleted(product);
        } catch (e) {
            setError(t("prd.err", { message: e instanceof Error ? e.message : String(e) }));
            setBusy(false);
        }
    };

    const grams = num(draft.grams);
    const tne = Math.round(tolerableNegativeError(grams) * 10) / 10;
    const lower = Math.round((grams - tne) * 10) / 10;
    const fmt = (n: number) => new Intl.NumberFormat(lang as Lang, { maximumFractionDigits: 1 }).format(n);
    const folderName = draft.folder ? folders.find((f) => String(f.id) === draft.folder)?.name : null;
    const state = dirty
        ? { text: t("prd.state.dirty"), dot: "bg-lp-warn", ink: "text-lp-warn" }
        : !product
            ? { text: t("prd.state.new"), dot: "bg-lp-line-2", ink: "text-lp-ink-3" }
            : saved
                ? { text: t("prd.state.saved"), dot: "bg-lp-ok", ink: "text-lp-ok" }
                : { text: t("prd.state.clean"), dot: "bg-lp-ok", ink: "text-lp-ink-3" };
    const meta = product
        ? [
            t("prd.article", { article: product.article }),
            t("prd.edited", { when: whenText(product.edited, lang as Lang, t) }),
            behindStations === null ? null : behindStations ? t("prd.behind") : t("prd.upToDate"),
        ].filter(Boolean).join(" · ")
        : t("prd.newHint");
    const iconButton = "flex h-10 w-10 items-center justify-center rounded-[10px] border border-lp-line bg-lp-surface text-lp-ink-2 transition hover:bg-lp-raised disabled:cursor-not-allowed disabled:opacity-40";

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">
            <div className="lp-glass sticky top-0 z-10 flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-[18px] px-3 py-2.5">
                <button type="button" onClick={() => nav("back")} className="flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-lp-line bg-lp-surface pl-2 pr-3 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4"><path d="M15 6l-6 6 6 6" /></svg>
                    {t("nav.catalog")}
                </button>
                {position && (
                    <div role="group" aria-label={t("prd.neighbours")} className="flex items-center gap-1">
                        <button type="button" aria-label={t("prd.prev")} disabled={position.prevId === null} onClick={() => position.prevId !== null && nav(position.prevId)} className={iconButton}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4"><path d="M15 6l-6 6 6 6" /></svg>
                        </button>
                        <span className="min-w-[64px] text-center text-[13px] font-bold tabular-nums text-lp-ink-3">{t("prd.position", { n: position.index + 1, total: position.total })}</span>
                        <button type="button" aria-label={t("prd.next")} disabled={position.nextId === null} onClick={() => position.nextId !== null && nav(position.nextId)} className={iconButton}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4"><path d="M9 6l6 6-6 6" /></svg>
                        </button>
                    </div>
                )}
                <span role="status" className={cx("ml-auto flex items-center gap-2 text-[13px] font-bold", state.ink)}>
                    <span className={cx("h-2 w-2 rounded-full", state.dot)} />
                    {state.text}
                </span>
                <button type="button" onClick={() => void save()} disabled={busy || (product !== null && !dirty)} className={primaryButton}>
                    {product ? t("prd.save") : t("prd.add")}
                </button>
            </div>

            {pending !== null && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] bg-lp-warn-bg px-4 py-3">
                    <span className="font-extrabold text-lp-warn">▲ {t("prd.unsaved")}</span>
                    <button type="button" disabled={busy} onClick={() => void saveAndGo()} className="min-h-[38px] rounded-[10px] lp-btn-primary px-3.5 text-[14px] font-extrabold text-[#fff] transition hover:brightness-110 disabled:opacity-50">
                        {t("prd.saveAndGo")}
                    </button>
                    <button type="button" onClick={() => { const target = pending; setPending(null); setBase(draft); go(target); }} className={dangerLink}>{t("prd.discard")}</button>
                    <button type="button" onClick={() => setPending(null)} className={linkButton}>{t("prd.stay")}</button>
                </div>
            )}

            <div className="flex max-w-[760px] flex-col gap-1">
                <span className="text-[13px] font-bold text-lp-coral">{folderName ? t("prd.eyebrowFolder", { folder: folderName }) : t("prd.eyebrow")}</span>
                <h1 className="m-0 text-[clamp(26px,2.8vw,36px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-lp-ink">{product ? product.name : t("prd.new")}</h1>
                <p className="m-0 text-[14px] text-lp-ink-2">{meta}</p>
            </div>

            {!draft.label && <p className="m-0 rounded-[12px] bg-lp-warn-bg px-4 py-3 text-[14px] font-extrabold text-lp-warn">▲ {t("prd.noLabelHint")}</p>}
            {error && <p role="alert" className="m-0 rounded-[12px] bg-lp-bad-bg px-4 py-3 text-[14px] font-extrabold text-lp-bad">■ {error}</p>}

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] items-start gap-4">
                <div className="flex min-w-0 flex-col gap-4">
                    <section aria-labelledby="p-main" className={card}>
                        <h2 id="p-main" className="m-0 text-[16px] font-extrabold">{t("prd.s.main")}</h2>
                        <div className="flex flex-col gap-1">
                            <label htmlFor="p-name" className={labelCls}>{t("prd.f.name")}</label>
                            <input id="p-name" value={draft.name} onChange={(e) => change({ name: e.target.value })} placeholder={t("prd.f.namePlaceholder")} className={cx(input, "font-bold")} />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="flex flex-col gap-1">
                                <label htmlFor="p-article" className={labelCls}>{t("prd.f.article")}</label>
                                <input id="p-article" inputMode="numeric" value={draft.article} onChange={(e) => change({ article: digits(e.target.value) })} placeholder={t("prd.f.articlePlaceholder")} className={cx(input, "font-mono tabular-nums")} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="p-folder" className={labelCls}>{t("prd.f.folder")}</label>
                                <select id="p-folder" value={draft.folder} onChange={(e) => change({ folder: e.target.value })} className={cx(input, "px-2 font-semibold")}>
                                    <option value="">{t("prd.noFolder")}</option>
                                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="p-days" className={labelCls}>{t("prd.f.days")}</label>
                                <input id="p-days" inputMode="numeric" value={draft.days} onChange={(e) => change({ days: digits(e.target.value) })} className={cx(input, "font-bold tabular-nums")} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="p-box" className={labelCls}>{t("prd.f.perBox")}</label>
                                <input id="p-box" inputMode="numeric" value={draft.perBox} onChange={(e) => change({ perBox: digits(e.target.value) })} className={cx(input, "font-bold tabular-nums")} />
                            </div>
                        </div>
                    </section>

                    <section aria-labelledby="p-weight" className={card}>
                        <h2 id="p-weight" className="m-0 text-[16px] font-extrabold">{t("prd.s.weight")}</h2>
                        <div role="group" aria-label={t("prd.f.weighing")} className="flex gap-[3px] rounded-[11px] bg-lp-bg p-[3px]">
                            {[false, true].map((fixed) => (
                                <button
                                    key={String(fixed)}
                                    type="button"
                                    aria-pressed={draft.fixed === fixed}
                                    onClick={() => change({ fixed })}
                                    className={cx("min-h-[40px] flex-1 rounded-[9px] border-0 text-[13px] font-extrabold", draft.fixed === fixed ? "bg-lp-surface text-lp-ink shadow-sm" : "bg-transparent text-lp-ink-3")}
                                >
                                    {fixed ? t("prd.weight.fixed") : t("prd.weight.scaleLong")}
                                </button>
                            ))}
                        </div>
                        {!draft.fixed ? (
                            <span className="text-[14px] text-lp-ink-3">{t("prd.weight.scaleText")}</span>
                        ) : (
                            <>
                                <div className="grid grid-cols-3 gap-2.5">
                                    {([["grams", t("prd.f.grams")], ["min", t("prd.f.min")], ["max", t("prd.f.max")]] as const).map(([key, label]) => (
                                        <div key={key} className="flex flex-col gap-1">
                                            <label htmlFor={`p-${key}`} className={labelCls}>{label}</label>
                                            <input id={`p-${key}`} inputMode="decimal" value={draft[key]} onChange={(e) => change({ [key]: decimal(e.target.value) })} className={cx(input, "tabular-nums", key === "grams" ? "font-extrabold" : "font-bold")} />
                                        </div>
                                    ))}
                                </div>
                                {grams > 0 && (
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-lp-ink-2">
                                        <span>{t("prd.tne", { nominal: fmt(grams), tne: fmt(tne), lower: fmt(lower) })}</span>
                                        {num(draft.min) !== lower && (
                                            <button type="button" onClick={() => change({ min: String(lower) })} className={linkButton}>{t("prd.tneUse", { lower: fmt(lower) })}</button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    <section aria-labelledby="p-labels" className={card}>
                        <h2 id="p-labels" className="m-0 text-[16px] font-extrabold">{t("prd.s.labels")}</h2>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="flex flex-col gap-1">
                                <label htmlFor="p-label" className={labelCls}>{t("prd.f.label")}</label>
                                <select id="p-label" value={draft.label} onChange={(e) => change({ label: e.target.value })} className={cx(input, "px-2 font-semibold", !draft.label && "border-lp-warn")}>
                                    <option value="">{t("prd.f.notChosen")}</option>
                                    {templates.filter(isPackTemplate).map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="p-boxlabel" className={labelCls}>{t("prd.f.boxLabel")}</label>
                                <select id="p-boxlabel" value={draft.boxLabel} onChange={(e) => change({ boxLabel: e.target.value })} className={cx(input, "px-2 font-semibold")}>
                                    <option value="">{t("prd.f.notNeeded")}</option>
                                    {templates.filter(isBoxTemplate).map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="p-pack" className={labelCls}>{t("prd.f.pack")}</label>
                                <select id="p-pack" value={draft.pack} onChange={(e) => change({ pack: e.target.value })} className={cx(input, "px-2 font-semibold")}>
                                    <option value="">{t("prd.f.noTare")}</option>
                                    {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="p-boxpack" className={labelCls}>{t("prd.f.boxPack")}</label>
                                <select id="p-boxpack" value={draft.box} onChange={(e) => change({ box: e.target.value })} className={cx(input, "px-2 font-semibold")}>
                                    <option value="">{t("prd.f.noTare")}</option>
                                    {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                    <section aria-labelledby="p-extra" className={card}>
                        <div className="flex items-center gap-2.5">
                            <h2 id="p-extra" className="m-0 flex-1 text-[16px] font-extrabold">{t("prd.s.extra")}</h2>
                            <button type="button" onClick={() => nav("fields")} className={linkButton}>{t("prd.fieldsSetup")}</button>
                        </div>
                        {attributes.length === 0 && <span className="text-[14px] text-lp-ink-3">{t("prd.fieldsNoneHint")}</span>}
                        {attributes.map((attribute) => (
                            <div key={attribute.id} className="flex flex-col gap-1">
                                <label htmlFor={`p-x-${attribute.id}`} className={labelCls}>{attribute.name}</label>
                                <textarea
                                    id={`p-x-${attribute.id}`}
                                    rows={4}
                                    value={draft.extra[attribute.name] ?? ""}
                                    onChange={(e) => change({ extra: { ...draft.extra, [attribute.name]: e.target.value } })}
                                    className="resize-y rounded-[10px] border border-lp-line-2 bg-lp-surface px-3 py-2.5 text-[14px] leading-[1.45] text-lp-ink outline-none focus:border-lp-accent"
                                />
                            </div>
                        ))}
                    </section>
                    {product && (
                        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 px-1">
                            {confirmDelete ? (
                                <>
                                    <span className="text-[13px] font-extrabold">{t("prd.confirmDelete", { name: product.name })}</span>
                                    <button type="button" disabled={busy} onClick={() => void remove()} className={dangerLink}>{t("prd.yesDelete")}</button>
                                    <button type="button" onClick={() => setConfirmDelete(false)} className={linkButton}>{t("prd.no")}</button>
                                </>
                            ) : (
                                <>
                                    <button type="button" onClick={() => nav("copy")} className={linkButton}>{t("prd.copy")}</button>
                                    <button type="button" onClick={() => setConfirmDelete(true)} className={dangerLink}>{t("prd.deleteProduct")}</button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
