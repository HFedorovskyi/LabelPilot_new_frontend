"use client";

// «Штрихкоды»: every barcode template as a card with the code itself, what it is made of
// and which label templates use it. A template that cannot be built while labels use it
// is the one problem worth a card. New ones start from one-click starters; the editor is
// its own page.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n";
import { stationDelivery, type Station } from "@/lib/stations";
import PageTitle from "@/app/components/shell/PageTitle";
import type { NavKey } from "@/app/components/shell/Sidebar";
import Portal from "@/app/components/Portal";
import { cx, Icon } from "@/app/components/stations/shared";
import { dangerLink, linkButton, primaryButton } from "@/app/components/print/shared";
import BarcodeEditor, { newField, type Draft } from "./BarcodeEditor";
import {
    barcodeRefs, gtinFieldOf, isGs1, labelsUsing, parseTemplate, problemsOf, STARTERS, starterFields, SYMBOLOGIES, SYMBOLOGY_LABEL,
    type BarcodeTemplate, type Starter, type T,
} from "./model";
import { BarcodePicture, useBarcodePreview } from "./preview";

type Label = { id: number; name: string; scheme?: unknown };
type Product = { id: number; name: string; article?: string };
type Flash = { ok: boolean; text: string; action?: { label: string; run: () => void } };

const uniqueName = (base: string, taken: string[]) => {
    const lower = new Set(taken.map((n) => n.trim().toLowerCase()));
    if (!lower.has(base.toLowerCase())) return base;
    for (let i = 2; ; i++) if (!lower.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
};

export default function BarcodesPage({ onNavigate }: { onNavigate?: (key: NavKey) => void }) {
    const { t, lang } = useTranslation();
    const [templates, setTemplates] = useState<BarcodeTemplate[] | null>(null);
    const [labels, setLabels] = useState<Label[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [extraNames, setExtraNames] = useState<string[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [editing, setEditing] = useState<Draft | null>(null);
    const [gallery, setGallery] = useState(false);
    const [menu, setMenu] = useState<number | null>(null);
    const [confirm, setConfirm] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState<Flash | null>(null);

    const load = useCallback(async () => {
        const [rows, labelRows] = await Promise.all([api.barcodes.list(), api.labels.list()]);
        const list = (Array.isArray(rows) ? rows : rows.results ?? []) as Array<Record<string, unknown>>;
        setTemplates(list.map(parseTemplate).filter((x): x is BarcodeTemplate => x !== null));
        setLabels((Array.isArray(labelRows) ? labelRows : labelRows.results ?? []) as Label[]);
    }, []);
    useEffect(() => {
        load().catch(() => setTemplates([]));
        api.nomenclature.list().then((rows: Product[]) => setProducts(rows)).catch(() => { });
        api.attributes.list().then((rows: Array<{ name: string }>) => setExtraNames(rows.map((r) => r.name))).catch(() => { });
        api.stations.list().then((rows: Station[]) => setStations(rows)).catch(() => { });
    }, [load]);

    const list = useMemo(() => [...(templates ?? [])].sort((a, b) => a.name.localeCompare(b.name, lang)), [templates, lang]);
    const usage = useMemo(() => new Map(list.map((tpl) => [tpl.id, labelsUsing(tpl, labels)])), [list, labels]);
    const used = (tpl: BarcodeTemplate) => usage.get(tpl.id)?.length ?? 0;
    const brokenUsed = list.filter((tpl) => used(tpl) > 0 && problemsOf(tpl.structure).length > 0);
    // Label templates whose barcode points at a template that no longer exists: stations refuse them.
    const orphanLabels = labels.filter((label) => barcodeRefs(label.scheme).some((ref) =>
        ref.templateId ? !list.some((tpl) => tpl.id === ref.templateId) : !!ref.name && !list.some((tpl) => tpl.name === ref.name) && !SYMBOLOGIES.includes(ref.name as never)));
    const sampleProduct = products[0] ? String(products[0].id) : "";

    const sendToStations = async () => {
        const online = stations.filter((s) => stationDelivery(s) === "network");
        let sent = 0;
        const failed: string[] = [];
        for (const station of online) {
            try {
                await api.stations.sync(station.station_uuid);
                sent += 1;
            } catch {
                failed.push(station.station_name);
            }
        }
        api.stations.list().then((rows: Station[]) => setStations(rows)).catch(() => { });
        setFlash(failed.length ? { ok: false, text: t("bc.sendFailed", { names: failed.join(", ") }) } : { ok: true, text: t("bc.sent", { count: sent }) });
    };

    const open = (tpl: BarcodeTemplate) => {
        setMenu(null);
        setGallery(false);
        setFlash(null);
        setEditing({ id: tpl.id, name: tpl.name, structure: JSON.parse(JSON.stringify(tpl.structure)) });
    };

    const pickStarter = async (starter: Starter | null, blankType?: string) => {
        setBusy(true);
        try {
            let gtin = gtinFieldOf(extraNames);
            let note: string | null = null;
            if (starter?.needsGtin && !gtin) {
                gtin = "GTIN";
                try {
                    await api.attributes.create({ name: gtin });
                    setExtraNames((names) => [...names, gtin!]);
                    note = t("bc.gtinCreated");
                } catch {
                    // the field may already exist under this name
                }
            }
            const taken = list.map((tpl) => tpl.name);
            setGallery(false);
            setEditing(starter
                ? { id: null, name: uniqueName(t(`bc.st.${starter.id}`), taken), structure: { barcode_type: starter.type, fields: starterFields(starter, gtin ?? "GTIN") } }
                : { id: null, name: uniqueName(t("bc.st.blank"), taken), structure: { barcode_type: blankType ?? "code128", fields: [newField("article", extraNames)] } });
            setFlash(note ? { ok: true, text: note } : null);
        } finally {
            setBusy(false);
        }
    };

    const copy = async (tpl: BarcodeTemplate) => {
        setMenu(null);
        setBusy(true);
        try {
            const name = uniqueName(t("bc.copyName", { name: tpl.name }), list.map((x) => x.name));
            await api.barcodes.create({ name, structure: { ...tpl.structure, barcode_name: name } });
            await load();
            setFlash({ ok: true, text: t("bc.copied", { name: tpl.name }) });
        } catch {
            setFlash({ ok: false, text: t("bc.failed") });
        } finally {
            setBusy(false);
        }
    };

    const remove = async (tpl: BarcodeTemplate) => {
        setBusy(true);
        try {
            await api.barcodes.delete(tpl.id);
            await load();
            setConfirm(null);
            setFlash({ ok: true, text: t("bc.deleted", { name: tpl.name }) });
        } catch {
            setFlash({ ok: false, text: t("bc.failed") });
        } finally {
            setBusy(false);
        }
    };

    if (editing) {
        const current = list.find((tpl) => tpl.id === editing.id);
        return (
            <BarcodeEditor
                t={t}
                lang={lang}
                draft={editing}
                templates={list}
                extraNames={extraNames}
                products={products}
                usedBy={current ? used(current) : 0}
                notice={flash?.ok ? flash.text : null}
                onBack={() => setEditing(null)}
                onSaved={(tpl, isNew) => {
                    setEditing(null);
                    void load();
                    const count = isNew ? 0 : current ? used(current) : 0;
                    const online = stations.filter((s) => stationDelivery(s) === "network");
                    setFlash({
                        ok: true,
                        text: count > 0 ? t("bc.savedUsed", { name: tpl.name, count }) : t("bc.saved", { name: tpl.name }),
                        action: count > 0 && online.length > 0 ? { label: t("bc.sendNow"), run: () => void sendToStations() } : undefined,
                    });
                }}
            />
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
            <PageTitle icon="barcodes" eyebrow={t("nav.groupWhatWePrint")} title={t("nav.barcodes")} description={t("bc.lead")}>
                <button type="button" onClick={() => setGallery(true)} className={cx(primaryButton, "flex items-center gap-2")}>
                    <Icon name="plus" className="h-5 w-5" />
                    {t("bc.create")}
                </button>
            </PageTitle>

            {brokenUsed.length > 0 && (
                <Attention
                    title={t("bc.brokenTitle", { count: brokenUsed.length })}
                    text={`${brokenUsed.map((tpl) => t("bc.brokenItem", { name: tpl.name, why: t(problemsOf(tpl.structure)[0].key, problemsOf(tpl.structure)[0].params) })).join(" ")} ${t("bc.brokenTail")}`}
                    action={t("bc.fix")}
                    onAction={() => open(brokenUsed[0])}
                />
            )}
            {orphanLabels.length > 0 && (
                <Attention
                    title={t("bc.orphanTitle", { count: orphanLabels.length })}
                    text={t("bc.orphanText", { names: orphanLabels.map((l) => `«${l.name}»`).join(", ") })}
                    action={t("bc.toLabels")}
                    onAction={() => onNavigate?.("labels")}
                />
            )}

            {flash && (
                <p role="status" className={cx("m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-bold", flash.ok ? "text-lp-ok" : "text-lp-bad")}>
                    <span aria-hidden="true">{flash.ok ? "●" : "■"}</span>
                    <span>{flash.text}</span>
                    {flash.action && (
                        <button type="button" onClick={() => { const run = flash.action!.run; setFlash(null); run(); }} className={linkButton}>{flash.action.label}</button>
                    )}
                </p>
            )}

            {templates === null ? (
                <p className="lp-card m-0 p-7 text-center text-[14px] text-lp-ink-3">{t("bc.loading")}</p>
            ) : list.length === 0 ? (
                <section className="lp-card flex flex-col gap-4 p-5">
                    <div className="flex flex-col gap-1">
                        <h2 className="m-0 text-[20px] font-extrabold tracking-[-0.02em] text-lp-ink">{t("bc.emptyTitle")}</h2>
                        <p className="m-0 text-[14px] text-lp-ink-2">{t("bc.galleryLead")}</p>
                    </div>
                    <StarterGrid t={t} busy={busy} onPick={pickStarter} />
                </section>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
                    {list.map((tpl) => (
                        <Card
                            key={tpl.id}
                            t={t}
                            tpl={tpl}
                            labels={usage.get(tpl.id) ?? []}
                            productId={sampleProduct}
                            menuOpen={menu === tpl.id}
                            confirming={confirm === tpl.id}
                            busy={busy}
                            onOpen={() => open(tpl)}
                            onMenu={() => { setMenu(menu === tpl.id ? null : tpl.id); setConfirm(null); }}
                            onCopy={() => void copy(tpl)}
                            onAskDelete={() => { setMenu(null); setConfirm(tpl.id); }}
                            onDelete={() => void remove(tpl)}
                            onCancel={() => setConfirm(null)}
                        />
                    ))}
                </div>
            )}

            {gallery && (
                <Portal>
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(12,18,32,.36)] p-4 backdrop-blur-sm dark:bg-[rgba(0,0,0,.6)]" onClick={() => setGallery(false)}>
                        <div role="dialog" aria-modal="true" aria-labelledby="bc-gallery" className="lp-card flex max-h-[92vh] w-full max-w-[940px] flex-col gap-4 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && setGallery(false)}>
                            <div className="flex items-start gap-3">
                                <div className="flex flex-1 flex-col gap-1">
                                    <h2 id="bc-gallery" className="m-0 text-[22px] font-extrabold tracking-[-0.02em] text-lp-ink">{t("bc.galleryTitle")}</h2>
                                    <p className="m-0 text-[14px] text-lp-ink-2">{t("bc.galleryLead")}</p>
                                </div>
                                <button type="button" autoFocus onClick={() => setGallery(false)} aria-label={t("bc.close")} className="flex h-10 w-10 items-center justify-center rounded-[12px] text-lp-ink-3 transition hover:bg-lp-raised hover:text-lp-ink">
                                    <Icon name="close" className="h-5 w-5" />
                                </button>
                            </div>
                            <StarterGrid t={t} busy={busy} onPick={pickStarter} />
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}

function Attention({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
    return (
        <div className="lp-card flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
            <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] bg-lp-warn-bg text-lp-warn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.5" /></svg>
            </span>
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-0.5">
                <span className="text-[16px] font-extrabold text-lp-ink">{title}</span>
                <span className="text-[14px] text-lp-ink-2">{text}</span>
            </div>
            <button type="button" onClick={onAction} className="min-h-[40px] rounded-[10px] border border-lp-line-2 bg-lp-surface px-3.5 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised">{action}</button>
        </div>
    );
}

function Parts({ t, tpl }: { t: T; tpl: BarcodeTemplate }) {
    return (
        <div className="flex flex-wrap gap-1">
            {tpl.structure.fields.map((f, i) => {
                const kind = f.field_type;
                if (kind === "ai") return <span key={i} className="rounded-[7px] bg-lp-g-people/[0.13] px-2 py-0.5 text-[12px] font-bold text-lp-g-people">({f.value})</span>;
                if (kind === "fnc1" || kind === "gs") return <span key={i} className="rounded-[7px] bg-lp-ink/[0.05] px-2 py-0.5 text-[12px] font-bold text-lp-ink-2">{kind.toUpperCase()}</span>;
                return (
                    <span key={i} className="inline-flex items-center gap-1 rounded-[7px] bg-lp-ink/[0.05] px-2 py-0.5 text-[12px] font-bold text-lp-ink-2">
                        {kind === "constanta" ? <b className="font-mono font-semibold text-lp-ink">{f.value}</b> : (
                            <>
                                {kind === "extra_data" ? f.value || t("bc.short.extra_data") : t(`bc.short.${kind}`)}
                                <b className="font-mono font-semibold text-lp-ink">·{f.length || "—"}</b>
                            </>
                        )}
                    </span>
                );
            })}
        </div>
    );
}

function Card({ t, tpl, labels, productId, menuOpen, confirming, busy, onOpen, onMenu, onCopy, onAskDelete, onDelete, onCancel }: {
    t: T;
    tpl: BarcodeTemplate;
    labels: Array<{ id: number; name: string }>;
    productId: string;
    menuOpen: boolean;
    confirming: boolean;
    busy: boolean;
    onOpen: () => void;
    onMenu: () => void;
    onCopy: () => void;
    onAskDelete: () => void;
    onDelete: () => void;
    onCancel: () => void;
}) {
    const problems = problemsOf(tpl.structure);
    const { preview } = useBarcodePreview(problems.length ? null : tpl.structure, productId);
    const type = tpl.structure.barcode_type;
    return (
        <article className={cx("lp-card relative flex min-w-0 flex-col", menuOpen ? "z-30" : "lp-lift")}>
            <button
                type="button"
                onClick={onOpen}
                aria-label={t("bc.openNamed", { name: tpl.name })}
                className="flex h-[150px] items-center justify-center overflow-hidden rounded-t-[20px]"
                style={{ background: "radial-gradient(circle at 50% 40%, rgb(var(--lp-g-what) / 0.14), transparent 70%), rgb(var(--lp-raised))" }}
            >
                <BarcodePicture type={type} preview={preview} size="sm" dim={problems.length > 0} />
            </button>
            <div className="flex min-w-0 flex-col gap-2 p-3.5">
                <div className="relative flex items-center gap-2">
                    <button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-[15px] font-extrabold text-lp-ink hover:underline">{tpl.name}</button>
                    <button type="button" aria-label={t("bc.actionsNamed", { name: tpl.name })} aria-haspopup="menu" aria-expanded={menuOpen} onClick={onMenu} className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] text-lp-ink-3 transition hover:bg-lp-raised hover:text-lp-ink">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                    </button>
                    {menuOpen && (
                        <>
                            <div className="fixed inset-0 z-20" onClick={onMenu} />
                            <div role="menu" className="lp-card absolute right-0 top-10 z-30 flex min-w-[210px] flex-col p-1.5">
                                <button type="button" role="menuitem" className="min-h-[38px] rounded-[9px] px-2.5 text-left text-[14px] font-bold text-lp-ink hover:bg-lp-raised" onClick={onOpen}>{t("bc.open")}</button>
                                <button type="button" role="menuitem" disabled={busy} className="min-h-[38px] rounded-[9px] px-2.5 text-left text-[14px] font-bold text-lp-ink hover:bg-lp-raised" onClick={onCopy}>{t("bc.copy")}</button>
                                <button type="button" role="menuitem" className="min-h-[38px] rounded-[9px] px-2.5 text-left text-[14px] font-bold text-lp-bad hover:bg-lp-bad-bg" onClick={onAskDelete}>{t("bc.delete")}</button>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className={cx("rounded-full px-2.5 py-0.5 text-[12px] font-extrabold", isGs1(type) ? "bg-lp-g-people/[0.13] text-lp-g-people" : "bg-lp-g-what/[0.13] text-lp-g-what")}>{SYMBOLOGY_LABEL[type] ?? type}</span>
                    <span className="font-mono text-[12px] text-lp-ink-3" title={labels.map((l) => l.name).join(", ")}>
                        {labels.length ? t("bc.usedBy", { count: labels.length }) : t("bc.unused")}
                    </span>
                </div>
                <Parts t={t} tpl={tpl} />
                {problems.length > 0 && <span className="text-[12px] font-bold leading-snug text-lp-warn">▲ {t(problems[0].key, problems[0].params)}</span>}
                {confirming && (
                    <div className="mt-1 flex flex-col gap-2 border-t border-lp-line pt-2.5">
                        <span className="text-[13px] font-bold text-lp-ink">{labels.length ? t("bc.deleteUsed", { count: labels.length }) : t("bc.deleteAsk")}</span>
                        <div className="flex gap-4">
                            <button type="button" disabled={busy} className={dangerLink} onClick={onDelete}>{t("bc.deleteYes")}</button>
                            <button type="button" className={linkButton} onClick={onCancel}>{t("bc.no")}</button>
                        </div>
                    </div>
                )}
            </div>
        </article>
    );
}

function StarterGrid({ t, busy, onPick }: { t: T; busy: boolean; onPick: (starter: Starter | null, blankType?: string) => void }) {
    const [blankType, setBlankType] = useState<string>("code128");
    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
            {STARTERS.map((starter) => (
                <button key={starter.id} type="button" disabled={busy} onClick={() => onPick(starter)} className="lp-lift flex flex-col overflow-hidden rounded-[18px] border border-lp-line bg-lp-surface text-left disabled:opacity-60">
                    <span className="flex h-[110px] items-center justify-center" style={{ background: "radial-gradient(circle at 50% 40%, rgb(var(--lp-g-what) / 0.14), transparent 70%), rgb(var(--lp-raised))" }}>
                        <BarcodePicture type={starter.type} preview={null} size="sm" />
                    </span>
                    <span className="flex flex-col gap-1 p-3">
                        <span className={cx("self-start rounded-full px-2.5 py-0.5 text-[12px] font-extrabold", isGs1(starter.type) ? "bg-lp-g-people/[0.13] text-lp-g-people" : "bg-lp-g-what/[0.13] text-lp-g-what")}>{SYMBOLOGY_LABEL[starter.type]}</span>
                        <b className="text-[14px] font-extrabold text-lp-ink">{t(`bc.st.${starter.id}`)}</b>
                        <span className="text-[12px] text-lp-ink-2">{t(`bc.st.${starter.id}Hint`)}</span>
                    </span>
                </button>
            ))}
            <div className="flex flex-col gap-2.5 rounded-[18px] border border-dashed border-lp-line-2 p-3.5">
                <b className="text-[14px] font-extrabold text-lp-ink">{t("bc.st.blank")}</b>
                <span className="text-[12px] text-lp-ink-2">{t("bc.st.blankHint")}</span>
                <label htmlFor="bc-blank-type" className="sr-only">{t("bc.typeLabel")}</label>
                <select id="bc-blank-type" value={blankType} onChange={(e) => setBlankType(e.target.value)} className="min-h-[38px] rounded-[10px] border border-lp-line-2 bg-lp-surface px-2.5 text-[13px] font-bold text-lp-ink">
                    {SYMBOLOGIES.map((id) => <option key={id} value={id}>{SYMBOLOGY_LABEL[id]}</option>)}
                </select>
                <button type="button" disabled={busy} onClick={() => onPick(null, blankType)} className="mt-auto min-h-[38px] rounded-[11px] border border-lp-line-2 bg-lp-surface px-3.5 text-[13px] font-extrabold text-lp-ink transition hover:bg-lp-raised disabled:opacity-50">
                    {t("bc.st.blankCreate")}
                </button>
            </div>
        </div>
    );
}
