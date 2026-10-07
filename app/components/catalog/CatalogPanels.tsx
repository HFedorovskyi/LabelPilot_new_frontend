"use client";

// Side panels of the Products list: folders (a server-side convenience, not sent to the
// stations) and the extra fields every product can fill in (a template can print any of them).

import React, { useState } from "react";
import { api } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n";
import type { Attribute, Folder, Product } from "@/lib/products";
import { cx, Icon } from "@/app/components/stations/shared";
import { dangerLink, linkButton } from "@/app/components/print/shared";

type T = (key: string, params?: Record<string, string | number>) => string;

/** The fields an EU food label needs besides name, weight and dates (Regulation 1169/2011). */
const LMIV_FIELDS = ["prd.lmiv.ingredients", "prd.lmiv.storage", "prd.lmiv.nutrition", "prd.lmiv.operator"];

function PanelFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    const { t } = useTranslation();
    return (
        <aside
            aria-label={title}
            className="flex w-full min-w-0 flex-col overflow-hidden rounded-[18px] border border-lp-line bg-lp-surface lg:sticky lg:top-0 lg:max-h-[calc(100vh-60px)] lg:w-[400px] lg:flex-none lg:overflow-y-auto"
        >
            <div className="flex items-center gap-2.5 border-b border-lp-line px-[18px] py-4">
                <h2 className="m-0 min-w-0 flex-1 text-[18px] font-extrabold text-lp-ink">{title}</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t("stp.close")}
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-lp-line bg-lp-surface text-lp-ink-2 transition hover:border-lp-line-2 hover:bg-lp-raised"
                >
                    <Icon name="close" className="h-4 w-4" />
                </button>
            </div>
            <div className="flex flex-col gap-3.5 px-[18px] pb-5 pt-4">{children}</div>
        </aside>
    );
}

function AddRow({ id, label, placeholder, busy, onAdd }: { id: string; label: string; placeholder: string; busy: boolean; onAdd: (name: string) => Promise<void> }) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const submit = async () => {
        const value = name.trim();
        if (!value) return;
        await onAdd(value);
        setName("");
    };
    return (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <label htmlFor={id} className="sr-only">{label}</label>
            <input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={placeholder}
                maxLength={255}
                className="min-h-[42px] min-w-0 flex-1 rounded-[10px] border border-lp-line-2 bg-lp-surface px-3 text-[14px] text-lp-ink outline-none focus:border-lp-accent"
            />
            <button type="submit" disabled={busy || !name.trim()} className="min-h-[42px] rounded-[10px] bg-lp-accent px-3.5 text-[14px] font-extrabold text-[#fff] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                {t("prd.create")}
            </button>
        </form>
    );
}

/** Runs an action, shows its failure in the panel. */
function useAction(t: T, onChanged: () => void) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const run = async (operation: () => Promise<unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await operation();
            onChanged();
        } catch (e) {
            setError(t("prd.err", { message: e instanceof Error ? e.message : String(e) }));
        } finally {
            setBusy(false);
        }
    };
    return { busy, error, run };
}

export function FoldersPanel({ folders, products, onClose, onChanged }: { folders: Folder[]; products: Product[]; onClose: () => void; onChanged: () => void }) {
    const { t } = useTranslation();
    const { busy, error, run } = useAction(t, onChanged);
    const [confirming, setConfirming] = useState<number | null>(null);
    return (
        <PanelFrame title={t("prd.foldersTitle")} onClose={onClose}>
            <span className="text-[14px] text-lp-ink-2">{t("prd.foldersText")}</span>
            <div className="flex flex-col">
                {folders.length === 0 && <span className="text-[14px] text-lp-ink-3">{t("prd.foldersNone")}</span>}
                {folders.map((folder) => {
                    const count = products.filter((p) => p.folder === folder.id).length;
                    return (
                        <div key={folder.id} className="flex min-h-[44px] flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-lp-line py-1.5">
                            <span className="min-w-0 flex-1 truncate font-bold">{folder.name}</span>
                            {confirming === folder.id ? (
                                <>
                                    <span className="text-[13px] font-extrabold">{t("prd.folderConfirm", { count })}</span>
                                    <button type="button" disabled={busy} onClick={() => void run(() => api.folders.delete(folder.id)).then(() => setConfirming(null))} className={dangerLink}>{t("prd.yesDelete")}</button>
                                    <button type="button" onClick={() => setConfirming(null)} className={linkButton}>{t("prd.no")}</button>
                                </>
                            ) : (
                                <>
                                    <span className="text-[13px] tabular-nums text-lp-ink-3">{count}</span>
                                    <button type="button" onClick={() => setConfirming(folder.id)} className={dangerLink}>{t("prd.delete")}</button>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
            <AddRow id="new-folder" label={t("prd.newFolder")} placeholder={t("prd.newFolder")} busy={busy} onAdd={(name) => run(() => api.folders.create({ name }))} />
            {error && <p role="alert" className="m-0 text-[13px] font-bold text-lp-bad">■ {error}</p>}
            <span className="text-[13px] text-lp-ink-3">{t("prd.foldersNote")}</span>
        </PanelFrame>
    );
}

export function FieldsPanel({ attributes, products, onClose, onChanged }: { attributes: Attribute[]; products: Product[]; onClose: () => void; onChanged: () => void }) {
    const { t } = useTranslation();
    const { busy, error, run } = useAction(t, onChanged);
    const [confirming, setConfirming] = useState<number | null>(null);
    const used = (name: string) => products.filter((p) => {
        const value = p.extra_data?.[name];
        return value != null && String(value).trim() !== "";
    }).length;
    const have = new Set(attributes.map((a) => a.name.trim().toLowerCase()));
    const missing = LMIV_FIELDS.map((key) => t(key)).filter((name) => !have.has(name.toLowerCase()));
    return (
        <PanelFrame title={t("prd.s.extra")} onClose={onClose}>
            <span className="text-[14px] text-lp-ink-2">{t("prd.fieldsText")}</span>
            <div className="flex flex-col">
                {attributes.length === 0 && <span className="text-[14px] text-lp-ink-3">{t("prd.fieldsNone")}</span>}
                {attributes.map((attribute) => {
                    const count = used(attribute.name);
                    return (
                        <div key={attribute.id} className="flex min-h-[44px] flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-lp-line py-1.5">
                            <span className="min-w-0 flex-1 truncate font-bold">{attribute.name}</span>
                            {confirming === attribute.id ? (
                                <>
                                    <span className="text-[13px] font-extrabold">{count ? t("prd.fieldConfirmUsed", { count }) : t("prd.fieldConfirm")}</span>
                                    <button type="button" disabled={busy} onClick={() => void run(() => api.attributes.delete(attribute.id)).then(() => setConfirming(null))} className={dangerLink}>{t("prd.yesDelete")}</button>
                                    <button type="button" onClick={() => setConfirming(null)} className={linkButton}>{t("prd.no")}</button>
                                </>
                            ) : (
                                <>
                                    <span className="text-[13px] text-lp-ink-3">{count ? t("prd.fieldUsed", { count }) : t("prd.fieldEmpty")}</span>
                                    <button type="button" onClick={() => setConfirming(attribute.id)} className={dangerLink}>{t("prd.delete")}</button>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
            <AddRow id="new-field" label={t("prd.newField")} placeholder={t("prd.newFieldPlaceholder")} busy={busy} onAdd={(name) => run(() => api.attributes.create({ name }))} />
            {missing.length > 0 && (
                <div className="flex flex-col items-start gap-2 rounded-[12px] border border-lp-line bg-lp-raised px-3.5 py-3">
                    <span className="font-extrabold">{t("prd.lmiv.title")}</span>
                    <span className="text-[13px] text-lp-ink-2">{t("prd.lmiv.text", { fields: missing.join(", ") })}</span>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(async () => { for (const name of missing) await api.attributes.create({ name }); })}
                        className={cx("min-h-[38px] rounded-[9px] border border-lp-line-2 bg-lp-surface px-3 text-[14px] font-extrabold text-lp-ink transition hover:bg-lp-raised disabled:opacity-50")}
                    >
                        {t("prd.lmiv.add")}
                    </button>
                </div>
            )}
            {error && <p role="alert" className="m-0 text-[13px] font-bold text-lp-bad">■ {error}</p>}
            <span className="text-[13px] text-lp-ink-3">{t("prd.fieldsNote")}</span>
        </PanelFrame>
    );
}
