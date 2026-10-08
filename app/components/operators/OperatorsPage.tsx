"use client";

// «Операторы станций»: who works at the stations, with what code (printed on the label as
// the operator number) and PIN, on which stations. Edited right in the row. A code shared
// by two working operators — labels can no longer tell who packed — is the one problem
// worth a card. Per-person output is not shown on purpose (EU rules on monitoring staff).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { operatorsApi, type Operator, type UpdateOperatorPayload } from "@/lib/api/operators";
import { useTranslation } from "@/lib/i18n";
import { stationDelivery, type Station } from "@/lib/stations";
import PageTitle from "@/app/components/shell/PageTitle";
import type { NavKey } from "@/app/components/shell/Sidebar";
import { cx, Icon } from "@/app/components/stations/shared";
import { dangerLink, linkButton, primaryButton } from "@/app/components/print/shared";

type Draft = { id: number | "new"; name: string; code: string; station: string; pin: string; active: boolean; clearPin: boolean };
type Flash = { ok: boolean; text: string };
type Tab = "active" | "off" | "all";

const GRID = "grid grid-cols-[minmax(0,1fr)_auto_40px] items-center gap-x-3.5 md:grid-cols-[minmax(0,1.4fr)_110px_minmax(0,1fr)_150px_40px]";
const input = "min-h-[40px] w-full rounded-[10px] border border-lp-line-2 bg-lp-surface px-3 text-[14px] font-bold text-lp-ink outline-none transition focus:border-lp-accent";

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "?";
const PIN_OK = /^\d{4,8}$/;

export default function OperatorsPage({ onNavigate }: { onNavigate?: (key: NavKey) => void }) {
    const { t, lang } = useTranslation();
    const [operators, setOperators] = useState<Operator[] | null>(null);
    const [stations, setStations] = useState<Station[]>([]);
    const [changedAt, setChangedAt] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>("active");
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState<number | "new" | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [confirm, setConfirm] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState<Flash | null>(null);

    const load = useCallback(async () => {
        const [list, status] = await Promise.all([operatorsApi.list(), operatorsApi.status().catch(() => ({ changed_at: null }))]);
        setOperators(list);
        setChangedAt(status.changed_at);
    }, []);
    const loadStations = useCallback(() => {
        api.stations.list().then((rows: Station[]) => setStations(rows)).catch(() => { });
    }, []);
    useEffect(() => {
        load().catch(() => setOperators([]));
        loadStations();
    }, [load, loadStations]);

    const all = operators ?? [];
    const stationName = useMemo(() => new Map(stations.map((s) => [s.id, s.station_name])), [stations]);
    const codeKey = (code: string | null) => (code ?? "").trim().toLowerCase();
    const codeCount = useMemo(() => {
        const counts = new Map<string, number>();
        for (const op of all) if (op.is_active && codeKey(op.short_code)) counts.set(codeKey(op.short_code), (counts.get(codeKey(op.short_code)) ?? 0) + 1);
        return counts;
    }, [all]);
    const shared = all.filter((op) => op.is_active && (codeCount.get(codeKey(op.short_code)) ?? 0) > 1);
    const sharedCodes = [...new Set(shared.map((op) => (op.short_code ?? "").trim()))];

    // Stations that took data before the last operator change still have the old list.
    const behind = changedAt
        ? stations.filter((s) => stationDelivery(s) !== "blocked" && (!s.data_pushed_at || Date.parse(s.data_pushed_at) < Date.parse(changedAt)))
        : [];
    const behindOnline = behind.filter((s) => stationDelivery(s) === "network");
    const behindFile = behind.filter((s) => stationDelivery(s) === "file");

    const q = query.trim().toLowerCase();
    const visible = all
        .filter((op) => tab === "all" || (tab === "active" ? op.is_active : !op.is_active))
        .filter((op) => !q || `${op.full_name} ${op.short_code ?? ""}`.toLowerCase().includes(q))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, lang));
    const count = (which: Tab) => all.filter((op) => which === "all" || (which === "active" ? op.is_active : !op.is_active)).length;

    const startEdit = (op: Operator) => {
        setOpen(op.id);
        setDraft({ id: op.id, name: op.full_name, code: op.short_code ?? "", station: op.station == null ? "" : String(op.station), pin: "", active: op.is_active, clearPin: false });
        setConfirm(null);
        setFlash(null);
    };
    const startNew = () => {
        setOpen("new");
        setDraft({ id: "new", name: "", code: "", station: "", pin: "", active: true, clearPin: false });
        setConfirm(null);
        setFlash(null);
        setTab("active");
        setQuery("");
    };
    const close = () => {
        setOpen(null);
        setDraft(null);
        setConfirm(null);
    };

    const sendToStations = async () => {
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
        loadStations();
        setFlash(failed.length ? { ok: false, text: t("op.sendFailed", { names: failed.join(", ") }) } : { ok: true, text: t("op.sent", { count: sent }) });
    };

    const save = async () => {
        if (!draft) return;
        const name = draft.name.trim();
        if (!name) return setFlash({ ok: false, text: t("op.nameRequired") });
        if (draft.pin && !PIN_OK.test(draft.pin)) return setFlash({ ok: false, text: t("op.pinRule") });
        setBusy(true);
        try {
            const payload: UpdateOperatorPayload = {
                full_name: name,
                short_code: draft.code.trim() || null,
                station: draft.station ? Number(draft.station) : null,
                is_active: draft.active,
            };
            if (draft.clearPin) payload.pin = "";
            else if (draft.pin) payload.pin = draft.pin;
            if (draft.id === "new") await operatorsApi.create({ ...payload, full_name: name });
            else await operatorsApi.update(draft.id, payload);
            await load();
            close();
            setFlash({ ok: true, text: t(draft.id === "new" ? "op.added" : "op.saved", { name }) });
        } catch (e) {
            setFlash({ ok: false, text: e instanceof Error && e.message ? e.message : t("op.saveFailed") });
        } finally {
            setBusy(false);
        }
    };

    const remove = async (op: Operator) => {
        setBusy(true);
        try {
            await operatorsApi.remove(op.id);
            await load();
            close();
            setFlash({ ok: true, text: t("op.deleted", { name: op.full_name }) });
        } catch (e) {
            setFlash({ ok: false, text: e instanceof Error && e.message ? e.message : t("op.saveFailed") });
        } finally {
            setBusy(false);
        }
    };

    const editRow = (op: Operator | null) => {
        if (!draft) return null;
        const id = String(draft.id);
        const clash = draft.code.trim() && all.some((other) => other.id !== draft.id && other.is_active && codeKey(other.short_code) === codeKey(draft.code));
        const hint = clash ? { warn: true, text: t("op.hintClash") } : draft.pin && !PIN_OK.test(draft.pin) ? { warn: true, text: t("op.pinRule") } : { warn: false, text: t("op.hint") };
        return (
            <div
                className="col-span-full flex flex-wrap items-end gap-3 pb-3 pt-1.5 md:pl-[50px]"
                onKeyDown={(e) => {
                    if (e.key === "Escape") close();
                    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && (e.target as HTMLInputElement).type !== "checkbox") void save();
                }}
            >
                <div className="flex min-w-[220px] flex-[1_1_260px] flex-col gap-1">
                    <label htmlFor={`op-name-${id}`} className="text-[12px] font-extrabold text-lp-ink-3">{t("op.name")}</label>
                    <input id={`op-name-${id}`} autoFocus value={draft.name} maxLength={200} placeholder={t("op.namePlaceholder")} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={input} />
                </div>
                <div className="flex w-[130px] flex-none flex-col gap-1">
                    <label htmlFor={`op-code-${id}`} className="text-[12px] font-extrabold text-lp-ink-3">{t("op.codeLabel")}</label>
                    <input id={`op-code-${id}`} value={draft.code} maxLength={50} placeholder="07" onChange={(e) => setDraft({ ...draft, code: e.target.value })} className={cx(input, "font-mono", clash && "border-lp-warn")} />
                </div>
                <div className="flex w-[210px] flex-none flex-col gap-1">
                    <label htmlFor={`op-station-${id}`} className="text-[12px] font-extrabold text-lp-ink-3">{t("op.where")}</label>
                    <select id={`op-station-${id}`} value={draft.station} onChange={(e) => setDraft({ ...draft, station: e.target.value })} className={input}>
                        <option value="">{t("op.allStations")}</option>
                        {stations.map((s) => <option key={s.id} value={s.id}>{s.station_name}</option>)}
                    </select>
                </div>
                <div className="flex w-[150px] flex-none flex-col gap-1">
                    <label htmlFor={`op-pin-${id}`} className="text-[12px] font-extrabold text-lp-ink-3">{op?.has_pin ? t("op.newPin") : t("op.pin")}</label>
                    <input
                        id={`op-pin-${id}`}
                        inputMode="numeric"
                        autoComplete="off"
                        disabled={draft.clearPin}
                        value={draft.pin}
                        placeholder={op?.has_pin ? t("op.pinKeep") : t("op.pinOptional")}
                        onChange={(e) => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                        className={cx(input, "font-mono disabled:opacity-50")}
                    />
                </div>
                <label className="flex min-h-[40px] items-center gap-2 text-[14px] font-bold text-lp-ink">
                    <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--lp-accent))]" />
                    {t("op.canWork")}
                </label>
                <span className={cx("basis-full text-[12px]", hint.warn ? "font-bold text-lp-warn" : "text-lp-ink-3")}>{hint.text}</span>
                <div className="flex basis-full flex-wrap items-center gap-x-4 gap-y-2">
                    <button type="button" disabled={busy} onClick={() => void save()} className={cx(primaryButton, "min-h-[40px]")}>{t("op.save")}</button>
                    <button type="button" onClick={close} className={cx(linkButton, "text-[14px]")}>{t("op.cancel")}</button>
                    {op?.has_pin && (
                        <label className="flex items-center gap-2 text-[14px] font-bold text-lp-ink-2">
                            <input type="checkbox" checked={draft.clearPin} onChange={(e) => setDraft({ ...draft, clearPin: e.target.checked, pin: "" })} className="h-4 w-4 accent-[rgb(var(--lp-accent))]" />
                            {t("op.clearPin")}
                        </label>
                    )}
                    <span className="flex-1" />
                    {op && <button type="button" onClick={() => setConfirm(op.id)} className={cx(dangerLink, "text-[14px]")}>{t("op.delete")}</button>}
                </div>
                {op && confirm === op.id && (
                    <div className="flex basis-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-lp-line pt-2.5">
                        <span className="text-[14px] font-bold text-lp-ink">{t("op.deleteAsk", { name: op.full_name })}</span>
                        <button type="button" disabled={busy} onClick={() => void remove(op)} className={cx(dangerLink, "text-[14px]")}>{t("op.deleteYes")}</button>
                        <button type="button" onClick={() => setConfirm(null)} className={cx(linkButton, "text-[14px]")}>{t("op.no")}</button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
            <PageTitle icon="operators" eyebrow={t("nav.groupPeople")} title={t("nav.operators")} description={t("op.lead")}>
                <button type="button" onClick={startNew} className={cx(primaryButton, "flex items-center gap-2")}>
                    <Icon name="plus" className="h-5 w-5" />
                    {t("op.add")}
                </button>
            </PageTitle>

            {shared.length > 0 && (
                <div className="lp-card flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                    <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] bg-lp-warn-bg text-lp-warn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.5" /></svg>
                    </span>
                    <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-0.5">
                        <span className="text-[16px] font-extrabold text-lp-ink">{t("op.sharedTitle", { codes: sharedCodes.map((c) => `«${c}»`).join(", ") })}</span>
                        <span className="text-[14px] text-lp-ink-2">{t("op.sharedText", { names: shared.map((op) => op.full_name).join(", ") })}</span>
                    </div>
                    <button type="button" onClick={() => { setTab("active"); setQuery(""); startEdit(shared[shared.length - 1]); }} className="min-h-[40px] rounded-[10px] border border-lp-line-2 bg-lp-surface px-3.5 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised">
                        {t("op.fix")}
                    </button>
                </div>
            )}

            {flash && (
                <p role="status" className={cx("m-0 flex items-start gap-2 text-[14px] font-bold", flash.ok ? "text-lp-ok" : "text-lp-bad")}>
                    <span aria-hidden="true">{flash.ok ? "●" : "■"}</span>
                    <span>{flash.text}</span>
                </p>
            )}

            {behind.length > 0 && (
                <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-bold text-lp-ink-2">
                    <span>{t("op.behind", { names: behind.map((s) => s.station_name).join(", ") })}</span>
                    {behindOnline.length > 0 && <button type="button" disabled={busy} onClick={() => void sendToStations()} className={linkButton}>{t("op.sendNow")}</button>}
                    {behindFile.length > 0 && <button type="button" onClick={() => onNavigate?.("stations")} className={linkButton}>{t("op.fileHint")}</button>}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <div role="tablist" aria-label={t("op.tabsLabel")} className="flex flex-wrap gap-1.5">
                    {(["active", "off", "all"] as const).map((id) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={tab === id}
                            onClick={() => setTab(id)}
                            className={cx("flex min-h-[38px] items-center gap-2 rounded-full px-3.5 text-[13px] font-extrabold transition", tab === id ? "bg-lp-surface text-lp-ink shadow-[var(--lp-shadow)]" : "text-lp-ink-2 hover:bg-lp-surface/60")}
                        >
                            {t(`op.tab.${id}`)}
                            <span className="font-mono text-[12px] text-lp-ink-3">{count(id)}</span>
                        </button>
                    ))}
                </div>
                <span className="flex-1" />
                <div className="relative w-full max-w-[260px]">
                    <label htmlFor="op-search" className="sr-only">{t("op.search")}</label>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lp-ink-3" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                    <input id="op-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("op.search")} className={cx(input, "rounded-[12px] pl-9 font-semibold")} />
                </div>
            </div>

            {operators === null ? (
                <p className="lp-card m-0 p-7 text-center text-[14px] text-lp-ink-3">{t("op.loading")}</p>
            ) : all.length === 0 && open !== "new" ? (
                <section className="lp-card flex flex-col items-start gap-3 p-6">
                    <span className="text-[18px] font-extrabold text-lp-ink">{t("op.emptyTitle")}</span>
                    <span className="max-w-[640px] text-[14px] text-lp-ink-2">{t("op.emptyText")}</span>
                    <button type="button" onClick={startNew} className={primaryButton}>{t("op.add")}</button>
                </section>
            ) : (
                <section className="lp-card overflow-hidden" aria-label={t("nav.operators")}>
                    <div className={cx(GRID, "hidden border-b border-lp-line px-[18px] py-3 text-[12px] font-extrabold text-lp-ink-3 md:grid")}>
                        <span>{t("op.col.who")}</span>
                        <span>{t("op.col.code")}</span>
                        <span>{t("op.col.where")}</span>
                        <span>{t("op.col.login")}</span>
                        <span />
                    </div>
                    {open === "new" && (
                        <div className={cx(GRID, "border-b border-lp-line bg-lp-raised px-[18px] py-2")}>
                            <span className="flex min-h-[48px] items-center gap-3 text-[15px] font-extrabold text-lp-ink">
                                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-lp-accent-bg text-lp-accent-ink"><Icon name="plus" className="h-5 w-5" /></span>
                                {t("op.newOperator")}
                            </span>
                            {editRow(null)}
                        </div>
                    )}
                    {visible.length === 0 && open !== "new" && <p className="m-0 p-6 text-center text-[14px] text-lp-ink-3">{t("op.nothing")}</p>}
                    {visible.map((op) => {
                        const isOpen = open === op.id;
                        const dup = op.is_active && (codeCount.get(codeKey(op.short_code)) ?? 0) > 1;
                        return (
                            <div key={op.id} className={cx(GRID, "min-h-[64px] border-b border-lp-line px-[18px] py-2 last:border-b-0", isOpen && "bg-lp-raised")}>
                                <button type="button" aria-expanded={isOpen} onClick={() => (isOpen ? close() : startEdit(op))} className={cx("flex min-w-0 items-center gap-3 text-left", !op.is_active && "opacity-55")}>
                                    <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-lp-g-people/[0.13] text-[13px] font-extrabold text-lp-g-people">{initials(op.full_name)}</span>
                                    <span className="min-w-0 truncate text-[15px] font-extrabold text-lp-ink">{op.full_name}</span>
                                </button>
                                <span className={cx("whitespace-nowrap", op.short_code ? "font-mono text-[14px] font-semibold" : "text-[13px] font-bold text-lp-ink-3", dup ? "text-lp-warn" : op.short_code && "text-lp-ink", !op.is_active && "opacity-55")}>
                                    {op.short_code || t("op.noCode")}
                                </span>
                                <span className="order-last col-span-full flex flex-wrap items-center gap-x-3 gap-y-1 pb-1 pl-[50px] md:contents">
                                    <span className="truncate text-[13px] font-bold text-lp-ink-2">
                                        {op.station == null ? t("op.allStations") : stationName.get(op.station) ?? t("op.stationN", { n: op.station })}
                                    </span>
                                    <span className="flex flex-wrap gap-1.5">
                                        <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold", op.has_pin ? "bg-lp-g-people/[0.13] text-lp-g-people" : "bg-lp-ink/[0.05] text-lp-ink-3")}>
                                            {op.has_pin && (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                                            )}
                                            {op.has_pin ? t("op.pinSet") : t("op.noPin")}
                                        </span>
                                        {!op.is_active && <span className="rounded-full bg-lp-ink/[0.05] px-2.5 py-0.5 text-[12px] font-extrabold text-lp-ink-3">{t("op.off")}</span>}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    aria-label={t("op.editNamed", { name: op.full_name })}
                                    title={t("op.edit")}
                                    onClick={() => (isOpen ? close() : startEdit(op))}
                                    className="flex h-9 w-9 items-center justify-center rounded-[10px] text-lp-ink-3 transition hover:bg-lp-ink/[0.05] hover:text-lp-ink"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
                                </button>
                                {isOpen && editRow(op)}
                            </div>
                        );
                    })}
                </section>
            )}

            <p className="m-0 text-[13px] text-lp-ink-2">{t("op.footnote")}</p>
        </div>
    );
}
