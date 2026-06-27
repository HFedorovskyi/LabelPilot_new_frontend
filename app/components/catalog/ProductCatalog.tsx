"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Product, Packaging, LabelTemplate, Station, GlobalAttribute } from "./types";
import { api } from "@/lib/api/client";
import { cx, makeEan13 } from "./utils";
import ImportModal from "./ImportModal";
import Portal from "../Portal";
import { useTranslation } from "@/lib/i18n";

export function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-white/65">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SmallButton({
  children,
  onClick,
  variant = "secondary",
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  disabled?: boolean;
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-white text-neutral-950 hover:bg-white/90"
      : variant === "danger"
        ? "bg-rose-500/15 text-rose-100 hover:bg-rose-500/20 border border-rose-500/25"
        : variant === "success"
          ? "bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20 border border-emerald-500/25"
          : variant === "secondary"
            ? "bg-white/10 text-white hover:bg-white/15 border border-white/10"
            : "text-white/75 hover:text-white hover:bg-white/10";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(base, styles)}
    >
      {children}
    </button>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20 focus:bg-white/10"
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select...",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20 focus:bg-white/10"
    >
      <option value="" className="bg-neutral-900 text-white/50">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-neutral-950">
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── small presentational helpers ─────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
      {children}
    </div>
  );
}

function RequiredTag() {
  const { t } = useTranslation();
  return (
    <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
      {t('catalog.required')}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      className={cx("shrink-0 text-white/40 transition-transform duration-300", open && "rotate-90")}
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Collapsible section (progressive disclosure) */
function Section({
  open,
  onToggle,
  label,
  summary,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white/5"
      >
        <Chevron open={open} />
        <span className="flex-1 text-sm font-medium text-white">{label}</span>
        <span className="max-w-[55%] truncate text-xs text-white/45">{summary}</span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-white/5 px-3.5 pb-4 pt-3">{children}</div>
      )}
    </div>
  );
}

function EmptyCatalog({ onImport }: { onImport: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" className="text-white/20" aria-hidden="true">
        <path d="M21 8.5 12 13 3 8.5M12 13v9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M21 8.5V17a2 2 0 0 1-1.1 1.8l-7.8 3.9a2 2 0 0 1-1.8 0l-7.8-3.9A2 2 0 0 1 2 17V8.5a2 2 0 0 1 1.1-1.8l7.8-3.9a2 2 0 0 1 1.8 0l7.8 3.9A2 2 0 0 1 21 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div className="text-sm font-medium text-white/70">{t('catalog.noProductsYet')}</div>
      <div className="text-xs text-white/40">{t('catalog.addFirstOrImport')}</div>
      <div className="mt-1">
        <SmallButton onClick={onImport}>{t('catalog.importFromTable')}</SmallButton>
      </div>
    </div>
  );
}

export default function ProductCatalog() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [packs, setPacks] = useState<Packaging[]>([]);
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [globalAttributes, setGlobalAttributes] = useState<GlobalAttribute[]>([]);

  const [query, setQuery] = useState("");

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [expDate, setExpDate] = useState("30");
  const [closeBoxCounter, setCloseBoxCounter] = useState("10");
  const [isFixedWeight, setIsFixedWeight] = useState(false);
  const [fixedWeightGrams, setFixedWeightGrams] = useState("");
  const [minWeightGrams, setMinWeightGrams] = useState("");
  const [maxWeightGrams, setMaxWeightGrams] = useState("");

  // Relation states
  const [portionContainerId, setPortionContainerId] = useState("");
  const [boxContainerId, setBoxContainerId] = useState("");
  const [packLabelId, setPackLabelId] = useState("");
  const [boxLabelId, setBoxLabelId] = useState("");

  // Extra data state (values for the global attributes)
  const [extraDataState, setExtraDataState] = useState<Record<string, string>>({});

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // New attribute input state (for Modal)
  const [newAttrName, setNewAttrName] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  // Inline form feedback (replaces alert()/silent-fail)
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);

  // Progressive-disclosure section open state (remembered for the session)
  const [openSections, setOpenSections] = useState({
    params: false,
    packaging: false,
    extra: false,
  });

  // Directory: which product cards have their extra attributes expanded
  const [expandedAttrs, setExpandedAttrs] = useState<Set<string>>(new Set());

  // Send to stations modal state
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedStationIds, setSelectedStationIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  // Manage Attributes Modal state
  const [isAttrModalOpen, setIsAttrModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [productsData, packsData, templatesData, stationsData, attributesData] = await Promise.all([
        api.nomenclature.list(),
        api.packs.list(),
        api.labels.list(),
        api.stations.list(),
        api.attributes.list()
      ]);

      // Adjust backend data to frontend model
      const mapped = productsData.map((item: any) => ({
        id: item.id.toString(),
        sku: item.article,
        name: item.name,
        createdAt: new Date(item.created).getTime(),
        expDate: item.exp_date,
        closeBoxCounter: item.close_box_counter,
        isFixedWeight: item.is_fixed_weight,
        fixedWeightGrams: item.fixed_weight_grams,
        minWeightGrams: item.min_weight_grams,
        maxWeightGrams: item.max_weight_grams,
        portionContainerId: item.portion_container,
        boxContainerId: item.box_container,
        packLabelId: item.templates_pack_label,
        boxLabelId: item.templates_box_label,
        portionContainerName: item.portion_container_name,
        boxContainerName: item.box_container_name,
        packLabelName: item.templates_pack_label_name,
        boxLabelName: item.templates_box_label_name,
        extra_data: item.extra_data // Store extra_data to display if needed later
      }));
      setProducts(mapped);

      // Map other entities
      if (Array.isArray(packsData)) setPacks(packsData);
      else if (packsData.results) setPacks(packsData.results);

      if (Array.isArray(templatesData)) setTemplates(templatesData);
      else if (templatesData.results) setTemplates(templatesData.results);

      if (Array.isArray(stationsData)) setStations(stationsData);
      else if (stationsData.results) setStations(stationsData.results);

      if (Array.isArray(attributesData)) setGlobalAttributes(attributesData);
      else if (attributesData.results) setGlobalAttributes(attributesData.results);

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p: Product) => {
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
      );
    });
  }, [products, query]);

  const toggleSection = (key: "params" | "packaging" | "extra") =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleAttrs = (id: string) =>
    setExpandedAttrs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAddGlobalAttribute = async () => {
    const n = newAttrName.trim();
    if (!n) return;
    try {
      await api.attributes.create({ name: n });
      // Refresh attributes
      const res = await api.attributes.list();
      if (Array.isArray(res)) setGlobalAttributes(res);
      else if (res.results) setGlobalAttributes(res.results);
      setNewAttrName("");
    } catch (e) {
      console.error(e);
      alert(t('catalog.errorCreateAttribute'));
    }
  };

  const handleDeleteGlobalAttribute = async (id: number, name: string) => {
    const affected = products.filter((p) => p.extra_data && p.extra_data[name] != null).length;
    if (!confirm(t('catalog.confirmDeleteAttribute', { name, affected }))) return;
    try {
      await api.attributes.delete(id);
      setGlobalAttributes(prev => prev.filter(attr => attr.id !== id));
      // cleanup local state for that key
      const next = { ...extraDataState };
      delete next[name];
      setExtraDataState(next);
    } catch (e) {
      console.error(e);
      alert(t('catalog.errorDelete'));
    }
  };

  const handleExtraDataChange = (key: string, value: string) => {
    setExtraDataState(prev => ({ ...prev, [key]: value }));
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setFormError("");
    setFormSuccess(false);
    setSku(p.sku);
    setName(p.name);
    setExpDate(String(p.expDate));
    setCloseBoxCounter(String(p.closeBoxCounter));
    setIsFixedWeight(!!p.isFixedWeight);
    setFixedWeightGrams(p.fixedWeightGrams ? String(p.fixedWeightGrams) : "");
    setMinWeightGrams(p.minWeightGrams ? String(p.minWeightGrams) : "");
    setMaxWeightGrams(p.maxWeightGrams ? String(p.maxWeightGrams) : "");

    // Set relations or empty strings
    setPortionContainerId(p.portionContainerId ? String(p.portionContainerId) : "");
    setBoxContainerId(p.boxContainerId ? String(p.boxContainerId) : "");
    setPackLabelId(p.packLabelId ? String(p.packLabelId) : "");
    setBoxLabelId(p.boxLabelId ? String(p.boxLabelId) : "");

    // Set extra data
    let extraKeys = 0;
    if (p.extra_data) {
      // Convert all values to strings for input state
      const stringifiedExtras: Record<string, string> = {};
      Object.entries(p.extra_data).forEach(([k, v]) => {
        stringifiedExtras[k] = String(v);
      });
      setExtraDataState(stringifiedExtras);
      extraKeys = Object.keys(stringifiedExtras).length;
    } else {
      setExtraDataState({});
    }

    // Auto-expand sections that hold data so the user sees their values
    setOpenSections({
      params: !!p.isFixedWeight,
      packaging: !!(p.portionContainerId || p.boxContainerId || p.packLabelId || p.boxLabelId),
      extra: extraKeys > 0,
    });

    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const resetForm = () => {
    setSku("");
    setName("");
    setExpDate("30");
    setCloseBoxCounter("10");
    setIsFixedWeight(false);
    setFixedWeightGrams("");
    setMinWeightGrams("");
    setMaxWeightGrams("");
    setPortionContainerId("");
    setBoxContainerId("");
    setPackLabelId("");
    setBoxLabelId("");
    setExtraDataState({});
    setFormError("");
    // NB: deliberately do NOT collapse the sections here. For bulk entry, once the
    // user opens "Упаковка"/"Доп. сведения" they stay open for the next product.
  };

  const addProduct = async () => {
    const s = sku.trim();
    const n = name.trim();
    setFormError("");
    if (!s || !n) {
      setFormError(t('catalog.fillSkuAndName'));
      return;
    }

    // Check for SKU uniqueness
    const isDuplicateSku = products.some(p => p.sku === s && p.id !== editingId);
    if (isDuplicateSku) {
      setFormError(t('catalog.skuAlreadyUsed'));
      return;
    }

    // Filter extra data to only include keys that currently exist as global attributes
    const extra_data: any = {};
    globalAttributes.forEach(attr => {
      const val = extraDataState[attr.name];
      if (val) extra_data[attr.name] = val;
    });

    const payload = {
      name: n,
      article: s,
      exp_date: parseInt(expDate) || 0,
      close_box_counter: parseInt(closeBoxCounter) || 0,
      is_fixed_weight: isFixedWeight,
      fixed_weight_grams: isFixedWeight ? (parseFloat(fixedWeightGrams) || 0) : 0,
      min_weight_grams: isFixedWeight ? (parseFloat(minWeightGrams) || 0) : 0,
      max_weight_grams: isFixedWeight ? (parseFloat(maxWeightGrams) || 0) : 0,
      portion_container: portionContainerId || null,
      box_container: boxContainerId || null,
      templates_pack_label: packLabelId || null,
      templates_box_label: boxLabelId || null,
      extra_data: extra_data
    };

    try {
      if (editingId) {
        await api.nomenclature.update(editingId, payload);
        setEditingId(null);
      } else {
        await api.nomenclature.create(payload);
      }

      fetchData();
      resetForm();
      setFormSuccess(true);
      window.setTimeout(() => setFormSuccess(false), 2500);

    } catch (e) {
      console.error("Failed to save product", e);
      setFormError(t('catalog.errorSave'));
    }
  };

  const removeProduct = async (id: string) => {
    if (!confirm(t('catalog.confirmDeleteProduct'))) return;
    try {
      await api.nomenclature.delete(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error("Failed to delete", e);
      alert(t('catalog.errorDelete'));
    }
  };

  const handleSendToStations = async () => {
    if (selectedStationIds.size === 0) return;
    setIsSending(true);
    try {
      await api.nomenclature.sendToStations(Array.from(selectedStationIds));
      alert(t('catalog.sentToStations'));
      setIsSendModalOpen(false);
      setSelectedStationIds(new Set());
    } catch (e) {
      console.error(e);
      alert(t('catalog.errorSend'));
    } finally {
      setIsSending(false);
    }
  };

  const toggleStation = (uuid: string) => {
    const next = new Set(selectedStationIds);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    setSelectedStationIds(next);
  };

  const packOptions = useMemo(() => packs.map(p => ({ value: p.id.toString(), label: p.name })), [packs]);
  const templateOptions = useMemo(() => templates.map(t => ({ value: t.id.toString(), label: t.name })), [templates]);

  // ── derived summaries for the collapsible sections ──────────────────────────
  const paramsSummary = t('catalog.paramsSummary', {
    days: expDate || "30",
    perBox: closeBoxCounter || "10",
    weight: isFixedWeight ? t('catalog.fixedWeightShort', { grams: fixedWeightGrams || 0 }) : t('catalog.weightByFact'),
  });
  const packagingCount = [portionContainerId, boxContainerId, packLabelId, boxLabelId].filter(Boolean).length;
  const packagingSummary = packagingCount > 0 ? t('catalog.selectedCount', { count: packagingCount }) : t('catalog.optional');
  const extraFilled = globalAttributes.filter((a) => (extraDataState[a.name] || "").trim() !== "").length;
  const extraSummary =
    globalAttributes.length === 0
      ? t('catalog.noFields')
      : extraFilled > 0
        ? t('catalog.filledOutOf', { filled: extraFilled, total: globalAttributes.length })
        : t('catalog.optional');

  const canSave = sku.trim() !== "" && name.trim() !== "";

  return (
    <div className="grid gap-4 md:grid-cols-12 relative">

      {/* Send to Stations Modal */}
      {isSendModalOpen && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">{t('catalog.sendToStations')}</h3>
            <div className="mb-4 max-h-[300px] overflow-y-auto space-y-2">
              {stations.length === 0 ? (
                <div className="text-white/50 text-sm">{t('catalog.noStationsAvailable')}</div>
              ) : (
                stations.map(st => (
                  <label key={st.station_uuid} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={selectedStationIds.has(st.station_uuid)}
                      onChange={() => toggleStation(st.station_uuid)}
                      className="w-4 h-4 rounded border-white/20 bg-transparent text-emerald-500 focus:ring-emerald-500/20"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{st.name || st.station_uuid}</div>
                      <div className="text-xs text-white/50">{st.station_ip} • {st.is_online ? "Online" : "Offline"}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <SmallButton onClick={() => setIsSendModalOpen(false)}>{t('catalog.cancel')}</SmallButton>
              <SmallButton
                variant="primary"
                disabled={selectedStationIds.size === 0 || isSending}
                onClick={handleSendToStations}
              >
                {isSending ? t('catalog.sending') : t('catalog.send')}
              </SmallButton>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Manage Attributes Modal */}
      {isAttrModalOpen && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">{t('catalog.manageFields')}</h3>
            <p className="text-sm text-white/60 mb-4">{t('catalog.manageFieldsHint')}</p>

            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <Input value={newAttrName} onChange={setNewAttrName} placeholder={t('catalog.newFieldPlaceholder')} />
              </div>
              <SmallButton onClick={handleAddGlobalAttribute} disabled={!newAttrName.trim()} variant="primary">
                {t('catalog.create')}
              </SmallButton>
            </div>

            <div className="mb-4 max-h-[300px] overflow-y-auto space-y-2 border-t border-white/10 pt-4">
              {globalAttributes.length === 0 ? (
                <div className="text-white/50 text-sm italic">{t('catalog.noCreatedFields')}</div>
              ) : (
                globalAttributes.map(attr => (
                  <div key={attr.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-sm font-medium text-white">{attr.name}</span>
                    <button
                      onClick={() => handleDeleteGlobalAttribute(attr.id, attr.name)}
                      className="text-xs text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded transition"
                    >
                      {t('catalog.delete')}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end mt-6">
              <SmallButton onClick={() => setIsAttrModalOpen(false)}>{t('catalog.close')}</SmallButton>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <ImportModal
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            fetchData();
          }}
          globalAttributes={globalAttributes}
          packs={packs}
          templates={templates}
        />
      )}

      <div className="md:col-span-5">
        <Card
          title={editingId ? t('catalog.editProduct') : t('catalog.addProduct')}
          subtitle={editingId ? t('catalog.editProductSubtitle') : t('catalog.addProductSubtitle')}
          right={
            !editingId ? (
              <SmallButton onClick={() => setIsImportModalOpen(true)}>
                {t('catalog.import')}
              </SmallButton>
            ) : null
          }
        >
          <div className="grid gap-3">
            {/* Essentials — the clear starting point */}
            <div
              className="relative grid gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-4 pl-5"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)" }}
            >
              <span className="absolute left-0 top-3 bottom-3 w-[2.5px] rounded-full bg-indigo-400/80" />

              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <Eyebrow>{t('catalog.skuLabel')}</Eyebrow>
                  <RequiredTag />
                </div>
                <Input value={sku} onChange={(v) => setSku(v.replace(/\D/g, ""))} placeholder={t('catalog.skuPlaceholder')} />
                <div className="text-xs text-white/45">{t('catalog.skuHint')}</div>
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <Eyebrow>{t('catalog.nameLabel')}</Eyebrow>
                  <RequiredTag />
                </div>
                <Input value={name} onChange={setName} placeholder={t('catalog.namePlaceholder')} />
              </div>

              {formError && (
                <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{formError}</div>
              )}
            </div>

            {/* Optional details — collapsed by default */}
            <Section
              open={openSections.params}
              onToggle={() => toggleSection("params")}
              label={t('catalog.params')}
              summary={paramsSummary}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Eyebrow>{t('catalog.shelfLifeDays')}</Eyebrow>
                  <Input value={expDate} onChange={setExpDate} type="number" placeholder="30" />
                </div>
                <div className="grid gap-1">
                  <Eyebrow>{t('catalog.itemsPerBox')}</Eyebrow>
                  <Input value={closeBoxCounter} onChange={setCloseBoxCounter} type="number" placeholder="10" />
                </div>
              </div>

              <div className="grid gap-2 border-t border-white/10 pt-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFixedWeight}
                    onChange={(e) => setIsFixedWeight(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-transparent text-emerald-500 focus:ring-emerald-500/20"
                  />
                  <span className="text-sm font-medium text-white">{t('catalog.fixedWeight')}</span>
                </label>
                {isFixedWeight && (
                  <div className="grid gap-3">
                    <div className="grid gap-1">
                      <Eyebrow>{t('catalog.fixedWeightValue')}</Eyebrow>
                      <Input value={fixedWeightGrams} onChange={setFixedWeightGrams} type="number" placeholder="0" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1">
                        <Eyebrow>{t('catalog.minWeight')}</Eyebrow>
                        <Input value={minWeightGrams} onChange={setMinWeightGrams} type="number" placeholder="0" />
                      </div>
                      <div className="grid gap-1">
                        <Eyebrow>{t('catalog.maxWeight')}</Eyebrow>
                        <Input value={maxWeightGrams} onChange={setMaxWeightGrams} type="number" placeholder="0" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Section>

            <Section
              open={openSections.packaging}
              onToggle={() => toggleSection("packaging")}
              label={t('catalog.packagingAndLabels')}
              summary={packagingSummary}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Eyebrow>{t('catalog.packagingPortion')}</Eyebrow>
                  <Select value={portionContainerId} onChange={setPortionContainerId} options={packOptions} placeholder={t('catalog.notSelected')} />
                </div>
                <div className="grid gap-1">
                  <Eyebrow>{t('catalog.packagingBox')}</Eyebrow>
                  <Select value={boxContainerId} onChange={setBoxContainerId} options={packOptions} placeholder={t('catalog.notSelected')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Eyebrow>{t('catalog.labelPortion')}</Eyebrow>
                  <Select value={packLabelId} onChange={setPackLabelId} options={
                    templates
                      .filter(tpl => !tpl.scheme?.canvas?.labelType || tpl.scheme.canvas.labelType === "pack")
                      .map((tpl) => ({ value: tpl.id.toString(), label: tpl.name }))
                  } placeholder={t('catalog.notSelected')} />
                </div>
                <div className="grid gap-1">
                  <Eyebrow>{t('catalog.labelBox')}</Eyebrow>
                  <Select value={boxLabelId} onChange={setBoxLabelId} options={
                    templates
                      .filter(tpl => tpl.scheme?.canvas?.labelType === "box")
                      .map((tpl) => ({ value: tpl.id.toString(), label: tpl.name }))
                  } placeholder={t('catalog.notSelected')} />
                </div>
              </div>
            </Section>

            <Section
              open={openSections.extra}
              onToggle={() => toggleSection("extra")}
              label={t('catalog.extraInfo', { count: globalAttributes.length })}
              summary={extraSummary}
            >
              <div className="flex items-center justify-end">
                <SmallButton
                  variant="ghost"
                  onClick={() => setIsAttrModalOpen(true)}
                  title={t('catalog.manageSharedFieldsTitle')}
                >
                  {t('catalog.configureFields')}
                </SmallButton>
              </div>

              {globalAttributes.length === 0 && (
                <div className="text-xs text-white/30 italic">{t('catalog.noConfiguredFields')}</div>
              )}

              {globalAttributes.map((attr) => (
                <div key={attr.id} className="grid gap-1">
                  <Eyebrow>{attr.name}</Eyebrow>
                  <Input
                    value={extraDataState[attr.name] || ""}
                    onChange={(v) => handleExtraDataChange(attr.name, v)}
                    placeholder={t('catalog.valuePlaceholder')}
                  />
                </div>
              ))}
            </Section>

            {/* Sticky footer — primary action always reachable */}
            <div className="sticky bottom-0 -mx-5 -mb-5 mt-1 border-t border-white/10 bg-neutral-950/70 px-5 py-3 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <SmallButton variant="primary" disabled={!canSave} onClick={addProduct}>
                    {editingId ? t('catalog.save') : t('catalog.addProduct')}
                  </SmallButton>
                  {editingId && <SmallButton onClick={cancelEdit}>{t('catalog.cancel')}</SmallButton>}
                  {!canSave && (
                    <span className="text-xs text-white/40">{t('catalog.fillSkuAndName')}</span>
                  )}
                  {formSuccess && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {t('catalog.productAdded')}
                    </span>
                  )}
                </div>
                {!editingId && (
                  <span className="text-[11px] text-white/40">{t('catalog.defaultFooter', { days: expDate || "30", perBox: closeBoxCounter || "10" })}</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="md:col-span-7">
        <Card
          title={t('catalog.productDirectory')}
          subtitle={isLoading ? t('catalog.totalLoading', { count: products.length }) : t('catalog.total', { count: products.length })}
          right={
            <div className="w-48">
              <Input value={query} onChange={setQuery} placeholder={t('catalog.searchPlaceholder')} />
            </div>
          }
        >
          {products.length === 0 && !isLoading ? (
            <EmptyCatalog onImport={() => setIsImportModalOpen(true)} />
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/50">{t('catalog.nothingFound', { query })}</div>
          ) : (
            <div className="grid gap-2.5">
              {filtered.map((p) => {
                const attrEntries = p.extra_data
                  ? Object.entries(p.extra_data).filter(([, v]) => v != null && String(v).trim() !== "")
                  : [];
                const expanded = expandedAttrs.has(p.id);
                const pkg = p.boxContainerName || p.portionContainerName;
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition-colors hover:bg-white/5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs text-white/55">{p.sku}</div>
                        <div className="mt-0.5 text-sm font-medium leading-snug text-white">{p.name}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/50">
                          <span>{t('catalog.shelfLifeShort', { days: p.expDate })}</span>
                          <span className="text-white/20">·</span>
                          <span>{t('catalog.perBoxShort', { count: p.closeBoxCounter })}</span>
                          {pkg && (
                            <>
                              <span className="text-white/20">·</span>
                              <span>{pkg}</span>
                            </>
                          )}
                          {p.isFixedWeight && (
                            <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                              {t('catalog.fixedWeightShort', { grams: p.fixedWeightGrams })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <SmallButton variant="ghost" onClick={() => handleEdit(p)} title={t('catalog.edit')}>{t('catalog.editShort')}</SmallButton>
                        <SmallButton variant="ghost" onClick={() => removeProduct(p.id)} title={t('catalog.delete')}>{t('catalog.deleteShort')}</SmallButton>
                      </div>
                    </div>

                    {attrEntries.length > 0 && (
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() => toggleAttrs(p.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-400/10 px-2.5 py-1 text-xs text-indigo-200 transition-colors hover:bg-indigo-400/15"
                        >
                          <Chevron open={expanded} />
                          {t('catalog.extraParamsCount', { count: attrEntries.length })}
                        </button>
                        {expanded && (
                          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {attrEntries.map(([k, v]) => (
                              <div key={k} className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
                                <span className="block text-[11px] font-medium uppercase tracking-wide leading-none text-white/60">
                                  {k}
                                </span>
                                <span className="mt-1 block text-xs leading-normal text-white/90 line-clamp-2" title={String(v)}>
                                  {String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
