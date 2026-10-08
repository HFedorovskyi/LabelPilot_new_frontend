"use client";

// «Упаковка и тара»: what products are packed in, how much it weighs and where it is used.
// The station subtracts the pack's tare from the scale weight (the net weight on the
// label) and adds the box's tare to the box's gross weight, so a tare of 0 g on products
// is the one problem worth a card. The weight is edited right in the row.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n";
import { stationDelivery, type Station } from "@/lib/stations";
import type { Product } from "@/lib/products";
import PageTitle from "@/app/components/shell/PageTitle";
import { cx, Icon } from "@/app/components/stations/shared";
import { dangerLink, linkButton, primaryButton } from "@/app/components/print/shared";

type Tare = { id: number; name: string; weight: number };
type Draft = { id: number | "new"; name: string; weight: string };
type Flash = { ok: boolean; text: string; action?: { label: string; run: () => void } };

/** Above this a pack's tare is more likely kilograms typed as grams. */
const PACK_TARE_SANE_G = 500;

const PATHS = {
    box: <><rect x="3" y="7" width="18" height="13" rx="1.5" /><path d="M3 7l2-4h14l2 4M10 11h4" /></>,
    tray: <><path d="M3 9h18l-2 9H5z" /><path d="M7 9V6h10v3" /></>,
    idle: <circle cx="12" cy="12" r="8" />,
    warn: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.5" /></>,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
};

function Svg({ name, className = "h-5 w-5" }: { name: keyof typeof PATHS; className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cx("flex-none", className)}>
            {PATHS[name]}
        </svg>
    );
}

const parseGrams = (text: string): number | null => {
    const value = Number(text.trim().replace(",", "."));
    return text.trim() !== "" && Number.isFinite(value) ? value : null;
};

const GRID = "grid grid-cols-[minmax(0,1fr)_auto_40px] items-center gap-x-3.5 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1.1fr)_40px]";

export default function PackagingPage() {
    const { t, lang } = useTranslation();
    const [tares, setTares] = useState<Tare[] | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [open, setOpen] = useState<number | "new" | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [focusWeight, setFocusWeight] = useState(false);
    const [confirm, setConfirm] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState<Flash | null>(null);

    const load = useCallback(async () => {
        const [packs, items] = await Promise.all([api.packs.list(), api.nomenclature.list()]);
        setTares((packs as Array<Record<string, unknown>>).map((p) => ({ id: Number(p.id), name: String(p.name ?? ""), weight: Number(p.weight) || 0 })));
        setProducts(items as Product[]);
    }, []);
    useEffect(() => {
        load().catch(() => setTares([]));
        api.stations.list().then((list: Station[]) => setStations(list)).catch(() => { });
    }, [load]);

    const uses = useMemo(() => {
        const map = new Map<number, { pack: number; box: number }>();
        for (const product of products) {
            if (product.portion_container != null) {
                const u = map.get(product.portion_container) ?? { pack: 0, box: 0 };
                u.pack += 1;
                map.set(product.portion_container, u);
            }
            if (product.box_container != null) {
                const u = map.get(product.box_container) ?? { pack: 0, box: 0 };
                u.box += 1;
                map.set(product.box_container, u);
            }
        }
        return map;
    }, [products]);
    const useOf = (id: number) => uses.get(id) ?? { pack: 0, box: 0 };
    const usedBy = (id: number) => useOf(id).pack + useOf(id).box;

    const list = useMemo(
        () => [...(tares ?? [])].sort((a, b) => usedBy(b.id) - usedBy(a.id) || a.name.localeCompare(b.name, lang)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tares, uses, lang],
    );
    const zero = list.filter((tare) => tare.weight === 0 && usedBy(tare.id) > 0);
    const zeroProducts = zero.reduce((sum, tare) => sum + usedBy(tare.id), 0);

    const grams = (weight: number) => `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(weight)} ${t("pkg.g")}`;

    // ── editing ──
    const startEdit = (tare: Tare, weightFirst = false) => {
        setOpen(tare.id);
        setDraft({ id: tare.id, name: tare.name, weight: weightFirst && tare.weight === 0 ? "" : String(tare.weight).replace(".", lang === "en" ? "." : ",") });
        setFocusWeight(weightFirst);
        setConfirm(null);
        setFlash(null);
    };
    const startNew = () => {
        setOpen("new");
        setDraft({ id: "new", name: "", weight: "" });
        setFocusWeight(false);
        setConfirm(null);
        setFlash(null);
    };
    const close = () => {
        setOpen(null);
        setDraft(null);
        setConfirm(null);
    };

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
        api.stations.list().then((all: Station[]) => setStations(all)).catch(() => { });
        setFlash(failed.length ? { ok: false, text: t("pkg.sendFailed", { names: failed.join(", ") }) } : { ok: true, text: t("pkg.sent", { count: sent }) });
    };

    const save = async () => {
        if (!draft) return;
        const name = draft.name.trim();
        const weight = parseGrams(draft.weight);
        if (!name) {
            setFlash({ ok: false, text: t("pkg.nameRequired") });
            return;
        }
        if (weight === null || weight < 0 || weight > 100000) {
            setFlash({ ok: false, text: t("pkg.weightInvalid") });
            return;
        }
        setBusy(true);
        try {
            if (draft.id === "new") await api.packs.create({ name, weight });
            else await api.packs.update(draft.id, { name, weight });
            const affected = draft.id === "new" ? 0 : usedBy(draft.id);
            await load();
            close();
            const online = stations.filter((s) => stationDelivery(s) === "network");
            setFlash({
                ok: true,
                text: affected > 0 ? t("pkg.savedUsed", { name, weight: grams(weight), count: affected }) : t("pkg.saved", { name, weight: grams(weight) }),
                action: affected > 0 && online.length > 0 ? { label: t("pkg.sendNow"), run: () => void sendToStations() } : undefined,
            });
        } catch {
            setFlash({ ok: false, text: t("pkg.saveFailed") });
        } finally {
            setBusy(false);
        }
    };

    const remove = async (tare: Tare) => {
        setBusy(true);
        try {
            await api.packs.delete(tare.id);
            await load();
            close();
            setFlash({ ok: true, text: t("pkg.deleted", { name: tare.name }) });
        } catch {
            setFlash({ ok: false, text: t("pkg.deleteFailed") });
        } finally {
            setBusy(false);
        }
    };

    const editRow = (tare: Tare | null) => {
        if (!draft) return null;
        const weight = parseGrams(draft.weight);
        const use = tare ? useOf(tare.id) : { pack: 0, box: 0 };
        const count = use.pack + use.box;
        let hint = { warn: false, text: t("pkg.hint") };
        if (weight === 0 && count > 0) hint = { warn: true, text: t("pkg.hintZero") };
        else if (weight !== null && use.pack > 0 && weight > PACK_TARE_SANE_G) hint = { warn: true, text: t("pkg.hintHeavy", { max: grams(PACK_TARE_SANE_G) }) };
        const nameId = `pkg-name-${draft.id}`;
        const weightId = `pkg-weight-${draft.id}`;
        return (
            <div
                className="col-span-full flex flex-wrap items-end gap-3 pb-2.5 pt-1.5 md:pl-[50px]"
                onKeyDown={(e) => {
                    if (e.key === "Escape") close();
                    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") void save();
                }}
            >
                <div className="flex min-w-[220px] flex-[1_1_280px] flex-col gap-1">
                    <label htmlFor={nameId} className="text-[12px] font-extrabold text-lp-ink-3">{t("pkg.name")}</label>
                    <input
                        id={nameId}
                        value={draft.name}
                        maxLength={255}
                        autoFocus={!focusWeight}
                        placeholder={t("pkg.namePlaceholder")}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="min-h-[40px] rounded-[10px] border border-lp-line-2 bg-lp-surface px-3 text-[14px] font-bold text-lp-ink outline-none transition focus:border-lp-accent"
                    />
                </div>
                <div className="flex w-[150px] flex-none flex-col gap-1">
                    <label htmlFor={weightId} className="text-[12px] font-extrabold text-lp-ink-3">{t("pkg.weight")}</label>
                    <div className="relative">
                        <input
                            id={weightId}
                            inputMode="decimal"
                            value={draft.weight}
                            autoFocus={focusWeight}
                            placeholder="0"
                            onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
                            className="min-h-[40px] w-full rounded-[10px] border border-lp-line-2 bg-lp-surface pl-3 pr-8 font-mono text-[14px] font-semibold text-lp-ink outline-none transition focus:border-lp-accent"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-lp-ink-3">{t("pkg.g")}</span>
                    </div>
                </div>
                <button type="button" disabled={busy} onClick={() => void save()} className={cx(primaryButton, "min-h-[40px]")}>{t("pkg.save")}</button>
                <button type="button" onClick={close} className={cx(linkButton, "min-h-[40px] text-[14px]")}>{t("pkg.cancel")}</button>
                <span className="flex-1" />
                {tare && <button type="button" onClick={() => setConfirm(tare.id)} className={cx(dangerLink, "min-h-[40px] text-[14px]")}>{t("pkg.delete")}</button>}
                <span className={cx("basis-full text-[12px]", hint.warn ? "font-bold text-lp-warn" : "text-lp-ink-3")}>{hint.text}</span>
                {tare && confirm === tare.id && (
                    <div className="flex basis-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-lp-line pt-2.5">
                        <span className="text-[14px] font-bold text-lp-ink">{count > 0 ? t("pkg.deleteUsed", { count }) : t("pkg.deleteAsk", { name: tare.name })}</span>
                        <button type="button" disabled={busy} onClick={() => void remove(tare)} className={cx(dangerLink, "text-[14px]")}>{t("pkg.deleteYes")}</button>
                        <button type="button" onClick={() => setConfirm(null)} className={cx(linkButton, "text-[14px]")}>{t("pkg.no")}</button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
            <PageTitle icon="packaging" eyebrow={t("nav.groupWhatWePrint")} title={t("nav.packaging")} description={t("pkg.lead")}>
                <button type="button" onClick={startNew} className={cx(primaryButton, "flex items-center gap-2")}>
                    <Icon name="plus" className="h-5 w-5" />
                    {t("pkg.add")}
                </button>
            </PageTitle>

            {zero.length > 0 && (
                <div className="lp-card flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                    <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] bg-lp-warn-bg text-lp-warn">
                        <Svg name="warn" />
                    </span>
                    <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-0.5">
                        <span className="text-[16px] font-extrabold text-lp-ink">{t("pkg.zeroTitle", { count: zeroProducts })}</span>
                        <span className="text-[14px] text-lp-ink-2">{t("pkg.zeroText")}</span>
                    </div>
                    <button type="button" onClick={() => startEdit(zero[0], true)} className="min-h-[40px] rounded-[10px] border border-lp-line-2 bg-lp-surface px-3.5 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised">
                        {t("pkg.zeroAction")}
                    </button>
                </div>
            )}

            {flash && (
                <p role="status" className={cx("m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-bold", flash.ok ? "text-lp-ok" : "text-lp-bad")}>
                    <span aria-hidden="true">{flash.ok ? "●" : "■"}</span>
                    <span>{flash.text}</span>
                    {flash.action && (
                        <button type="button" onClick={() => { const run = flash.action!.run; setFlash(null); run(); }} className={linkButton}>
                            {flash.action.label}
                        </button>
                    )}
                </p>
            )}

            {tares === null ? (
                <p className="lp-card m-0 p-7 text-center text-[14px] text-lp-ink-3">{t("pkg.loading")}</p>
            ) : list.length === 0 && open !== "new" ? (
                <section className="lp-card flex flex-col items-start gap-3 p-6">
                    <span className="text-[18px] font-extrabold text-lp-ink">{t("pkg.emptyTitle")}</span>
                    <span className="max-w-[620px] text-[14px] text-lp-ink-2">{t("pkg.emptyText")}</span>
                    <button type="button" onClick={startNew} className={primaryButton}>{t("pkg.add")}</button>
                </section>
            ) : (
                <section className="lp-card overflow-hidden" aria-label={t("pkg.listLabel")}>
                    <div className={cx(GRID, "hidden border-b border-lp-line px-[18px] py-3 text-[12px] font-extrabold text-lp-ink-3 md:grid")}>
                        <span>{t("pkg.name")}</span>
                        <span>{t("pkg.weight")}</span>
                        <span>{t("pkg.usedBy")}</span>
                        <span />
                    </div>
                    {open === "new" && (
                        <div className={cx(GRID, "border-b border-lp-line bg-lp-raised px-[18px] py-2")}>
                            <span className="flex min-h-[48px] items-center gap-3 text-[15px] font-extrabold text-lp-ink">
                                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[12px] bg-lp-accent-bg text-lp-accent-ink"><Icon name="plus" className="h-5 w-5" /></span>
                                {t("pkg.newTare")}
                            </span>
                            {editRow(null)}
                        </div>
                    )}
                    {list.map((tare) => {
                        const use = useOf(tare.id);
                        const count = use.pack + use.box;
                        const kind = use.box > 0 && use.pack === 0 ? "box" : use.pack > 0 ? "tray" : "idle";
                        const isOpen = open === tare.id;
                        const zeroUsed = tare.weight === 0 && count > 0;
                        return (
                            <div key={tare.id} className={cx(GRID, "min-h-[64px] border-b border-lp-line px-[18px] py-2 last:border-b-0", isOpen && "bg-lp-raised")}>
                                <button type="button" aria-expanded={isOpen} onClick={() => (isOpen ? close() : startEdit(tare))} className="flex min-w-0 items-center gap-3 text-left">
                                    <span className={cx(
                                        "flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[12px]",
                                        kind === "box" ? "bg-lp-t-box/[0.15] text-lp-t-box" : kind === "tray" ? "bg-lp-t-pack/[0.13] text-lp-t-pack" : "bg-lp-ink/[0.05] text-lp-ink-3",
                                    )}>
                                        <Svg name={kind} className={kind === "idle" ? "h-[18px] w-[18px]" : "h-5 w-5"} />
                                    </span>
                                    <span className="min-w-0 truncate text-[15px] font-extrabold text-lp-ink">{tare.name}</span>
                                </button>
                                <span className={cx("whitespace-nowrap font-mono text-[16px] font-semibold", zeroUsed ? "text-lp-warn" : "text-lp-ink")}>{grams(tare.weight)}</span>
                                <span className="order-last col-span-full flex flex-wrap gap-1.5 pb-1 pl-[50px] md:order-none md:col-span-1 md:pb-0 md:pl-0">
                                    {use.pack > 0 && <span className="rounded-full bg-lp-t-pack/[0.13] px-2.5 py-0.5 text-[12px] font-extrabold text-lp-t-pack">{t("pkg.asPack", { count: use.pack })}</span>}
                                    {use.box > 0 && <span className="rounded-full bg-lp-t-box/[0.15] px-2.5 py-0.5 text-[12px] font-extrabold text-lp-t-box">{t("pkg.asBox", { count: use.box })}</span>}
                                    {count === 0 && <span className="py-0.5 text-[12px] font-extrabold text-lp-ink-3">{t("pkg.unused")}</span>}
                                </span>
                                <button
                                    type="button"
                                    aria-label={t("pkg.editNamed", { name: tare.name })}
                                    title={t("pkg.edit")}
                                    onClick={() => (isOpen ? close() : startEdit(tare))}
                                    className="flex h-9 w-9 items-center justify-center rounded-[10px] text-lp-ink-3 transition hover:bg-lp-ink/[0.05] hover:text-lp-ink"
                                >
                                    <Svg name="edit" className="h-[18px] w-[18px]" />
                                </button>
                                {isOpen && editRow(tare)}
                            </div>
                        );
                    })}
                </section>
            )}

            <p className="m-0 text-[13px] text-lp-ink-2">{t("pkg.footnote")}</p>
        </div>
    );
}
