"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Packaging } from "./types";
import { api } from "@/lib/api/client";
import { cx } from "./utils";

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
  variant?: "primary" | "secondary" | "ghost" | "danger";
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
  type?: "text" | "number";
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
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20 focus:bg-white/10"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-neutral-950">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function toNum(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function PackagingManager() {
  const [packaging, setPackaging] = useState<Packaging[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [pName, setPName] = useState("");
  const [weightGrams, setWeightGrams] = useState("0");
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const packsData = await api.packs.list();

      const mappedPackaging = packsData.map((item: any) => ({
        id: item.id.toString(),
        name: item.name,
        weightGrams: item.weight,
        createdAt: new Date(item.created).getTime(),
      }));

      setPackaging(mappedPackaging);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setPName("");
    setWeightGrams("0");
    setEditingId(null);
  };

  const handleEdit = (p: Packaging) => {
    setEditingId(p.id);
    setPName(p.name);
    setWeightGrams(String(p.weightGrams || 0));
  };

  const cancelEdit = () => {
    resetForm();
  };

  const savePackaging = async () => {
    const name = pName.trim();
    const weight = toNum(weightGrams) ?? 0;
    if (!name) return;

    const payload = {
      name,
      weight: weight,
    };

    try {
      if (editingId) {
        await api.packs.update(editingId, payload);
      } else {
        await api.packs.create(payload);
      }
      fetchData();
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Ошибка сохранения упаковки");
    }
  };

  const removePackaging = async (id: string) => {
    if (!confirm("Вы уверены?")) return;
    try {
      await api.packs.delete(id);
      setPackaging((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error(e);
      alert("Ошибка при удалении");
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-12">
      <div className="md:col-span-5">
        <Card
          title={editingId ? "Редактировать упаковку" : "Добавить упаковку"}
          subtitle="Укажите название и вес упаковки."
          right={
            <div className="flex gap-2">
              {editingId && (
                <SmallButton onClick={cancelEdit}>
                  Отмена
                </SmallButton>
              )}
              <SmallButton variant="primary" onClick={savePackaging}>
                {editingId ? "Сохранить" : "Добавить"}
              </SmallButton>
            </div>
          }
        >
          <div className="grid gap-3">
            <div className="grid gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                Название
              </div>
              <Input value={pName} onChange={setPName} placeholder="Напр. Подложка 150г" />
            </div>

            <div className="grid gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                Вес (г)
              </div>
              <Input type="number" value={weightGrams} onChange={setWeightGrams} placeholder="0" />
            </div>
          </div>
        </Card>
      </div>

      <div className="md:col-span-7">
        <Card
          title="Справочник упаковок"
          subtitle={`Всего: ${packaging.length} ${isLoading ? '(Загрузка...)' : ''}`}
        >
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-12 gap-0 bg-white/5 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-white/55">
              <div className="col-span-6">Название</div>
              <div className="col-span-3">Вес (г)</div>
              <div className="col-span-3 text-right">Действия</div>
            </div>

            <div className="divide-y divide-white/10">
              {packaging.length === 0 ? (
                <div className="p-4 text-sm text-white/60">Нет упаковок</div>
              ) : (
                packaging.map((p) => (
                  <div key={p.id} className="grid grid-cols-12 items-center px-3 py-3 hover:bg-white/5 transition-colors">
                    <div className="col-span-6">
                      <div className="text-sm font-medium text-white">{p.name}</div>
                      <div className="text-[10px] text-white/40">
                        {new Date(p.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="col-span-3 text-sm text-white/80 font-mono">
                      {p.weightGrams} г
                    </div>
                    <div className="col-span-3 flex justify-end gap-1">
                      <SmallButton
                        onClick={() => handleEdit(p)}
                        title="Редактировать"
                      >
                        Изм.
                      </SmallButton>
                      <SmallButton
                        variant="danger"
                        onClick={() => removePackaging(p.id)}
                        title="Удалить"
                      >
                        Удал.
                      </SmallButton>
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

