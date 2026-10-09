"use client";

// One barcode template: the parts it is made of (a live strip that counts digits, the
// parts as rows) and how it comes out for a product (the server's picture, the data
// and a plain-language check).

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { setLeaveGuard } from "@/lib/navGuard";
import { cx } from "../stations/shared";
import { linkButton, primaryButton } from "../print/shared";
import {
    AI_CODES, ALL_KINDS, charsOf, DATE_FORMATS, DATE_KINDS, decimalsOf, DEFAULT_DATE_FORMAT, defaultLength, digitsOf, ean13Check, GS1_ONLY, hasLength,
    isGs1, isVariable, KIND_GROUPS, maxWeightKg, problemsOf, splitData, SYMBOLOGIES, SYMBOLOGY_LABEL, WEIGHT_KINDS,
    type BarcodeField, type BarcodeStructure, type BarcodeTemplate, type T,
} from "./model";
import { BarcodePicture, useBarcodePreview } from "./preview";

export type Draft = { id: number | null; name: string; structure: BarcodeStructure };

const inputCls = "min-h-[36px] w-full rounded-[9px] border border-lp-line-2 bg-lp-surface px-2.5 text-[13px] font-bold text-lp-ink outline-none transition focus:border-lp-accent";

export default function BarcodeEditor({ t, lang, draft, templates, extraNames, products, usedBy, notice, onBack, onSaved }: {
    t: T;
    lang: string;
    draft: Draft;
    templates: BarcodeTemplate[];
    extraNames: string[];
    products: Array<{ id: number; name: string; article?: string }>;
    /** Label templates this barcode is on. */
    usedBy: number;
    /** A note from creating it, e.g. a product field that was added. */
    notice?: string | null;
    onBack: () => void;
    onSaved: (template: BarcodeTemplate, isNew: boolean) => void;
}) {
    const [name, setName] = useState(draft.name);
    const [structure, setStructure] = useState<BarcodeStructure>(draft.structure);
    const [sel, setSel] = useState(0);
    const [productId, setProductId] = useState(() => (products[0] ? String(products[0].id) : ""));
    const [addOpen, setAddOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const type = structure.barcode_type;
    const fields = structure.fields;
    const problems = useMemo(() => problemsOf(structure), [structure]);
    const { preview, loading } = useBarcodePreview(problems.length === 0 ? { ...structure, barcode_name: name } : null, productId, 350);
    const dirty = name !== draft.name || JSON.stringify(structure) !== JSON.stringify(draft.structure);

    useEffect(() => {
        if (!dirty) return;
        setLeaveGuard(() => window.confirm(t("bc.leaveConfirm")));
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

    const setFields = (next: BarcodeField[]) => setStructure((s) => ({ ...s, fields: next }));
    const update = (i: number, patch: Partial<BarcodeField>) => setFields(fields.map((f, j) => (j === i ? clean({ ...f, ...patch }) : f)));
    const move = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= fields.length) return;
        const next = [...fields];
        [next[i], next[j]] = [next[j], next[i]];
        setFields(next);
        setSel(j);
    };
    const add = (kind: string) => {
        setFields([...fields, newField(kind, extraNames)]);
        setSel(fields.length);
        setAddOpen(false);
    };
    const setType = (next: string) => setStructure((s) => ({ ...s, barcode_type: next, fields: isGs1(next) ? s.fields : s.fields.filter((f) => !GS1_ONLY.includes(f.field_type)) }));

    const back = () => {
        if (dirty && !window.confirm(t("bc.leaveConfirm"))) return;
        onBack();
    };

    const save = async () => {
        const trimmed = name.trim();
        if (!trimmed) return setError(t("bc.nameRequired"));
        if (templates.some((tpl) => tpl.id !== draft.id && tpl.name.trim().toLowerCase() === trimmed.toLowerCase())) return setError(t("bc.nameTaken"));
        if (problems.length > 0) return setError(t("bc.cannotSave"));
        setBusy(true);
        setError(null);
        try {
            const payload = { name: trimmed, structure: { barcode_type: type, barcode_name: trimmed, fields: fields.map(clean) } };
            const saved = draft.id ? await api.barcodes.update(draft.id, payload) : await api.barcodes.create(payload);
            setLeaveGuard(null);
            onSaved({ id: Number(saved?.id ?? draft.id), name: trimmed, structure: payload.structure }, !draft.id);
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : t("bc.saveFailed"));
        } finally {
            setBusy(false);
        }
    };

    // ── the strip: each part with what the server put in it ──
    const variable = fields.some(isVariable);
    const parts = preview?.data && !variable ? splitData(structure, preview.data) : null;
    const eanDigits = fields.reduce((sum, f) => sum + digitsOf(f), 0);
    const cells = fields.map((f, i) => ({
        key: i,
        value: parts?.[i] ?? (f.field_type === "constanta" ? f.value || "" : f.field_type === "ai" ? `(${f.value ?? ""})` : isVariable(f) ? "…" : "·".repeat(Math.max(1, Math.min(charsOf(f), 14)))),
        label: f.field_type === "constanta" ? t("bc.short.constanta") : f.field_type === "ai" ? "AI" : t(`bc.short.${f.field_type}`),
        flex: Math.max(2, charsOf(f)),
    }));
    const check = type === "ean13" ? (parts && parts.length > fields.length ? parts[fields.length] : eanDigits === 12 && parts ? ean13Check(parts.slice(0, fields.length).join("")) : "?") : null;

    const problemText = (p: (typeof problems)[number]) => t(p.key, p.params);
    const rowProblems = (i: number) => problems.filter((p) => p.index === i).map(problemText);
    const generalProblems = problems.filter((p) => p.index === null).map(problemText);

    const notes: Array<{ tone: "ok" | "warn" | "info"; text: string }> = [];
    if (problems.length > 0) notes.push({ tone: "warn", text: t("bc.wontBuild", { list: problems.map(problemText).join("; ") }) });
    else if (preview?.errors.length) notes.push({ tone: "warn", text: preview.errors.join(" ") });
    else if (preview) notes.push({ tone: "ok", text: type === "ean13" ? t("bc.buildsEan") : isGs1(type) ? t("bc.buildsGs1") : t("bc.builds") });
    for (const warning of preview?.warnings ?? []) notes.push({ tone: "info", text: warning });
    if (type === "ean13" && fields[0]?.field_type === "constanta" && fields[0].value && !/^2\d?/.test(fields[0].value)) notes.push({ tone: "info", text: t("bc.prefixHint") });
    if (type === "gs1qrcode") notes.push({ tone: "info", text: t("bc.sunrise") });
    if (type === "databarexpandedstacked") notes.push({ tone: "info", text: t("bc.databar") });

    const kindOptions = (current: string) => ALL_KINDS.filter((k) => k === current || isGs1(type) || !GS1_ONLY.includes(k));

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">
            <div className="lp-glass relative z-20 flex flex-wrap items-center gap-2.5 rounded-[18px] p-2">
                <button type="button" onClick={back} className="flex min-h-[40px] items-center gap-1.5 rounded-[12px] border border-lp-line bg-lp-surface pl-2 pr-3 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                    {t("bc.back")}
                </button>
                <label htmlFor="bc-name" className="sr-only">{t("bc.nameLabel")}</label>
                <input
                    id="bc-name"
                    value={name}
                    maxLength={255}
                    placeholder={t("bc.nameLabel")}
                    onChange={(e) => { setName(e.target.value); setError(null); }}
                    className="min-w-0 flex-[0_1_300px] rounded-[8px] bg-transparent px-1.5 py-1 text-[18px] font-extrabold text-lp-ink outline-none transition hover:bg-lp-surface focus:bg-lp-surface"
                />
                <div role="group" aria-label={t("bc.typeLabel")} className="flex flex-wrap gap-0.5 rounded-[12px] bg-lp-ink/[0.05] p-[3px]">
                    {SYMBOLOGIES.map((id) => (
                        <button
                            key={id}
                            type="button"
                            aria-pressed={type === id}
                            onClick={() => setType(id)}
                            className={cx("min-h-[34px] rounded-[9px] px-3 text-[13px] font-extrabold transition", type === id ? "bg-lp-surface text-lp-ink shadow-[0_1px_3px_rgba(16,24,40,.12)]" : "text-lp-ink-3 hover:text-lp-ink")}
                        >
                            {SYMBOLOGY_LABEL[id]}
                        </button>
                    ))}
                </div>
                <span className="flex-1" />
                {dirty && <span className="text-[12px] font-bold text-lp-warn">● {t("bc.unsaved")}</span>}
                <button type="button" disabled={busy} onClick={() => void save()} className={cx(primaryButton, "min-h-[42px]")}>{t("bc.save")}</button>
            </div>

            {error && <p role="alert" className="m-0 text-[14px] font-bold text-lp-bad">■ {error}</p>}
            {notice && !error && <p role="status" className="m-0 text-[14px] font-bold text-lp-ok">● {notice}</p>}
            {usedBy > 0 && dirty && <p className="m-0 text-[13px] font-bold text-lp-ink-2">{t("bc.usedNote", { count: usedBy })}</p>}

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <section className="lp-card flex flex-col gap-3 p-[18px]">
                    <div className="flex items-center gap-2.5">
                        <h2 className="m-0 flex-1 text-[16px] font-extrabold text-lp-ink">{t("bc.partsTitle")}</h2>
                        <span className={cx("text-[13px] font-extrabold", variable ? "text-lp-ink-3" : type !== "ean13" || eanDigits === 12 ? "text-lp-ok" : "text-lp-warn")}>
                            {variable ? t("bc.charsVariable") : type === "ean13" ? (eanDigits === 12 ? `✓ ${t("bc.eanOk")}` : `▲ ${t("bc.eanCount", { got: eanDigits })}`) : t("bc.chars", { count: eanDigits })}
                        </span>
                    </div>

                    {fields.length > 0 && (
                        <div className="flex min-h-[58px] overflow-hidden rounded-[12px] border border-lp-line-2" aria-label={t("bc.stripLabel")}>
                            {cells.map((cell, i) => (
                                <button
                                    key={cell.key}
                                    type="button"
                                    onClick={() => setSel(i)}
                                    className={cx("flex min-w-0 flex-col justify-center gap-0.5 border-r border-lp-line-2 px-2 py-1.5 text-left last:border-r-0", i === sel ? "bg-lp-accent-bg shadow-[inset_0_-3px_0_rgb(var(--lp-accent))]" : i % 2 ? "bg-lp-surface" : "bg-lp-raised")}
                                    style={{ flex: `${cell.flex} 1 0` }}
                                >
                                    <b className="truncate font-mono text-[13px] font-semibold text-lp-ink">{cell.value}</b>
                                    <small className="truncate text-[11px] font-bold text-lp-ink-3">{cell.label}</small>
                                </button>
                            ))}
                            {check !== null && (
                                <span className="flex min-w-0 flex-col justify-center gap-0.5 px-2 py-1.5" style={{ flex: "2 1 0", background: "repeating-linear-gradient(45deg, rgb(var(--lp-surface)) 0 6px, rgb(var(--lp-raised)) 6px 12px)" }}>
                                    <b className="font-mono text-[13px] font-semibold text-lp-ink">{check}</b>
                                    <small className="truncate text-[11px] font-bold text-lp-ink-3">{t("bc.check")}</small>
                                </span>
                            )}
                        </div>
                    )}

                    {fields.map((f, i) => {
                        const own = rowProblems(i);
                        const kind = f.field_type;
                        const weight = WEIGHT_KINDS.includes(kind);
                        const date = DATE_KINDS.includes(kind);
                        let hint = t(`bc.help.${kind}`);
                        if (weight) hint = `${hint} ${t("bc.weightMax", { kg: new Intl.NumberFormat(lang, { maximumFractionDigits: decimalsOf(f) }).format(maxWeightKg(f)) })}`;
                        return (
                            <div
                                key={i}
                                onFocus={() => setSel(i)}
                                onClick={() => setSel(i)}
                                className={cx("grid grid-cols-[28px_minmax(0,1.15fr)_minmax(0,1fr)_78px] items-center gap-x-2.5 gap-y-1.5 rounded-[12px] border bg-lp-surface px-2.5 py-2", i === sel ? "border-lp-accent shadow-[0_0_0_3px_rgb(var(--lp-accent-bg))]" : "border-lp-line")}
                            >
                                <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-lp-ink/[0.05] text-[12px] font-extrabold text-lp-ink-2">{i + 1}</span>
                                <select aria-label={t("bc.partKind", { n: i + 1 })} value={kind} onChange={(e) => update(i, newField(e.target.value, extraNames))} className={inputCls}>
                                    {KIND_GROUPS.map(([group, kinds]) => {
                                        const options = kinds.filter((k) => kindOptions(kind).includes(k));
                                        return options.length ? (
                                            <optgroup key={group} label={t(`bc.group.${group}`)}>
                                                {options.map((k) => <option key={k} value={k}>{t(`bc.kind.${k}`)}</option>)}
                                            </optgroup>
                                        ) : null;
                                    })}
                                </select>
                                <span className="flex min-w-0 gap-1.5">
                                    {kind === "constanta" && (
                                        <input aria-label={t("bc.constValue")} value={f.value ?? ""} onChange={(e) => update(i, { value: e.target.value })} className={cx(inputCls, "font-mono")} />
                                    )}
                                    {kind === "ai" && (
                                        <select aria-label={t("bc.aiLabel")} value={f.value ?? ""} onChange={(e) => update(i, { value: e.target.value })} className={inputCls}>
                                            {!AI_CODES.includes(f.value ?? "") && <option value={f.value ?? ""}>{f.value || "—"}</option>}
                                            {AI_CODES.map((code) => <option key={code} value={code}>{t(`bc.ai.${code}`)}</option>)}
                                        </select>
                                    )}
                                    {kind === "extra_data" && (
                                        <select aria-label={t("bc.extraLabel")} value={f.value ?? ""} onChange={(e) => update(i, { value: e.target.value })} className={cx(inputCls, "min-w-0 flex-1")}>
                                            <option value="">{t("bc.extraPick")}</option>
                                            {[...new Set([...(f.value ? [f.value] : []), ...extraNames])].map((n) => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    )}
                                    {hasLength(kind) && (
                                        <input
                                            aria-label={t("bc.lengthLabel")}
                                            title={t("bc.lengthLabel")}
                                            inputMode="numeric"
                                            value={f.length ?? ""}
                                            placeholder={defaultLength(kind) ? String(defaultLength(kind)) : t("bc.asIs")}
                                            onChange={(e) => update(i, { length: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                                            className={cx(inputCls, "w-[64px] flex-none text-center font-mono")}
                                        />
                                    )}
                                    {weight && (
                                        <input
                                            aria-label={t("bc.decimalsLabel")}
                                            title={t("bc.decimalsLabel")}
                                            inputMode="numeric"
                                            value={f.decimalPlaces ?? ""}
                                            placeholder="3"
                                            onChange={(e) => update(i, { decimalPlaces: e.target.value.replace(/\D/g, "").slice(0, 1) })}
                                            className={cx(inputCls, "w-[52px] flex-none text-center font-mono")}
                                        />
                                    )}
                                    {date && (
                                        <select aria-label={t("bc.dateFormatLabel")} value={f.dateFormat || DEFAULT_DATE_FORMAT} onChange={(e) => update(i, { dateFormat: e.target.value })} className={cx(inputCls, "min-w-0 flex-1 font-mono")}>
                                            {DATE_FORMATS.map((fmt) => <option key={fmt} value={fmt}>{t(`bc.date.${fmt}`)}</option>)}
                                        </select>
                                    )}
                                </span>
                                <span className="flex justify-end gap-0.5">
                                    <button type="button" aria-label={t("bc.up")} title={t("bc.up")} disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(i, -1); }} className="h-[30px] w-6 rounded-[7px] font-extrabold text-lp-ink-3 hover:bg-lp-ink/[0.05] hover:text-lp-ink disabled:opacity-30">↑</button>
                                    <button type="button" aria-label={t("bc.down")} title={t("bc.down")} disabled={i === fields.length - 1} onClick={(e) => { e.stopPropagation(); move(i, 1); }} className="h-[30px] w-6 rounded-[7px] font-extrabold text-lp-ink-3 hover:bg-lp-ink/[0.05] hover:text-lp-ink disabled:opacity-30">↓</button>
                                    <button type="button" aria-label={t("bc.remove")} title={t("bc.remove")} onClick={(e) => { e.stopPropagation(); setFields(fields.filter((_, j) => j !== i)); setSel(0); }} className="h-[30px] w-6 rounded-[7px] font-extrabold text-lp-ink-3 hover:bg-lp-bad-bg hover:text-lp-bad">✕</button>
                                </span>
                                <span className={cx("col-start-2 col-end-[-1] text-[12px]", own.length ? "font-bold text-lp-warn" : "text-lp-ink-3")}>
                                    {own.length ? own.join(" ") : hint}
                                </span>
                            </div>
                        );
                    })}
                    {generalProblems.length > 0 && fields.length === 0 && <p className="m-0 text-[13px] text-lp-ink-3">{t("bc.noParts")}</p>}

                    <div className="relative">
                        <button type="button" aria-expanded={addOpen} onClick={() => setAddOpen((v) => !v)} className="min-h-[40px] rounded-[10px] border border-lp-line-2 bg-lp-surface px-3.5 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised">
                            + {t("bc.addPart")}
                        </button>
                        {addOpen && (
                            <>
                                <div className="fixed inset-0 z-20" onClick={() => setAddOpen(false)} />
                                <div role="menu" className="lp-card absolute left-0 top-[46px] z-30 flex max-h-[380px] w-[330px] flex-col overflow-y-auto p-1.5">
                                    {KIND_GROUPS.filter(([group]) => group !== "gs1" || isGs1(type)).map(([group, kinds]) => (
                                        <React.Fragment key={group}>
                                            <span className="px-2.5 pb-0.5 pt-2 text-[12px] font-extrabold text-lp-ink-3">{t(`bc.group.${group}`)}</span>
                                            {kinds.map((k) => (
                                                <button key={k} type="button" role="menuitem" onClick={() => add(k)} className="min-h-[36px] rounded-[9px] px-2.5 text-left text-[14px] font-bold text-lp-ink hover:bg-lp-raised">
                                                    {t(`bc.kind.${k}`)}
                                                </button>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </section>

                <section className="lp-card flex flex-col gap-3 p-[18px]">
                    <h2 className="m-0 text-[16px] font-extrabold text-lp-ink">{t("bc.resultTitle")}</h2>
                    <div className="flex flex-col gap-1">
                        <label htmlFor="bc-product" className="text-[12px] font-extrabold text-lp-ink-3">{t("bc.productLabel")}</label>
                        <select id="bc-product" value={productId} onChange={(e) => setProductId(e.target.value)} className={cx(inputCls, "min-h-[40px]")}>
                            <option value="">{t("bc.noProduct")}</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="flex min-h-[190px] items-center justify-center rounded-[14px]" style={{ background: "radial-gradient(circle at 50% 40%, rgb(var(--lp-g-what) / 0.14), transparent 70%), rgb(var(--lp-raised))" }}>
                        <BarcodePicture type={type} preview={problems.length ? null : preview} dim={loading} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[12px] font-extrabold text-lp-ink-3">{t("bc.dataLabel")}</span>
                        <div className="break-all rounded-[10px] bg-lp-raised px-3 py-2.5 font-mono text-[13px] text-lp-ink">
                            {parts
                                ? parts.map((part, i) => (
                                    <span key={i} title={i < fields.length ? t(`bc.kind.${fields[i].field_type}`) : t("bc.check")} className={cx("rounded-[4px] px-px", i % 2 === 0 && "bg-lp-accent-bg")}>
                                        {part.replace(/\u001d/g, "␝")}
                                    </span>
                                ))
                                : preview?.data ?? <span className="text-lp-ink-3">{loading ? t("bc.loading") : "—"}</span>}
                        </div>
                    </div>
                    {notes.map((note, i) => (
                        <div key={i} className={cx("flex items-start gap-2 rounded-[11px] px-2.5 py-2 text-[12px] font-bold leading-snug", note.tone === "ok" ? "bg-lp-ok-bg text-lp-ok" : note.tone === "warn" ? "bg-lp-warn-bg text-lp-warn" : "bg-lp-accent-bg text-lp-accent-ink")}>
                            <span aria-hidden="true">{note.tone === "ok" ? "✓" : note.tone === "warn" ? "▲" : "ℹ"}</span>
                            <span>{note.text}</span>
                        </div>
                    ))}
                    <button type="button" onClick={back} className={cx(linkButton, "self-start")}>{t("bc.backToList")}</button>
                </section>
            </div>
        </div>
    );
}

/** A new part of the given kind with the server's defaults made explicit. */
export function newField(kind: string, extraNames: string[]): BarcodeField {
    const field: BarcodeField = { field_type: kind };
    if (kind === "ai") field.value = "01";
    if (kind === "constanta") field.value = "";
    if (kind === "extra_data") field.value = extraNames[0] ?? "";
    if (WEIGHT_KINDS.includes(kind)) {
        field.length = String(defaultLength(kind));
        field.decimalPlaces = "3";
    }
    if (DATE_KINDS.includes(kind)) field.dateFormat = DEFAULT_DATE_FORMAT;
    return field;
}

/** Drops settings a part of this kind does not use. */
function clean(field: BarcodeField): BarcodeField {
    const kind = field.field_type;
    const out: BarcodeField = { field_type: kind };
    if (kind === "constanta" || kind === "ai" || kind === "extra_data") out.value = field.value ?? "";
    if (hasLength(kind) && field.length !== undefined && field.length !== "") out.length = field.length;
    if (WEIGHT_KINDS.includes(kind) && field.decimalPlaces !== undefined && field.decimalPlaces !== "") out.decimalPlaces = field.decimalPlaces;
    if (DATE_KINDS.includes(kind)) out.dateFormat = field.dateFormat || DEFAULT_DATE_FORMAT;
    return out;
}
