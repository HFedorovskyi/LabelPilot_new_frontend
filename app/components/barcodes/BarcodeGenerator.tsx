"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import type { Product } from "../catalog/types";
import { loadProducts } from "../catalog/storage";
import { cx, makeEan13, normalizeDigits } from "../catalog/utils";

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
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-white text-neutral-950 hover:bg-white/90"
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

type BarcodeFormat = "EAN13" | "CODE128";

export default function BarcodeGenerator() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const [format, setFormat] = useState<BarcodeFormat>("EAN13");
  const [value, setValue] = useState<string>("4601234567890");
  const [text, setText] = useState<boolean>(true);
  const [width, setWidth] = useState<number>(2);
  const [height, setHeight] = useState<number>(72);

  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const ps = loadProducts();
    setProducts(ps);
    setSelectedProductId(ps[0]?.id ?? "");
    const initial = ps[0]?.defaultBarcode ?? "4601234567890";
    setValue(initial);
  }, []);

  useEffect(() => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;
    if (prod.defaultBarcode) setValue(prod.defaultBarcode);
  }, [selectedProductId, products]);

  const normalizedValue = useMemo(() => {
    if (format === "EAN13") {
      const digits = normalizeDigits(value);
      return makeEan13(digits) ?? digits;
    }
    return value;
  }, [format, value]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    try {
      if (format === "EAN13") {
        const v = makeEan13(normalizeDigits(value));
        if (!v) throw new Error("Invalid EAN13");
        JsBarcode(svg, v, {
          format: "EAN13",
          displayValue: text,
          width,
          height,
          margin: 12,
          background: "transparent",
          lineColor: "#E5E7EB",
          font: "monospace",
          fontSize: 14,
          textMargin: 6,
        });
      } else {
        JsBarcode(svg, value, {
          format: "CODE128",
          displayValue: text,
          width,
          height,
          margin: 12,
          background: "transparent",
          lineColor: "#E5E7EB",
          font: "monospace",
          fontSize: 14,
          textMargin: 6,
        });
      }
    } catch {
      // Render nothing if invalid; we'll show an error state.
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    }
  }, [format, value, text, width, height]);

  const isValid = useMemo(() => {
    if (format === "EAN13") return Boolean(makeEan13(normalizeDigits(value)));
    return value.trim().length > 0;
  }, [format, value]);

  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `barcode_${format}_${normalizedValue || "value"}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-4 md:grid-cols-12">
      <div className="md:col-span-5">
        <Card
          title="Генератор штрихкодов"
          subtitle="EAN‑13 (с автоматической контрольной цифрой) и Code128."
        >
          <div className="grid gap-3">
            <div className="grid gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                Товар (опц.)
              </div>
              <Select
                value={selectedProductId}
                onChange={setSelectedProductId}
                options={[
                  { value: "", label: products.length ? "— не выбран —" : "Нет товаров" },
                  ...products.map((p) => ({
                    value: p.id,
                    label: `${p.sku} — ${p.name}`,
                  })),
                ]}
              />
              <div className="text-xs text-white/50">
                Подставит штрихкод по умолчанию из номенклатуры (если задан).
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Формат
                </div>
                <Select
                  value={format}
                  onChange={(v) => setFormat(v as BarcodeFormat)}
                  options={[
                    { value: "EAN13", label: "EAN‑13" },
                    { value: "CODE128", label: "Code128" },
                  ]}
                />
              </div>
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Текст под штрихкодом
                </div>
                <Select
                  value={text ? "yes" : "no"}
                  onChange={(v) => setText(v === "yes")}
                  options={[
                    { value: "yes", label: "Показывать" },
                    { value: "no", label: "Скрыть" },
                  ]}
                />
              </div>
            </div>

            <div className="grid gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                Значение
              </div>
              <Input
                value={value}
                onChange={setValue}
                placeholder={format === "EAN13" ? "12 или 13 цифр" : "Любая строка"}
              />
              <div className="text-xs text-white/50">
                Нормализация: <span className="font-mono text-white/70">{normalizedValue || "—"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Ширина штриха
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="w-full accent-white"
                />
                <div className="text-xs text-white/60">{width}px</div>
              </div>
              <div className="grid gap-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Высота
                </div>
                <input
                  type="range"
                  min={40}
                  max={140}
                  step={4}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full accent-white"
                />
                <div className="text-xs text-white/60">{height}px</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <SmallButton variant="primary" disabled={!isValid} onClick={downloadSvg}>
                Скачать SVG
              </SmallButton>
              <SmallButton
                variant="ghost"
                onClick={() => {
                  const n =
                    format === "EAN13"
                      ? makeEan13(normalizeDigits(value)) ?? ""
                      : value.trim();
                  if (!n) return;
                  navigator.clipboard.writeText(n).catch(() => {});
                }}
                disabled={!isValid}
                title="Скопировать значение"
              >
                Скопировать значение
              </SmallButton>
            </div>
          </div>
        </Card>
      </div>

      <div className="md:col-span-7">
        <Card
          title="Просмотр"
          subtitle={isValid ? "Готово к печати/экспорту" : "Неверное значение для выбранного формата"}
          right={
            <div
              className={cx(
                "rounded-full px-3 py-1 text-xs ring-1",
                isValid
                  ? "bg-emerald-400/10 text-emerald-100 ring-emerald-400/20"
                  : "bg-rose-500/10 text-rose-100 ring-rose-400/20"
              )}
            >
              {isValid ? "VALID" : "INVALID"}
            </div>
          }
        >
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
            <div className="mx-auto w-full max-w-[520px] rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/55">Предпросмотр</div>
              <div className="mt-3 flex justify-center">
                <svg ref={svgRef} />
              </div>
            </div>

            <div className="mt-4 text-xs text-white/50">
              Примечание: на этом шаге штрихкоды генерируются на клиенте и не сохраняются в БД.
              Позже добавим сохранение/историю и печатные шаблоны.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
