"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Product, Packaging, LabelTemplate, Station, GlobalAttribute } from "./types";
import { api } from "@/lib/api/client";
import { cx, makeEan13 } from "./utils";

function Card({
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

function SmallButton({
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

function Input({
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

function Select({
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

export default function ProductCatalog() {
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

  // Send to stations modal state
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedStationIds, setSelectedStationIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  // Manage Attributes Modal state
  const [isAttrModalOpen, setIsAttrModalOpen] = useState(false);

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
    return products.filter((p) => {
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
      );
    });
  }, [products, query]);

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
      alert("Ошибка при создании атрибута (возможно, имя уже занято)");
    }
  };

  const handleDeleteGlobalAttribute = async (id: number, name: string) => {
    if (!confirm(`Удалить поле "${name}"? ВНИМАНИЕ: Это поле и его данные удалятся у ВСЕХ товаров!`)) return;
    try {
      await api.attributes.delete(id);
      setGlobalAttributes(prev => prev.filter(attr => attr.id !== id));
      // cleanup local state for that key
      const next = { ...extraDataState };
      delete next[name];
      setExtraDataState(next);
    } catch (e) {
      console.error(e);
      alert("Ошибка при удалении");
    }
  };

  const handleExtraDataChange = (key: string, value: string) => {
    setExtraDataState(prev => ({ ...prev, [key]: value }));
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setSku(p.sku);
    setName(p.name);
    setExpDate(String(p.expDate));
    setCloseBoxCounter(String(p.closeBoxCounter));

    // Set relations or empty strings
    setPortionContainerId(p.portionContainerId ? String(p.portionContainerId) : "");
    setBoxContainerId(p.boxContainerId ? String(p.boxContainerId) : "");
    setPackLabelId(p.packLabelId ? String(p.packLabelId) : "");
    setBoxLabelId(p.boxLabelId ? String(p.boxLabelId) : "");

    // Set extra data
    if (p.extra_data) {
      // Convert all values to strings for input state
      const stringifiedExtras: Record<string, string> = {};
      Object.entries(p.extra_data).forEach(([k, v]) => {
        stringifiedExtras[k] = String(v);
      });
      setExtraDataState(stringifiedExtras);
    } else {
      setExtraDataState({});
    }
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
    setPortionContainerId("");
    setBoxContainerId("");
    setPackLabelId("");
    setBoxLabelId("");
    setExtraDataState({});
  };

  const addProduct = async () => {
    const s = sku.trim();
    const n = name.trim();
    if (!s || !n) return;

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

    } catch (e) {
      console.error("Failed to save product", e);
      alert("Ошибка при сохранении номенклатуры");
    }
  };

  const removeProduct = async (id: string) => {
    if (!confirm("Вы уверены?")) return;
    try {
      await api.nomenclature.delete(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error("Failed to delete", e);
      alert("Ошибка при удалении");
    }
  };

  const handleSendToStations = async () => {
    if (selectedStationIds.size === 0) return;
    setIsSending(true);
    try {
      await api.nomenclature.sendToStations(Array.from(selectedStationIds));
      alert("Номенклатура отправлена на выбранные станции!");
      setIsSendModalOpen(false);
      setSelectedStationIds(new Set());
    } catch (e) {
      console.error(e);
      alert("Ошибка при отправке");
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

  return (
    <div className="grid gap-4 md:grid-cols-12 relative">

      {/* Send to Stations Modal */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">Отправить на станции</h3>
            <div className="mb-4 max-h-[300px] overflow-y-auto space-y-2">
              {stations.length === 0 ? (
                <div className="text-white/50 text-sm">Нет доступных станций.</div>
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
              <SmallButton onClick={() => setIsSendModalOpen(false)}>Отмена</SmallButton>
              <SmallButton
                variant="primary"
                disabled={selectedStationIds.size === 0 || isSending}
                onClick={handleSendToStations}
              >
                {isSending ? "Отправка..." : "Отправить"}
              </SmallButton>
            </div>
          </div>
        </div>
      )}

      {/* Manage Attributes Modal */}
      {isAttrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">Управление атрибутами</h3>
            <p className="text-sm text-white/60 mb-4">Добавьте поля, которые должны быть у всех товаров. Удаление поля приведет к удалению данных из всех номенклатур.</p>

            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <Input value={newAttrName} onChange={setNewAttrName} placeholder="Новое поле (напр. 'Состав')" />
              </div>
              <SmallButton onClick={handleAddGlobalAttribute} disabled={!newAttrName.trim()} variant="primary">
                Создать
              </SmallButton>
            </div>

            <div className="mb-4 max-h-[300px] overflow-y-auto space-y-2 border-t border-white/10 pt-4">
              {globalAttributes.length === 0 ? (
                <div className="text-white/50 text-sm italic">Нет созданных атрибутов.</div>
              ) : (
                globalAttributes.map(attr => (
                  <div key={attr.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-sm font-medium text-white">{attr.name}</span>
                    <button
                      onClick={() => handleDeleteGlobalAttribute(attr.id, attr.name)}
                      className="text-xs text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded transition"
                    >
                      Удалить
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end mt-6">
              <SmallButton onClick={() => setIsAttrModalOpen(false)}>Закрыть</SmallButton>
            </div>
          </div>
        </div>
      )}

      <div className="md:col-span-5">
        <Card
          title={editingId ? "Редактирование товара" : "Добавить товар"}
          subtitle={editingId ? "Изменение существующей номенклатуры" : "Создание новой номенклатуры"}
          right={
            <div className="flex gap-2">
              {editingId && (
                <SmallButton onClick={cancelEdit}>
                  Отмена
                </SmallButton>
              )}
              <SmallButton variant="primary" onClick={addProduct}>
                {editingId ? "Сохранить" : "Добавить"}
              </SmallButton>
            </div>
          }
        >
          <div className="grid gap-3">
            <div className="grid gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                Артикул / SKU
              </div>
              <Input value={sku} onChange={setSku} placeholder="Напр. TEA-001" />
            </div>

            <div className="grid gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                Название
              </div>
              <Input value={name} onChange={setName} placeholder="Напр. Чай зелёный" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Срок годности (сут)
                </div>
                <Input value={expDate} onChange={setExpDate} type="number" placeholder="30" />
              </div>
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Вложений в короб
                </div>
                <Input value={closeBoxCounter} onChange={setCloseBoxCounter} type="number" placeholder="10" />
              </div>
            </div>

            {/* Relations */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Упаковка (порция)
                </div>
                <Select value={portionContainerId} onChange={setPortionContainerId} options={packOptions} placeholder="Не выбрано" />
              </div>
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Упаковка (короб)
                </div>
                <Select value={boxContainerId} onChange={setBoxContainerId} options={packOptions} placeholder="Не выбрано" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Этикетка (порция)
                </div>
                <Select value={packLabelId} onChange={setPackLabelId} options={templateOptions} placeholder="Не выбрано" />
              </div>
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Этикетка (короб)
                </div>
                <Select value={boxLabelId} onChange={setBoxLabelId} options={templateOptions} placeholder="Не выбрано" />
              </div>
            </div>

            {/* Global Attributes Values */}
            <div className="grid gap-2 pt-2 border-t border-white/10 mt-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Доп. параметры
                </div>
                <SmallButton
                  onClick={() => setIsAttrModalOpen(true)}
                  variant="secondary"
                  title="Управление глобальными полями"
                >
                  Настроить поля
                </SmallButton>
              </div>

              {globalAttributes.length === 0 && <div className="text-xs text-white/30 italic mb-2">Нет настроенных полей</div>}

              {globalAttributes.map((attr) => (
                <div key={attr.id} className="grid gap-1">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">{attr.name}</div>
                  <Input
                    value={extraDataState[attr.name] || ""}
                    onChange={(v) => handleExtraDataChange(attr.name, v)}
                    placeholder={`Значение...`}
                  />
                </div>
              ))}
            </div>

          </div>
        </Card>
      </div>

      <div className="md:col-span-7">
        <Card
          title="Справочник товаров"
          subtitle={`Всего: ${products.length} ${isLoading ? '(Загрузка...)' : ''}`}
          right={
            <div className="flex gap-2">
              <SmallButton variant="success" onClick={() => setIsSendModalOpen(true)}>
                Отправить на станции
              </SmallButton>
              <div className="w-48">
                <Input value={query} onChange={setQuery} placeholder="Поиск..." />
              </div>
            </div>
          }
        >
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-12 gap-0 bg-white/5 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-white/55">
              <div className="col-span-5">Номенклатура</div>
              <div className="col-span-3">Св-ва</div>
              <div className="col-span-4 text-right">Детали</div>
            </div>

            <div className="divide-y divide-white/10">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-white/60">Нет записей</div>
              ) : (
                filtered.map((p) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-12 items-start gap-4 px-3 py-3 hover:bg-white/5 transition-colors"
                  >
                    {/* Identity Column */}
                    <div className="col-span-5 grid gap-1">
                      <div className="font-mono text-sm font-bold text-white/90">{p.sku}</div>
                      <div className="text-sm text-white font-medium leading-snug">{p.name}</div>

                      {/* Global Attributes Display */}
                      {p.extra_data && Object.keys(p.extra_data).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {Object.entries(p.extra_data).map(([k, v]) => (
                            <div key={k} className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/80 border border-white/5">
                              <span className="opacity-60 uppercase">{k}:</span>
                              <span className="font-medium">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Properties Column */}
                    <div className="col-span-3 text-xs text-white/60 space-y-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider opacity-50">Упаковка</span>
                        <span className="text-white/90">{p.portionContainerName || "—"}</span>
                        <span className="text-white/80">{p.boxContainerName || "—"}</span>
                      </div>
                      <div className="flex flex-col pt-1">
                        <span className="text-[10px] uppercase tracking-wider opacity-50">Шаблоны</span>
                        <span className="text-white/90">{p.packLabelName || "—"}</span>
                      </div>
                    </div>

                    {/* Details & Actions Column */}
                    <div className="col-span-4 flex flex-col items-end gap-2">
                      <div className="text-right text-xs text-white/60">
                        <div>Срок: <span className="text-white">{p.expDate} дн.</span></div>
                        <div>Вложений: <span className="text-white">{p.closeBoxCounter}</span></div>
                      </div>
                      <div className="flex gap-1">
                        <SmallButton
                          onClick={() => handleEdit(p)}
                          title="Редактировать"
                        >
                          Изм.
                        </SmallButton>
                        <SmallButton
                          variant="danger"
                          title="Удалить"
                          onClick={() => removeProduct(p.id)}
                        >
                          Удал.
                        </SmallButton>
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
