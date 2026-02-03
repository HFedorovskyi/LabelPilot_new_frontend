"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Product } from "./types";
import { loadProducts, saveProducts } from "./storage";
import { cx, makeEan13, uid } from "./utils";

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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20 focus:bg-white/10"
    />
  );
}

export default function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultBarcode, setDefaultBarcode] = useState("");

  useEffect(() => {
    const initial = loadProducts();
    setProducts(initial);
  }, []);

  useEffect(() => {
    saveProducts(products);
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.defaultBarcode ?? "").includes(q)
      );
    });
  }, [products, query]);

  const addProduct = () => {
    const s = sku.trim();
    const n = name.trim();
    if (!s || !n) return;

    const normalizedBarcode = defaultBarcode.trim()
      ? makeEan13(defaultBarcode.trim()) ?? defaultBarcode.trim()
      : undefined;

    const p: Product = {
      id: uid(),
      sku: s,
      name: n,
      description: description.trim() || undefined,
      defaultBarcode: normalizedBarcode,
      createdAt: Date.now(),
    };

    setProducts((prev) => [p, ...prev]);
    setSku("");
    setName("");
    setDescription("");
    setDefaultBarcode("");
  };

  const removeProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="grid gap-4 md:grid-cols-12">
      <div className="md:col-span-5">
        <Card
          title="Добавить товар"
          subtitle="Минимум: SKU и название. Всё хранится локально в браузере (пока)."
          right={
            <SmallButton variant="primary" onClick={addProduct}>
              Добавить
            </SmallButton>
          }
        >
          <div className="grid gap-3">
            <div className="grid gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                SKU
              </div>
              <Input value={sku} onChange={setSku} placeholder="Напр. TEA-001" />
            </div>

            <div className="grid gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                Название
              </div>
              <Input value={name} onChange={setName} placeholder="Напр. Чай зелёный" />
            </div>

            <div className="grid gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                Описание (опц.)
              </div>
              <Input
                value={description}
                onChange={setDescription}
                placeholder="Кратко: вкус, сорт, партия..."
              />
            </div>

            <div className="grid gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                Штрихкод по умолчанию (опц.)
              </div>
              <Input
                value={defaultBarcode}
                onChange={setDefaultBarcode}
                placeholder="EAN-13 или любые цифры"
              />
              <div className="text-xs text-white/50">
                Если введёте 12 цифр — автоматически добавим контрольную цифру EAN‑13.
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="md:col-span-7">
        <Card
          title="Справочник товаров"
          subtitle={`Всего: ${products.length}`}
          right={
            <div className="w-64">
              <Input value={query} onChange={setQuery} placeholder="Поиск (SKU/название/штрихкод)" />
            </div>
          }
        >
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-12 gap-0 bg-white/5 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-white/55">
              <div className="col-span-3">SKU</div>
              <div className="col-span-4">Название</div>
              <div className="col-span-3">Штрихкод</div>
              <div className="col-span-2 text-right">Действия</div>
            </div>

            <div className="divide-y divide-white/10">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-white/60">Нет записей</div>
              ) : (
                filtered.map((p) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-12 items-center gap-0 px-3 py-3"
                  >
                    <div className="col-span-3">
                      <div className="font-mono text-sm text-white/90">{p.sku}</div>
                      <div className="text-xs text-white/50">
                        {new Date(p.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="col-span-4">
                      <div className="text-sm font-medium text-white">{p.name}</div>
                      <div className="text-xs text-white/50 line-clamp-1">
                        {p.description ?? "—"}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <div className="text-sm text-white/80">{p.defaultBarcode ?? "—"}</div>
                    </div>
                    <div className="col-span-2 flex justify-end gap-2">
                      <SmallButton
                        variant="danger"
                        title="Удалить"
                        onClick={() => removeProduct(p.id)}
                      >
                        Удалить
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
