"use client";

// Products: the catalogue labels are printed from. Problems first (products a station cannot
// print, changes the stations have not got yet), then the list with folders, search and bulk
// actions. A product opens on its own page; folders and the extra fields open in the side
// panel (canvas «LabelPilot Server — редизайн», board Товары v2).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useTranslation, type Lang } from "@/lib/i18n";
import { stationDelivery, type Station } from "@/lib/stations";
import {
    hasPackTemplate, isPackTemplate, productsNotOnStations, receivingStations, stationsBehind,
    type Attribute, type Folder, type Pack, type Product, type Template,
} from "@/lib/products";
import type { NavKey } from "@/app/components/shell/Sidebar";
import { cx, Icon } from "@/app/components/stations/shared";
import { linkButton, primaryButton } from "@/app/components/print/shared";
import ImportModal from "./ImportModal";
import ProductPage from "./ProductPage";
import { FieldsPanel, FoldersPanel } from "./CatalogPanels";

type View = { kind: "list" } | { kind: "product"; id: number | "new"; copyOf?: Product };
type FolderFilter = "all" | "none" | number;
type Message = { ok: boolean; text: string };
type T = (key: string, params?: Record<string, string | number>) => string;

/** An error whose message is already a full sentence for the user. */
class Shown extends Error { }

const asList = <R,>(data: unknown): R[] => (Array.isArray(data) ? data : ((data as { results?: R[] })?.results ?? []));

export function weightText(product: Product, t: T, lang: Lang): string {
    if (!product.is_fixed_weight) return t("prd.weight.scale");
    const grams = product.fixed_weight_grams;
    const value = grams >= 1000
        ? t("prd.kg", { n: new Intl.NumberFormat(lang, { maximumFractionDigits: 3 }).format(grams / 1000) })
        : t("prd.g", { n: new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(grams) });
    return `${value} ℮`;
}

export default function ProductsPage({ onNavigate, onCatalogChanged }: { onNavigate: (tab: NavKey) => void; onCatalogChanged?: () => void }) {
    const { t, lang } = useTranslation();
    const [products, setProducts] = useState<Product[] | null>(null);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [attributes, setAttributes] = useState<Attribute[]>([]);
    const [packs, setPacks] = useState<Pack[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [view, setView] = useState<View>({ kind: "list" });
    const [panel, setPanel] = useState<"folders" | "fields" | null>(null);
    const [folder, setFolder] = useState<FolderFilter>("all");
    const [query, setQuery] = useState("");
    const [onlyNoTemplate, setOnlyNoTemplate] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkConfirm, setBulkConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<Message | null>(null);
    const [importOpen, setImportOpen] = useState(false);

    const loadProducts = useCallback(
        () => api.nomenclature.list().then((d: unknown) => setProducts(asList<Product>(d))).catch(() => setProducts((p) => p ?? [])),
        [],
    );
    const loadFolders = useCallback(() => api.folders.list().then((d: unknown) => setFolders(asList<Folder>(d))).catch(() => { }), []);
    // Fields in the order they were created (the API lists the newest first).
    const loadAttributes = useCallback(
        () => api.attributes.list().then((d: unknown) => setAttributes(asList<Attribute>(d).sort((a, b) => a.id - b.id))).catch(() => { }),
        [],
    );
    const loadStations = useCallback(() => api.stations.list().then((d: unknown) => setStations(asList<Station>(d))).catch(() => { }), []);

    useEffect(() => {
        void loadProducts();
        void loadFolders();
        void loadAttributes();
        void loadStations();
        api.packs.list().then((d: unknown) => setPacks(asList<Pack>(d))).catch(() => { });
        api.labels.list().then((d: unknown) => setTemplates(asList<Template>(d))).catch(() => { });
        const id = setInterval(loadStations, 30000);
        return () => clearInterval(id);
    }, [loadProducts, loadFolders, loadAttributes, loadStations]);

    const refresh = useCallback(() => {
        void loadProducts();
        void loadFolders();
        onCatalogChanged?.();
    }, [loadProducts, loadFolders, onCatalogChanged]);

    const act = async (operation: () => Promise<string>) => {
        setBusy(true);
        setMessage(null);
        try {
            setMessage({ ok: true, text: await operation() });
        } catch (e) {
            setMessage({ ok: false, text: e instanceof Shown ? e.message : t("prd.err", { message: e instanceof Error ? e.message : String(e) }) });
        } finally {
            setBusy(false);
        }
    };

    // ── what the list shows ──────────────────────────────────────────────────
    const list = useMemo(() => products ?? [], [products]);
    const viewing = view.kind === "product" && view.id !== "new" ? list.find((p) => p.id === view.id) ?? null : null;
    // The open product was deleted (here or elsewhere): back to the list.
    const viewGone = view.kind === "product" && view.id !== "new" && products !== null && viewing === null;
    useEffect(() => {
        if (viewGone) setView({ kind: "list" });
    }, [viewGone]);
    const folderName = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);
    const packName = useMemo(() => new Map(packs.map((p) => [p.id, p.name])), [packs]);
    const templateName = useMemo(() => new Map(templates.map((tpl) => [tpl.id, tpl.name])), [templates]);
    const noTemplate = list.filter((p) => !hasPackTemplate(p));
    const notOnStations = productsNotOnStations(list, stations);
    const behind = stationsBehind(list, stations);
    const behindOnline = behind.filter((s) => stationDelivery(s) === "network");
    const q = query.trim().toLowerCase();
    const visible = list
        .filter((p) => folder === "all" || (folder === "none" ? p.folder == null : p.folder === folder))
        .filter((p) => !onlyNoTemplate || !hasPackTemplate(p))
        .filter((p) => !q || `${p.name} ${p.article}`.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, lang));
    const visibleIds = visible.map((p) => p.id);
    const chosen = visible.filter((p) => selected.has(p.id));
    const allChosen = visible.length > 0 && chosen.length === visible.length;

    const toggle = (id: number) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const toggleAll = () => setSelected(allChosen ? new Set() : new Set(visibleIds));
    const clearSelection = () => { setSelected(new Set()); setBulkConfirm(false); };

    // ── actions ──────────────────────────────────────────────────────────────
    const sendToStations = () => act(async () => {
        let sent = 0;
        const failed: string[] = [];
        for (const station of behindOnline) {
            try {
                await api.stations.sync(station.station_uuid);
                sent += 1;
            } catch {
                failed.push(station.station_name);
            }
        }
        await loadStations();
        const offline = behind.filter((s) => stationDelivery(s) === "file").map((s) => s.station_name);
        const parts = sent > 0 ? [t("prd.sent", { count: sent })] : [];
        if (failed.length) parts.push(t("prd.sendFailed", { names: failed.join(", ") }));
        if (offline.length) parts.push(t("prd.sendOffline", { names: offline.join(", ") }));
        if (failed.length) throw new Shown(parts.join(" "));
        return parts.join(" ");
    });
    const bulk = (operation: (product: Product) => Promise<unknown>, done: (count: number) => string) => act(async () => {
        const targets = chosen;
        for (const product of targets) await operation(product);
        clearSelection();
        refresh();
        return done(targets.length);
    });
    const assignTemplate = (value: string) => {
        if (!value) return;
        const name = templateName.get(Number(value)) ?? "";
        void bulk((p) => api.nomenclature.update(p.id, { templates_pack_label: Number(value) }), (count) => t("prd.bulk.templateDone", { name, count }));
    };
    const moveToFolder = (value: string) => {
        if (!value) return;
        const target = value === "none" ? null : Number(value);
        const name = target == null ? t("prd.noFolder") : folderName.get(target) ?? "";
        void bulk((p) => api.nomenclature.update(p.id, { folder: target }), (count) => t("prd.bulk.folderDone", { name, count }));
    };
    const deleteChosen = () => void bulk((p) => api.nomenclature.delete(p.id), (count) => t("prd.bulk.deleted", { count }));

    // ── a product's own page ─────────────────────────────────────────────────
    if (view.kind === "product" && !viewGone) {
        const product = viewing;
        if (view.id !== "new" && !product) return <p className="m-0 text-[14px] text-lp-ink-3">…</p>;
        const index = product ? visibleIds.indexOf(product.id) : -1;
        return (
            <ProductPage
                key={String(view.id)}
                product={product}
                copyOf={view.copyOf}
                products={list}
                folders={folders}
                attributes={attributes}
                packs={packs}
                templates={templates}
                defaultFolder={typeof folder === "number" ? folder : null}
                position={index >= 0 ? { index, total: visibleIds.length, prevId: visibleIds[index - 1] ?? null, nextId: visibleIds[index + 1] ?? null } : null}
                behindStations={!product || receivingStations(stations).length === 0 ? null : productsNotOnStations([product], stations).length > 0}
                onBack={() => setView({ kind: "list" })}
                onOpen={(id) => setView({ kind: "product", id })}
                onCopy={(copy) => setView({ kind: "product", id: "new", copyOf: copy })}
                onFields={() => { setView({ kind: "list" }); setPanel("fields"); }}
                onSaved={(saved, created) => {
                    setProducts((prev) => (created ? [...(prev ?? []), saved] : (prev ?? []).map((p) => (p.id === saved.id ? saved : p))));
                    if (created) setView({ kind: "product", id: saved.id });
                    void loadFolders();
                    onCatalogChanged?.();
                }}
                onDeleted={(gone) => {
                    setProducts((prev) => (prev ?? []).filter((p) => p.id !== gone.id));
                    setView({ kind: "list" });
                    setMessage({ ok: true, text: t("prd.deleted", { name: gone.name }) });
                    void loadFolders();
                    onCatalogChanged?.();
                }}
            />
        );
    }

    // ── the list ─────────────────────────────────────────────────────────────
    const compact = panel !== null;
    const columns = compact
        ? "grid grid-cols-[22px_minmax(0,1fr)_64px_86px_150px] gap-3.5"
        : "grid grid-cols-[22px_minmax(0,1fr)_72px_92px_200px_170px] gap-3.5";
    const chips: { id: FolderFilter; label: string; count: number }[] = [
        { id: "all", label: t("prd.folder.all"), count: list.length },
        { id: "none", label: t("prd.noFolder"), count: list.filter((p) => p.folder == null).length },
        ...folders.map((f) => ({ id: f.id as FolderFilter, label: f.name, count: list.filter((p) => p.folder === f.id).length })),
    ];
    const packTemplates = templates.filter(isPackTemplate);
    const select = "min-h-[36px] rounded-[9px] border border-lp-line-2 bg-lp-surface px-2 text-[13px] font-bold text-lp-ink";

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
            <div className="flex flex-wrap items-end gap-3">
                <div className="mr-auto flex max-w-[640px] flex-col gap-1">
                    <span className="text-[13px] font-bold text-lp-coral">{t("nav.groupWhatWePrint")}</span>
                    <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.02em] text-lp-ink">{t("nav.catalog")}</h1>
                    <p className="m-0 text-[14px] text-lp-ink-2">{t("nav.catalogDesc")}</p>
                </div>
                <button type="button" onClick={() => setImportOpen(true)} className="min-h-[44px] rounded-[11px] border border-lp-line-2 bg-lp-surface px-4 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised">
                    {t("prd.import")}
                </button>
                <button type="button" onClick={() => setView({ kind: "product", id: "new" })} className={cx(primaryButton, "flex items-center gap-2")}>
                    <Icon name="plus" className="h-5 w-5" />
                    {t("prd.add")}
                </button>
            </div>

            {(noTemplate.length > 0 || notOnStations.length > 0) && (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-3">
                    {noTemplate.length > 0 && (
                        <AttentionCard
                            icon={<path d="M3 11.5V4a1 1 0 0 1 1-1h7.5l9.2 9.2a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0zM7 7l4 4M11 7l-4 4" />}
                            title={t("prd.noTemplate.title", { count: noTemplate.length })}
                            text={t("prd.noTemplate.text")}
                            action={t("prd.noTemplate.action")}
                            onAction={() => { setOnlyNoTemplate(true); setFolder("all"); setQuery(""); clearSelection(); }}
                        />
                    )}
                    {notOnStations.length > 0 && (
                        <AttentionCard
                            icon={<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" />}
                            title={t("prd.unsent.title")}
                            text={t("prd.unsent.text", { count: notOnStations.length })}
                            action={behindOnline.length > 0 ? t("prd.unsent.action") : t("prd.unsent.openStations")}
                            primary={behindOnline.length > 0}
                            disabled={busy}
                            onAction={behindOnline.length > 0 ? sendToStations : () => onNavigate("stations")}
                        />
                    )}
                </div>
            )}

            {message && (
                <p role="status" className={cx("m-0 rounded-[12px] px-4 py-3 text-[14px] font-bold", message.ok ? "bg-lp-ok-bg text-lp-ok" : "bg-lp-bad-bg text-lp-bad")}>
                    {message.ok ? "●" : "■"} {message.text}
                </p>
            )}

            <div className="flex flex-col items-start gap-4 lg:flex-row">
                <section aria-labelledby="catalog-list" className="w-full min-w-0 flex-1 overflow-hidden rounded-[18px] border border-lp-line bg-lp-surface">
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 px-[18px] pb-2.5 pt-3.5">
                        <h2 id="catalog-list" className="m-0 text-[16px] font-extrabold">
                            {t("prd.list")} <span className="font-bold tabular-nums text-lp-ink-3">{list.length}</span>
                        </h2>
                        <div className="relative ml-auto min-w-[160px] flex-[0_1_260px]">
                            <label htmlFor="catalog-search" className="sr-only">{t("prd.search")}</label>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-lp-ink-3">
                                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                            </svg>
                            <input
                                id="catalog-search"
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t("prd.search")}
                                className="min-h-[40px] w-full rounded-[10px] border border-lp-line bg-lp-bg pl-9 pr-3 text-[14px] text-lp-ink outline-none focus:border-lp-accent"
                            />
                        </div>
                    </div>

                    {chosen.length === 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 px-[18px] pb-3">
                            {chips.map((chip) => (
                                <button
                                    key={String(chip.id)}
                                    type="button"
                                    aria-pressed={folder === chip.id}
                                    onClick={() => setFolder(chip.id)}
                                    className={cx(
                                        "min-h-[34px] rounded-full border px-3 text-[13px] font-extrabold",
                                        folder === chip.id ? "border-lp-accent bg-lp-accent-bg text-lp-accent-ink" : "border-lp-line bg-lp-surface text-lp-ink-2 hover:bg-lp-raised",
                                    )}
                                >
                                    {chip.label} <span className="font-bold tabular-nums opacity-75">{chip.count}</span>
                                </button>
                            ))}
                            {onlyNoTemplate && (
                                <button type="button" onClick={() => setOnlyNoTemplate(false)} className="min-h-[34px] rounded-full border border-lp-warn bg-lp-warn-bg px-3 text-[13px] font-extrabold text-lp-warn">
                                    {t("prd.onlyNoTemplate")} ✕
                                </button>
                            )}
                            <button type="button" onClick={() => setPanel("folders")} className={cx(linkButton, "ml-1")}>{t("prd.folders")}</button>
                        </div>
                    ) : (
                        <div className="mx-[18px] mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] bg-lp-accent-bg px-3 py-2">
                            <span className="font-extrabold text-lp-accent-ink">{t("prd.bulk.selected", { count: chosen.length })}</span>
                            <label htmlFor="bulk-template" className="sr-only">{t("prd.bulk.template")}</label>
                            <select id="bulk-template" value="" disabled={busy} onChange={(e) => assignTemplate(e.target.value)} className={select}>
                                <option value="">{t("prd.bulk.template")}</option>
                                {packTemplates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
                            </select>
                            <label htmlFor="bulk-folder" className="sr-only">{t("prd.bulk.folder")}</label>
                            <select id="bulk-folder" value="" disabled={busy} onChange={(e) => moveToFolder(e.target.value)} className={select}>
                                <option value="">{t("prd.bulk.folder")}</option>
                                <option value="none">{t("prd.noFolder")}</option>
                                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            {bulkConfirm ? (
                                <>
                                    <span className="text-[13px] font-extrabold">{t("prd.bulk.confirmDelete", { count: chosen.length })}</span>
                                    <button type="button" disabled={busy} onClick={deleteChosen} className="border-0 bg-transparent p-0 text-[13px] font-extrabold text-lp-bad hover:underline">{t("prd.yesDelete")}</button>
                                    <button type="button" onClick={() => setBulkConfirm(false)} className={linkButton}>{t("prd.no")}</button>
                                </>
                            ) : (
                                <button type="button" onClick={() => setBulkConfirm(true)} className="border-0 bg-transparent p-0 text-[13px] font-extrabold text-lp-bad hover:underline">{t("prd.delete")}</button>
                            )}
                            <button type="button" onClick={clearSelection} className={cx(linkButton, "ml-auto")}>{t("prd.bulk.clear")}</button>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <div className={compact ? "min-w-[540px]" : "min-w-[780px]"}>
                            <div className={cx(columns, "items-center border-t border-lp-line bg-lp-raised px-[18px] py-[9px] text-[12px] font-bold text-lp-ink-3")}>
                                <input
                                    type="checkbox"
                                    aria-label={t("prd.selectAll")}
                                    checked={allChosen}
                                    ref={(el) => { if (el) el.indeterminate = chosen.length > 0 && !allChosen; }}
                                    onChange={toggleAll}
                                    className="m-0 h-[18px] w-[18px] accent-lp-accent"
                                />
                                <span>{t("prd.col.product")}</span>
                                <span>{t("prd.col.shelf")}</span>
                                <span>{t("prd.col.weight")}</span>
                                {!compact && <span>{t("prd.col.pack")}</span>}
                                <span>{t("prd.col.label")}</span>
                            </div>
                            {products === null ? (
                                <p className="m-0 border-t border-lp-line px-[18px] py-7 text-center text-lp-ink-3">…</p>
                            ) : list.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 border-t border-lp-line px-[18px] py-10 text-center">
                                    <span className="text-[16px] font-extrabold">{t("prd.empty.title")}</span>
                                    <span className="text-[14px] text-lp-ink-2">{t("prd.empty.text")}</span>
                                </div>
                            ) : visible.length === 0 ? (
                                <p className="m-0 border-t border-lp-line px-[18px] py-7 text-center text-lp-ink-3">
                                    {onlyNoTemplate && noTemplate.length === 0 ? t("prd.noTemplate.none") : t("prd.nothingFound")}
                                </p>
                            ) : visible.map((product) => {
                                const sub = [
                                    t("prd.article", { article: product.article }),
                                    product.folder != null ? folderName.get(product.folder) : null,
                                    compact ? packName.get(product.portion_container ?? -1) ?? null : null,
                                ].filter(Boolean).join(" · ");
                                const label = product.templates_pack_label != null ? templateName.get(product.templates_pack_label) ?? "—" : null;
                                return (
                                    <div key={product.id} className={cx(columns, "items-center border-t border-lp-line px-[18px] py-[11px]", selected.has(product.id) ? "bg-lp-accent-bg" : "hover:bg-lp-raised")}>
                                        <input
                                            type="checkbox"
                                            aria-label={t("prd.select", { name: product.name })}
                                            checked={selected.has(product.id)}
                                            onChange={() => toggle(product.id)}
                                            className="m-0 h-[18px] w-[18px] accent-lp-accent"
                                        />
                                        <span className="flex min-w-0 flex-col">
                                            <button
                                                type="button"
                                                onClick={() => setView({ kind: "product", id: product.id })}
                                                className="truncate border-0 bg-transparent p-0 text-left text-[14px] font-extrabold text-lp-ink hover:underline"
                                            >
                                                {product.name}
                                            </button>
                                            <span className="truncate text-[12px] tabular-nums text-lp-ink-3">{sub}</span>
                                        </span>
                                        <span className="text-[14px] tabular-nums text-lp-ink-2">{t("prd.days", { n: product.exp_date })}</span>
                                        <span className="text-[14px] tabular-nums text-lp-ink-2">{weightText(product, t, lang)}</span>
                                        {!compact && (
                                            <span className="truncate text-[14px] text-lp-ink-2">
                                                {t("prd.packPerBox", { pack: packName.get(product.portion_container ?? -1) ?? t("prd.noPack"), count: product.close_box_counter })}
                                            </span>
                                        )}
                                        <span className={cx("truncate text-[14px]", label ? "font-semibold text-lp-ink-2" : "font-extrabold text-lp-warn")}>
                                            {label ?? `▲ ${t("prd.noTemplate.short")}`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-lp-line bg-lp-raised px-[18px] py-3 text-[13px]">
                        <span className="text-lp-ink-3">
                            {attributes.length ? t("prd.fieldsList", { names: attributes.map((a) => a.name).join(", ") }) : t("prd.fieldsNone")}
                        </span>
                        <button type="button" onClick={() => setPanel("fields")} className={linkButton}>{t("prd.fieldsSetup")}</button>
                    </div>
                </section>

                {panel === "folders" && (
                    <FoldersPanel folders={folders} products={list} onClose={() => setPanel(null)} onChanged={() => { void loadFolders(); void loadProducts(); }} />
                )}
                {panel === "fields" && (
                    <FieldsPanel attributes={attributes} products={list} onClose={() => setPanel(null)} onChanged={() => { void loadAttributes(); void loadProducts(); }} />
                )}
            </div>

            {importOpen && (
                <ImportModal
                    onClose={() => setImportOpen(false)}
                    onSuccess={() => { setImportOpen(false); refresh(); }}
                    globalAttributes={attributes.map((a) => ({ ...a, created: "" }))}
                    packs={packs.map((p) => ({ id: String(p.id), name: p.name }))}
                    templates={templates.map((tpl) => ({ id: String(tpl.id), name: tpl.name, scheme: tpl.scheme }))}
                />
            )}
        </div>
    );
}

function AttentionCard({ icon, title, text, action, onAction, primary = false, disabled = false }: {
    icon: React.ReactNode;
    title: string;
    text: string;
    action: string;
    onAction: () => void;
    primary?: boolean;
    disabled?: boolean;
}) {
    return (
        <div className="flex flex-col gap-2.5 rounded-[16px] border border-lp-line bg-lp-surface p-4">
            <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-lp-warn-bg text-lp-warn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">{icon}</svg>
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[16px] font-extrabold">{title}</span>
                    <span className="text-[14px] text-lp-ink-2">{text}</span>
                </div>
            </div>
            <button
                type="button"
                disabled={disabled}
                onClick={onAction}
                className={cx(
                    "min-h-[40px] self-start rounded-[10px] px-3.5 text-[14px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50",
                    primary ? "border-0 bg-lp-accent text-[#fff] hover:brightness-110" : "border border-lp-line-2 bg-lp-surface text-lp-ink hover:bg-lp-raised",
                )}
            >
                {action}
            </button>
        </div>
    );
}
