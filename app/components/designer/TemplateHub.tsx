"use client";

// «Шаблоны этикеток»: what each label looks like, which products use it and whether a
// pack label carries what the EU requires. A new template is one click in the gallery.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { LabelDoc } from "@/lib/label/types";
import { euCheck, EU_REQUIREMENTS, isEuChecked, type EuRequirement } from "@/lib/label/eu";
import PageTitle from "../shell/PageTitle";
import Portal from "../Portal";
import { cx, Icon } from "../stations/shared";
import { dangerLink, linkButton, primaryButton } from "../print/shared";
import LabelThumb from "./LabelThumb";
import { blankDoc, labelType, LTYPES, parseScheme, previewDataFor, sizeMm, type LType, type T } from "./model";
import { buildStarter, STARTERS, type Starter } from "./starters";
import { DIcon, inputClass, previewBackdrop, Seg, TypeChip, TYPE_DOT } from "./ui";

export type SavedTemplate = { id: number; name: string; scheme?: unknown; structure?: unknown };
export type Product = Record<string, any> & { id: number; name: string };

type Props = {
    templates: SavedTemplate[];
    products: Product[];
    /** Builds a starter's document (creating the product fields it needs); null if it failed. */
    makeStarter: (starter: Starter) => Promise<{ doc: LabelDoc; note: string | null } | null>;
    onOpen: (template: SavedTemplate) => void;
    onCreate: (doc: LabelDoc, name: string, note: string | null) => void;
    onCopy: (template: SavedTemplate) => Promise<void>;
    onDelete: (template: SavedTemplate) => Promise<void>;
    notice: string | null;
};

type Item = { raw: SavedTemplate; doc: LabelDoc | null; type: LType; used: number; gaps: EuRequirement[]; preview: Record<string, any> };

const usedBy = (products: Product[], id: number) =>
    products.filter((p) => p.templates_pack_label === id || p.templates_box_label === id || p.templates_pallet_label === id);

export function starterTitle(t: T, starter: Starter): string {
    return `${t(`tpl.st.${starter.id}`)} ${starter.w}×${starter.h}`;
}

export default function TemplateHub({ templates, products, makeStarter, onOpen, onCreate, onCopy, onDelete, notice }: Props) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<"all" | LType>("all");
    const [onlyEu, setOnlyEu] = useState(false);
    const [query, setQuery] = useState("");
    const [menu, setMenu] = useState<number | null>(null);
    const [confirm, setConfirm] = useState<number | null>(null);
    const [gallery, setGallery] = useState(false);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState<{ text: string; tone: "ok" | "bad" } | null>(null);

    useEffect(() => {
        if (notice) setFlash({ text: notice, tone: "ok" });
    }, [notice]);

    const items = useMemo<Item[]>(() => templates.map((raw) => {
        const doc = parseScheme(raw);
        const users = usedBy(products, raw.id);
        const type = doc ? labelType(doc) : "pack";
        const gaps = doc && isEuChecked(doc) ? euCheck(doc).gaps : [];
        return { raw, doc, type, used: users.length, gaps, preview: previewDataFor(users[0] ?? products[0] ?? null) };
    }), [templates, products]);

    const packs = items.filter((it) => it.type === "pack" && it.doc);
    const euReady = packs.filter((it) => it.gaps.length === 0).length;
    const withGaps = packs.length - euReady;
    const count = (type: LType) => items.filter((it) => it.type === type).length;
    const usedTemplates = items.filter((it) => it.used > 0).length;

    const q = query.trim().toLowerCase();
    const visible = items
        .filter((it) => tab === "all" || it.type === tab)
        .filter((it) => !onlyEu || it.gaps.length > 0)
        .filter((it) => !q || String(it.raw.name ?? "").toLowerCase().includes(q));

    const act = async (job: () => Promise<void>, done: string) => {
        setBusy(true);
        try {
            await job();
            setFlash({ text: done, tone: "ok" });
        } catch (error) {
            setFlash({ text: error instanceof Error && error.message ? error.message : t("tpl.failed"), tone: "bad" });
        } finally {
            setBusy(false);
        }
    };

    const pickStarter = async (starter: Starter) => {
        setBusy(true);
        try {
            const made = await makeStarter(starter);
            if (made) onCreate(made.doc, starterTitle(t, starter), made.note);
        } finally {
            setBusy(false);
        }
    };

    const requirementList = (gaps: EuRequirement[]) => gaps.map((r) => t(`ed.req.${r}`).toLowerCase()).join(", ");

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
            <PageTitle icon="labels" eyebrow={t("nav.groupWhatWePrint")} title={t("nav.labels")} description={t("tpl.lead")}>
                <button type="button" onClick={() => setGallery(true)} className={cx(primaryButton, "flex items-center gap-2")}>
                    <Icon name="plus" className="h-5 w-5" />
                    {t("tpl.create")}
                </button>
            </PageTitle>

            {flash && (
                <p role="status" className={cx("m-0 flex items-start gap-2 text-[14px] font-bold", flash.tone === "ok" ? "text-lp-ok" : "text-lp-bad")}>
                    <span aria-hidden="true">{flash.tone === "ok" ? "●" : "■"}</span>
                    <span className="flex-1">{flash.text}</span>
                    <button type="button" onClick={() => setFlash(null)} aria-label={t("tpl.close")} className="text-lp-ink-3 hover:text-lp-ink">
                        <DIcon name="close" className="h-4 w-4" />
                    </button>
                </p>
            )}

            {templates.length === 0 ? (
                <section className="lp-card flex flex-col gap-4 p-5">
                    <div className="flex flex-col gap-1">
                        <h2 className="m-0 text-[20px] font-extrabold tracking-[-0.02em] text-lp-ink">{t("tpl.emptyTitle")}</h2>
                        <p className="m-0 text-[14px] text-lp-ink-2">{t("tpl.galleryLead")}</p>
                    </div>
                    <StarterGrid t={t} busy={busy} onPick={pickStarter} onBlank={(doc, name) => onCreate(doc, name, null)} />
                </section>
            ) : (
                <>
                    {/* Bento: EU readiness (focal), kinds, use */}
                    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                        <section className="lp-card flex min-w-0 flex-col gap-3 p-[18px]">
                            <div className="flex items-center gap-4">
                                <Ring ready={euReady} total={packs.length} t={t} />
                                <div className="flex min-w-0 flex-col gap-1">
                                    <span className="text-[13px] font-extrabold text-lp-ink-3">{t("tpl.euKicker")}</span>
                                    <span className="text-[17px] font-extrabold text-lp-ink">
                                        {packs.length === 0 ? t("tpl.euNone") : withGaps === 0 ? t("tpl.euAll") : t("tpl.euGaps", { count: withGaps })}
                                    </span>
                                    <span className="text-[13px] text-lp-ink-2">{t("tpl.euExplain")}</span>
                                </div>
                            </div>
                            {withGaps > 0 && !onlyEu && (
                                <button type="button" onClick={() => { setOnlyEu(true); setTab("all"); setQuery(""); }} className="min-h-[38px] self-start rounded-[11px] border border-lp-line-2 bg-lp-surface px-3.5 text-[13px] font-extrabold text-lp-ink transition hover:bg-lp-raised">
                                    {t("tpl.showGaps")}
                                </button>
                            )}
                        </section>
                        <section className="lp-card flex min-w-0 flex-col gap-2.5 p-[18px]">
                            <span className="text-[13px] font-extrabold text-lp-ink-3">{t("tpl.byType")}</span>
                            <span className="text-[34px] font-extrabold leading-none tracking-[-0.03em] text-lp-ink">{items.length}</span>
                            <div className="flex h-2.5 overflow-hidden rounded-full bg-lp-ink/[0.08]" aria-hidden="true">
                                {LTYPES.map((type) => (
                                    <span key={type} className={TYPE_DOT[type]} style={{ width: `${items.length ? (count(type) / items.length) * 100 : 0}%` }} />
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] font-bold text-lp-ink-2">
                                {LTYPES.map((type) => (
                                    <span key={type} className="flex items-center gap-1.5">
                                        <span className={cx("h-2 w-2 rounded-full", TYPE_DOT[type])} aria-hidden="true" />
                                        {t(`tpl.type.${type}`)} {count(type)}
                                    </span>
                                ))}
                            </div>
                        </section>
                        <section className="lp-card flex min-w-0 flex-col gap-2.5 p-[18px]">
                            <span className="text-[13px] font-extrabold text-lp-ink-3">{t("tpl.inUse")}</span>
                            <span className="text-[34px] font-extrabold leading-none tracking-[-0.03em] text-lp-ink">{t("tpl.ofTotal", { used: usedTemplates, total: items.length })}</span>
                            <span className="text-[13px] text-lp-ink-2">{t("tpl.inUseExplain")}</span>
                        </section>
                    </div>

                    {/* Kinds, EU filter, search */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div role="tablist" aria-label={t("tpl.tabsLabel")} className="flex flex-wrap gap-1.5">
                            {(["all", ...LTYPES] as const).map((id) => (
                                <button
                                    key={id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === id}
                                    onClick={() => setTab(id)}
                                    className={cx(
                                        "flex min-h-[38px] items-center gap-2 rounded-full px-3.5 text-[13px] font-extrabold transition",
                                        tab === id ? "bg-lp-surface text-lp-ink shadow-[var(--lp-shadow)]" : "text-lp-ink-2 hover:bg-lp-surface/60",
                                    )}
                                >
                                    {id !== "all" && <span className={cx("h-2 w-2 rounded-full", TYPE_DOT[id])} aria-hidden="true" />}
                                    {id === "all" ? t("tpl.all") : t(`tpl.type.${id}`)}
                                    <span className="font-mono text-[12px] text-lp-ink-3">{id === "all" ? items.length : count(id)}</span>
                                </button>
                            ))}
                        </div>
                        {onlyEu && (
                            <button type="button" onClick={() => setOnlyEu(false)} className="flex min-h-[38px] items-center gap-2 rounded-full border border-lp-warn/50 bg-lp-warn-bg px-3.5 text-[13px] font-extrabold text-lp-warn">
                                {t("tpl.onlyGaps")}
                                <DIcon name="close" className="h-4 w-4" />
                            </button>
                        )}
                        <span className="flex-1" />
                        <div className="relative w-full max-w-[260px]">
                            <label htmlFor="tpl-search" className="sr-only">{t("tpl.search")}</label>
                            <DIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lp-ink-3" />
                            <input id="tpl-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("tpl.search")} className={cx(inputClass, "min-h-[40px] rounded-[12px] pl-9 font-semibold")} />
                        </div>
                    </div>

                    {visible.length === 0 ? (
                        <p className="lp-card m-0 p-7 text-center text-[14px] text-lp-ink-3">{t("tpl.nothing")}</p>
                    ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
                            {visible.map((it) => {
                                const { raw, doc, type } = it;
                                const size = doc ? sizeMm(doc.canvas) : null;
                                const name = raw.name || t("tpl.untitled");
                                return (
                                    <article key={raw.id} className={cx("lp-card relative flex min-w-0 flex-col", menu === raw.id ? "z-30" : "lp-lift")}>
                                        <button
                                            type="button"
                                            onClick={() => onOpen(raw)}
                                            aria-label={t("tpl.openNamed", { name })}
                                            className="h-[160px] overflow-hidden rounded-t-[20px] p-3"
                                            style={previewBackdrop(type)}
                                        >
                                            {doc ? <LabelThumb doc={doc} data={it.preview} /> : <span className="text-[12px] text-lp-ink-3">{t("tpl.noPreview")}</span>}
                                        </button>
                                        <div className="flex min-w-0 flex-col gap-2 p-3.5">
                                            <div className="relative flex items-center gap-2">
                                                <button type="button" onClick={() => onOpen(raw)} className="min-w-0 flex-1 truncate text-left text-[15px] font-extrabold text-lp-ink hover:underline">
                                                    {name}
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={t("tpl.actionsNamed", { name })}
                                                    aria-haspopup="menu"
                                                    aria-expanded={menu === raw.id}
                                                    onClick={() => { setMenu(menu === raw.id ? null : raw.id); setConfirm(null); }}
                                                    className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] text-lp-ink-3 transition hover:bg-lp-raised hover:text-lp-ink"
                                                >
                                                    <DIcon name="more" className="h-5 w-5" />
                                                </button>
                                                {menu === raw.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-20" onClick={() => setMenu(null)} />
                                                        <div role="menu" className="lp-card absolute right-0 top-10 z-30 flex min-w-[210px] flex-col p-1.5">
                                                            <button type="button" role="menuitem" className="min-h-[38px] rounded-[9px] px-2.5 text-left text-[14px] font-bold text-lp-ink hover:bg-lp-raised" onClick={() => { setMenu(null); onOpen(raw); }}>
                                                                {t("tpl.open")}
                                                            </button>
                                                            <button type="button" role="menuitem" disabled={busy} className="min-h-[38px] rounded-[9px] px-2.5 text-left text-[14px] font-bold text-lp-ink hover:bg-lp-raised" onClick={() => { setMenu(null); void act(() => onCopy(raw), t("tpl.copied", { name })); }}>
                                                                {t("tpl.copy")}
                                                            </button>
                                                            <button type="button" role="menuitem" className="min-h-[38px] rounded-[9px] px-2.5 text-left text-[14px] font-bold text-lp-bad hover:bg-lp-bad-bg" onClick={() => { setMenu(null); setConfirm(raw.id); }}>
                                                                {t("tpl.delete")}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                                <TypeChip type={type}>{t(`tpl.type.${type}`)}</TypeChip>
                                                <span className="font-mono text-[12px] text-lp-ink-3">
                                                    {size ? `${size.w}×${size.h} ${t("ed.unitMm")}` : "—"} · {it.used > 0 ? t("tpl.usedBy", { count: it.used }) : t("tpl.unused")}
                                                </span>
                                            </div>
                                            {it.gaps.length > 0 && (
                                                <span className="text-[12px] font-bold leading-snug text-lp-warn">
                                                    ▲ {it.gaps.length <= 2 ? t("tpl.missing", { list: requirementList(it.gaps) }) : t("tpl.missingMany", { count: it.gaps.length, total: EU_REQUIREMENTS.length })}
                                                </span>
                                            )}
                                            {confirm === raw.id && (
                                                <div className="mt-1 flex flex-col gap-2 border-t border-lp-line pt-2.5">
                                                    <span className="text-[13px] font-bold text-lp-ink">
                                                        {it.used > 0 ? t("tpl.deleteUsed", { count: it.used }) : t("tpl.deleteAsk")}
                                                    </span>
                                                    <div className="flex gap-4">
                                                        <button type="button" disabled={busy} className={dangerLink} onClick={() => act(() => onDelete(raw), t("tpl.deleted", { name }))}>
                                                            {t("tpl.deleteYes")}
                                                        </button>
                                                        <button type="button" className={linkButton} onClick={() => setConfirm(null)}>{t("tpl.no")}</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {gallery && (
                <Gallery t={t} busy={busy} onClose={() => setGallery(false)} onPick={pickStarter} onBlank={(doc, name) => onCreate(doc, name, null)} />
            )}
        </div>
    );
}

function Ring({ ready, total, t }: { ready: number; total: number; t: T }) {
    const share = total ? ready / total : 1;
    const color = total === 0 || ready === total ? "rgb(var(--lp-ok))" : "rgb(var(--lp-warn))";
    return (
        <div className="flex h-[76px] w-[76px] flex-none items-center justify-center rounded-full" style={{ background: `conic-gradient(${color} 0 ${share * 360}deg, rgb(var(--lp-ink) / 0.08) 0)` }}>
            <span className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full bg-lp-surface text-[18px] font-extrabold leading-none text-lp-ink">
                {ready}
                <small className="mt-0.5 whitespace-nowrap text-[10px] font-bold text-lp-ink-3">{t("tpl.ofN", { total })}</small>
            </span>
        </div>
    );
}

function Gallery({ t, busy, onClose, onPick, onBlank }: {
    t: T;
    busy: boolean;
    onClose: () => void;
    onPick: (starter: Starter) => void;
    onBlank: (doc: LabelDoc, name: string) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        ref.current?.querySelector<HTMLButtonElement>("button[data-starter]")?.focus();
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    return (
        <Portal>
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(12,18,32,.36)] p-4 backdrop-blur-sm dark:bg-[rgba(0,0,0,.6)]" onClick={onClose}>
                <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="tpl-gallery" className="lp-card flex max-h-[92vh] w-full max-w-[900px] flex-col gap-4 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-start gap-3">
                        <div className="flex flex-1 flex-col gap-1">
                            <h2 id="tpl-gallery" className="m-0 text-[22px] font-extrabold tracking-[-0.02em] text-lp-ink">{t("tpl.galleryTitle")}</h2>
                            <p className="m-0 text-[14px] text-lp-ink-2">{t("tpl.galleryLead")}</p>
                        </div>
                        <button type="button" onClick={onClose} aria-label={t("tpl.close")} className="flex h-10 w-10 items-center justify-center rounded-[12px] text-lp-ink-3 transition hover:bg-lp-raised hover:text-lp-ink">
                            <DIcon name="close" className="h-5 w-5" />
                        </button>
                    </div>
                    <StarterGrid t={t} busy={busy} onPick={onPick} onBlank={onBlank} />
                </div>
            </div>
        </Portal>
    );
}

/** Sample product used in the starter previews. */
const STARTER_SAMPLE = previewDataFor(null);

function StarterGrid({ t, busy, onPick, onBlank }: { t: T; busy: boolean; onPick: (starter: Starter) => void; onBlank: (doc: LabelDoc, name: string) => void }) {
    const previews = useMemo(() => {
        // Previews show every field (none of the extra fields exist here yet).
        const extras = { ingredients: t("ed.extra.ingredients"), storage: t("ed.extra.storage"), producer: t("ed.extra.producer") };
        const data = { ...STARTER_SAMPLE, [extras.ingredients]: t("tpl.sample.ingredients"), [extras.storage]: t("tpl.sample.storage"), [extras.producer]: t("tpl.sample.producer") };
        return { data, docs: STARTERS.map((st) => previewStarter(st, t, extras)) };
    }, [t]);
    const [blank, setBlank] = useState<{ type: LType; w: number; h: number }>({ type: "pack", w: 58, h: 40 });
    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
            {STARTERS.map((starter, i) => (
                <button
                    key={starter.id}
                    type="button"
                    data-starter
                    disabled={busy}
                    onClick={() => onPick(starter)}
                    className="lp-lift flex flex-col overflow-hidden rounded-[18px] border border-lp-line bg-lp-surface text-left disabled:opacity-60"
                >
                    <span className="block h-[124px] p-2.5" style={previewBackdrop(starter.type)}>
                        <LabelThumb doc={previews.docs[i]} data={previews.data} />
                    </span>
                    <span className="flex flex-col gap-1 p-3">
                        <span className="flex items-center gap-2">
                            <TypeChip type={starter.type}>{t(`tpl.type.${starter.type}`)}</TypeChip>
                            <span className="font-mono text-[12px] text-lp-ink-3">{starter.w}×{starter.h}</span>
                        </span>
                        <b className="text-[14px] font-extrabold text-lp-ink">{t(`tpl.st.${starter.id}`)}</b>
                        <span className="text-[12px] text-lp-ink-2">{t(`tpl.st.${starter.id}Hint`)}</span>
                    </span>
                </button>
            ))}
            <div className="flex flex-col gap-2.5 rounded-[18px] border border-dashed border-lp-line-2 p-3.5">
                <b className="text-[14px] font-extrabold text-lp-ink">{t("tpl.blank")}</b>
                <Seg
                    label={t("tpl.blankType")}
                    size="sm"
                    value={blank.type}
                    onChange={(type) => setBlank((b) => ({ ...b, type }))}
                    options={LTYPES.map((type) => ({ value: type, label: t(`tpl.type.${type}`) }))}
                />
                <div className="grid grid-cols-2 gap-2">
                    {(["w", "h"] as const).map((side) => (
                        <div key={side} className="flex flex-col gap-1">
                            <label htmlFor={`blank-${side}`} className="text-[11px] font-extrabold text-lp-ink-3">{t(side === "w" ? "tpl.widthMm" : "tpl.heightMm")}</label>
                            <input
                                id={`blank-${side}`}
                                inputMode="numeric"
                                value={blank[side] || ""}
                                onChange={(e) => setBlank((b) => ({ ...b, [side]: Number(e.target.value.replace(/\D/g, "").slice(0, 4)) }))}
                                className={cx(inputClass, "font-mono")}
                            />
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    disabled={busy || blank.w < 10 || blank.h < 10}
                    onClick={() => onBlank(blankDoc(blank.type, blank.w, blank.h), `${t(`tpl.type.${blank.type}`)} ${blank.w}×${blank.h}`)}
                    className="mt-auto min-h-[38px] rounded-[11px] border border-lp-line-2 bg-lp-surface px-3.5 text-[13px] font-extrabold text-lp-ink transition hover:bg-lp-raised disabled:opacity-50"
                >
                    {t("tpl.blankCreate")}
                </button>
                {(blank.w < 10 || blank.h < 10) && <span className="text-[12px] text-lp-ink-3">{t("tpl.blankMin")}</span>}
            </div>
        </div>
    );
}

// The gallery previews a starter without touching the server: barcode as grey bars.
function previewStarter(starter: Starter, t: T, extras: { ingredients: string; storage: string; producer: string }): LabelDoc {
    return buildStarter(starter, t, extras, { id: 0, name: "EAN-13", structure: { barcode_type: "ean13" } });
}
