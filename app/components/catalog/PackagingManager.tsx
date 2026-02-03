"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Packaging, Product, ProductPackagingLink } from "./types";
import { loadLinks, loadPackaging, loadProducts, saveLinks, savePackaging } from "./storage";
import { cx, uid } from "./utils";

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
  const [products, setProducts] = useState<Product[]>([]);
  const [packaging, setPackaging] = useState<Packaging[]>([]);
  const [links, setLinks] = useState<ProductPackagingLink[]>([]);

  const [pName, setPName] = useState("");
  const [wMm, setWMm] = useState("70");
  const [hMm, setHMm] = useState("40");
  const [dMm, setDMm] = useState("");
  const [tare, setTare] = useState("");

  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedPackagingId, setSelectedPackagingId] = useState<string>("");

  useEffect(() => {
    const ps = loadProducts();
    const pk = loadPackaging();
    const lk = loadLinks();
    setProducts(ps);
    setPackaging(pk);
    setLinks(lk);

    setSelectedProductId(ps[0]?.id ?? "");
    setSelectedPackagingId(pk[0]?.id ?? "");
  }, []);

  useEffect(() => {
    savePackaging(packaging);
  }, [packaging]);

  useEffect(() => {
    saveLinks(links);
  }, [links]);

  const addPackaging = () => {
    const name = pName.trim();
    const widthMm = toNum(wMm);
    const heightMm = toNum(hMm);
    if (!name || widthMm === null || heightMm === null) return;

    const depthMm = dMm.trim() ? toNum(dMm) ?? undefined : undefined;
    const tareGrams = tare.trim() ? toNum(tare) ?? undefined : undefined;

    const item: Packaging = {
      id: uid(),
      name,
      widthMm,
      heightMm,
      depthMm,
      tareGrams,
      createdAt: Date.now(),
    };

    setPackaging((prev) => [item, ...prev]);
    setPName("");
    setDMm("");
    setTare("");
    setSelectedPackagingId(item.id);
  };

  const removePackaging = (id: string) => {
    setPackaging((prev) => prev.filter((p) => p.id !== id));
    setLinks((prev) => prev.filter((l) => l.packagingId !== id));
  };

  const assign = () => {
    if (!selectedProductId || !selectedPackagingId) return;
    const exists = links.some(
      (l) => l.productId === selectedProductId && l.packagingId === selectedPackagingId
    );
    if (exists) return;

    const link: ProductPackagingLink = {
      id: uid(),
      productId: selectedProductId,
      packagingId: selectedPackagingId,
      createdAt: Date.now(),
    };
    setLinks((prev) => [link, ...prev]);
  };

  const unassign = (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const packagingById = useMemo(() => {
    const map = new Map<string, Packaging>();
    packaging.forEach((p) => map.set(p.id, p));
    return map;
  }, [packaging]);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  return (
    <div className="grid gap-4 md:grid-cols-12">
      <div className="md:col-span-5">
        <Card
          title="Добавить упаковку"
          subtitle="Размеры в мм. Сохранение локально в браузере (пока)."
          right={
            <SmallButton variant="primary" onClick={addPackaging}>
              Добавить
            </SmallButton>
          }
        >
          <div className="grid gap-3">
            <div className="grid gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                Название
              </div>
              <Input value={pName} onChange={setPName} placeholder="Напр. Коробка S" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Ширина
                </div>
                <Input type="number" value={wMm} onChange={setWMm} placeholder="70" />
              </div>
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Высота
                </div>
                <Input type="number" value={hMm} onChange={setHMm} placeholder="40" />
              </div>
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Глубина
                </div>
                <Input type="number" value={dMm} onChange={setDMm} placeholder="(опц.)" />
              </div>
            </div>

            <div className="grid gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                Тара (г)
              </div>
              <Input type="number" value={tare} onChange={setTare} placeholder="(опц.)" />
            </div>
          </div>
        </Card>

        <div className="mt-4">
          <Card
            title="Привязка упаковки к товару"
            subtitle="Выберите товар и упаковку — создадим связь."
            right={
              <SmallButton
                variant="secondary"
                onClick={assign}
                disabled={!selectedProductId || !selectedPackagingId}
              >
                Привязать
              </SmallButton>
            }
          >
            <div className="grid gap-3">
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Товар
                </div>
                <Select
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                  options={[
                    { value: "", label: products.length ? "— выберите —" : "Нет товаров" },
                    ...products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })),
                  ]}
                />
              </div>
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Упаковка
                </div>
                <Select
                  value={selectedPackagingId}
                  onChange={setSelectedPackagingId}
                  options={[
                    {
                      value: "",
                      label: packaging.length ? "— выберите —" : "Нет упаковок",
                    },
                    ...packaging.map((p) => ({
                      value: p.id,
                      label: `${p.name} (${p.widthMm}×${p.heightMm}${p.depthMm ? `×${p.depthMm}` : ""} мм)`,
                    })),
                  ]}
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                Позже эту связь будем использовать для быстрых шаблонов этикеток и
                печати (размеры, поля, раскладка).
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="md:col-span-7">
        <Card
          title="Справочник упаковок"
          subtitle={`Всего: ${packaging.length}`}
        >
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-12 gap-0 bg-white/5 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-white/55">
              <div className="col-span-4">Название</div>
              <div className="col-span-4">Размеры</div>
              <div className="col-span-2">Тара</div>
              <div className="col-span-2 text-right">Действия</div>
            </div>

            <div className="divide-y divide-white/10">
              {packaging.length === 0 ? (
                <div className="p-4 text-sm text-white/60">Нет упаковок</div>
              ) : (
                packaging.map((p) => (
                  <div key={p.id} className="grid grid-cols-12 items-center px-3 py-3">
                    <div className="col-span-4">
                      <div className="text-sm font-medium text-white">{p.name}</div>
                      <div className="text-xs text-white/50">
                        {new Date(p.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="col-span-4 text-sm text-white/80">
                      {p.widthMm}×{p.heightMm}
                      {p.depthMm ? `×${p.depthMm}` : ""} мм
                    </div>
                    <div className="col-span-2 text-sm text-white/80">
                      {typeof p.tareGrams === "number" ? `${p.tareGrams} г` : "—"}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <SmallButton variant="danger" onClick={() => removePackaging(p.id)}>
                        Удалить
                      </SmallButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        <div className="mt-4">
          <Card title="Связи товар ↔ упаковка" subtitle={`Всего: ${links.length}`}>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-12 gap-0 bg-white/5 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-white/55">
                <div className="col-span-5">Товар</div>
                <div className="col-span-5">Упаковка</div>
                <div className="col-span-2 text-right">Действия</div>
              </div>

              <div className="divide-y divide-white/10">
                {links.length === 0 ? (
                  <div className="p-4 text-sm text-white/60">Нет связей</div>
                ) : (
                  links.map((l) => {
                    const prod = productById.get(l.productId);
                    const pack = packagingById.get(l.packagingId);
                    return (
                      <div key={l.id} className="grid grid-cols-12 items-center px-3 py-3">
                        <div className="col-span-5 text-sm text-white/90">
                          {prod ? `${prod.sku} — ${prod.name}` : "— (товар удалён)"}
                        </div>
                        <div className="col-span-5 text-sm text-white/80">
                          {pack
                            ? `${pack.name} (${pack.widthMm}×${pack.heightMm}${pack.depthMm ? `×${pack.depthMm}` : ""} мм)`
                            : "— (упаковка удалена)"}
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <SmallButton variant="danger" onClick={() => unassign(l.id)}>
                            Удалить
                          </SmallButton>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
