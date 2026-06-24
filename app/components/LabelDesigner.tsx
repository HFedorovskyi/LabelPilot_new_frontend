"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api as client } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n";
import TemplateHub from "./designer/TemplateHub";

import {
  LabelDoc,
  LabelElement,
  TextElement,
  RectElement,
  BarcodeElement,
  ElementType,
  LabelElementBase,
  BarcodeType,
  PrintedZone,
  CanvasConfig,
  TableElement,
  TableColumn
} from "@/lib/label/types";
import { renderLabel, processDynamicText } from "@/lib/label/renderer";
import { labelToZpl } from "@/lib/label/zpl";

const STORAGE_KEY = "label_designer_doc_v1";

const DPI_203 = 203;
const CM_TO_INCH = 1 / 2.54;

// Значения по умолчанию когда номенклатура не выбрана
const FONTS = [
  "Inter",
  "Roboto",
  "Arial",
  "Times New Roman",
  "Courier New",
  "Montserrat",
  "Ubuntu",
  "Georgia",
  "Verdana"
];

const DEFAULT_PREVIEW_DATA: Record<string, any> = {
  name: "Пример товара",
  article: "ART-00000",
  exp_date: "30",
  pack_counter: "1",
  weight_netto_pack: "99.999",
  weight_brutto_pack: "99.999",
  close_box_counter: "10",
  weight_netto_box: "99.999",
  weight_brutto_box: "99.999",
  weight_netto_pallet: "99.999",
  weight_brutto_pallet: "99.999",
  pack_number: "000000000001",
  box_number: "000000000001",
  pallet_number: "000000000001",
  production_date: formatDate(new Date()),
  exp_date_full: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
  batch_number: "9999999999",
  operator: "07",
  operator_name: "Иванов И.И.",
};

// Ключи для колонок таблицы — это поля ОДНОЙ позиции (строки), а не паллеты-скаляра
// labelKey resolved via t() at the render site (designer.* namespace)
const TABLE_COLUMN_KEYS = [
  { key: "name", labelKey: "designer.colName" },
  { key: "article", labelKey: "designer.colArticle" },
  { key: "quantity", labelKey: "designer.colQuantity" },
  { key: "batch_number", labelKey: "designer.colBatch" },
  { key: "production_date_batch", labelKey: "designer.colProductionDate" },
  { key: "exp_date_full", labelKey: "designer.colExpDate" },
  { key: "weight_netto_pack", labelKey: "designer.colWeightNettoUnit" },
  { key: "weight_brutto_pack", labelKey: "designer.colWeightBruttoUnit" },
  { key: "weight_netto_batch", labelKey: "designer.colWeightNettoBatch" },
  { key: "weight_brutto_batch", labelKey: "designer.colWeightBruttoBatch" },
  { key: "weight_netto_nomenclature", labelKey: "designer.colWeightNettoNomencl" },
  { key: "weight_brutto_nomenclature", labelKey: "designer.colWeightBruttoNomencl" },
];

// Фиксированные атрибуты модели Nomenclature
const FIXED_PRODUCT_ATTRIBUTES = [
  { key: "name", label: "Наименование" },
  { key: "article", label: "Артикул" },
  { key: "exp_date", label: "Срок годности (сут)" },
  { key: "close_box_counter", label: "Вложений в короб" },
] as const;

function cmToPx(cm: number, dpi: number = DPI_203) {
  return Math.round(cm * CM_TO_INCH * dpi);
}

function pxToCm(px: number, dpi: number = DPI_203) {
  return Number((px / dpi / CM_TO_INCH).toFixed(2));
}

function mmToPx(mm: number, dpi: number = DPI_203): number {
  return Math.round(mm * dpi / 25.4);
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(date: Date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function safeNumber(v: unknown, fallback: number) {
  return isFiniteNumber(v) ? v : fallback;
}

function Icon({
  name,
  className,
}: {
  name:
  | "text"
  | "rect"
  | "barcode"
  | "grid"
  | "save"
  | "load"
  | "copy"
  | "trash"
  | "up"
  | "down"
  | "reset"
  | "chevron-down"
  | "box"
  | "plus"
  | "minus"
  | "table"
  | "sparkles"
  | "edit";
  className?: string;
}) {
  const common = "h-4 w-4";
  switch (name) {
    case "sparkles":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5-1.5 1.5M7.5 16.5l-1.5 1.5m10.5 0-1.5-1.5M7.5 7.5 6 6"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="m9.5 8 1 3.5 1.5 1m0 0-1.5 1-1 3.5-1-3.5-1.5-1 0 0 1.5-1 1-3.5Z"
            className="fill-current"
          />
        </svg>
      );
    case "edit":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "text":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M4 6V4h16v2M9 20h6M12 4v16"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "rect":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z"
            className="stroke-current"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "barcode":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M4 6v12M7 6v12M10 6v12M12 6v12M15 6v12M18 6v12M20 8v8"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "grid":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M4 9h16M4 15h16M9 4v16M15 4v16"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "save":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M7 3h10l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M8 3v6h8V3"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "load":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M12 3v10m0 0 4-4m-4 4-4-4"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "copy":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M9 9h10v10H9V9Z"
            className="stroke-current"
            strokeWidth="1.8"
          />
          <path
            d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "table":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M3 10h18M3 14h18m-9-4v8m-7-8v8m14-8v8M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "trash":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M9 3h6m-9 4h12m-10 0 1 14h6l1-14"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "up":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M12 6v12m0-12 5 5m-5-5-5 5"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "down":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M12 18V6m0 12 5-5m-5 5-5-5"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "reset":
      return (
        <svg
          className={className || common}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      );
    case "chevron-down":
      return (
        <svg
          className={className || common}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      );
    case "box":
      return (
        <svg
          className={className || common}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path d="M12 5v14M5 12h14" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "minus":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path d="M5 12h14" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function SmallButton({
  children,
  onClick,
  variant = "secondary",
  title,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  title?: string;
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed";
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
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cx(base, styles, className)}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">
        {label}
      </div>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      className="h-10 w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20 focus:bg-white/10"
    />
  );
}

function VariableTextInput({
  value,
  onChange,
  attributes,
  multiline = true,
  onAttributeSelect,
}: {
  value: string;
  onChange: (next: string) => void;
  attributes: { key: string; label: string; icon: string }[];
  multiline?: boolean;
  onAttributeSelect?: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="flex gap-2">
        {multiline ? (
          <textarea
            value={value}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
            placeholder={t('designer.enterText')}
            className="flex-1 min-h-[80px] rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20 focus:bg-white/10 resize-none transition-all scrollbar-thin scrollbar-thumb-white/10"
          />
        ) : (
          <input
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            placeholder={t('designer.valuePlaceholder')}
            className="h-9 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20 focus:bg-white/10 transition-all font-mono text-[11px]"
          />
        )}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cx(
            "h-9 w-9 flex flex-shrink-0 items-center justify-center rounded-xl border transition-all",
            open
              ? "bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
              : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/60"
          )}
          title={t('designer.insertAttribute')}
        >
          <Icon name="sparkles" className={cx("h-4 w-4", open && "animate-pulse")} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-11 z-[100] w-64 rounded-2xl border border-white/10 bg-[#1A1F2B]/95 p-1.5 backdrop-blur-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="mb-1.5 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">
              {t('designer.insertAttribute')}
            </div>
          </div>
          <div className="max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {attributes.map((attr) => (
              <button
                key={attr.key}
                type="button"
                onClick={() => {
                  onChange(value + `{{${attr.key}}}`);
                  onAttributeSelect?.(attr.key);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-white/10 group"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-sm group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                  {attr.icon}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="truncate text-xs font-medium text-white/80 group-hover:text-white">
                    {attr.label}
                  </div>
                  <div className="truncate text-[9px] text-white/30 font-mono">
                    {`{{${attr.key}}}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
      className="h-10 w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20 focus:bg-white/10"
    />
  );
}

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1">
      <input
        type="color"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="h-7 w-8 cursor-pointer rounded-md bg-transparent border-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="w-20 bg-transparent text-xs text-white outline-none"
        spellCheck={false}
      />
    </div>
  );
}

function CustomSelect<T extends string | number>({
  value,
  options,
  onChange,
  onDelete,
  renderOption,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (val: T) => void;
  onDelete?: (val: T) => void;
  renderOption?: (opt: { value: T; label: string }) => React.ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={cx("relative w-full", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cx(
          "flex h-10 w-full min-w-0 items-center justify-between rounded-xl border px-3 text-xs font-medium text-white transition-all outline-none text-left",
          open
            ? "border-white/30 bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
            : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
        )}
      >
        <span className="truncate">{selected?.label || String(value)}</span>
        <Icon
          name="chevron-down"
          className={cx("h-3.5 w-3.5 text-white/40 transition-transform duration-300 flex-shrink-0 ml-2", open && "rotate-180 text-white")}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[100] overflow-hidden rounded-xl border border-white/10 bg-[#0B1220]/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {options.map((opt) => (
              <div
                key={opt.value}
                className={cx(
                  "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-all text-left",
                  opt.value === value
                    ? "bg-white/10"
                    : "hover:bg-white/5"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cx(
                    "flex-1 text-left text-xs truncate transition-all outline-none",
                    opt.value === value ? "text-white" : "text-white/50 group-hover:text-white"
                  )}
                >
                  {renderOption ? renderOption(opt) : opt.label}
                </button>

                {onDelete && opt.value !== ("" as any) && (
                  <button
                    type="button"
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(opt.value);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white/20 hover:bg-red-500/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 outline-none"
                    title={t('designer.delete')}
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                )}

                {opt.value === value && !onDelete && (
                  <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function defaultDoc(): LabelDoc {
  return {
    version: 1,
    canvas: {
      width: cmToPx(10), // Default 10cm
      height: cmToPx(6), // Default 6cm
      widthCm: 10,
      heightCm: 6,
      dpi: DPI_203,
      background: "#ffffff",
      showGrid: true,
      gridSize: 16,
      labelType: "pack",
      printedZones: [],
    },
    elements: [],
  };
}

// ─── Дефолтная раскладка паллетного листа (пропорционально размеру холста) ───
function palletText(
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  fontSize: number,
  opts: { bold?: boolean; align?: "left" | "center" | "right" } = {}
): TextElement {
  return {
    id: uid(),
    type: "text",
    x,
    y,
    w,
    h,
    rotation: 0,
    text,
    fontSize,
    color: "#000000",
    fontWeight: opts.bold ? 700 : 400,
    fontFamily: "Inter",
    textAlign: opts.align || "left",
    fontStyle: "normal",
    textDecoration: "none",
  };
}

function buildPalletLayout(width: number, height: number): LabelElement[] {
  const W = width;
  const H = height;
  const pad = Math.round(W * 0.05);
  const innerW = W - pad * 2;
  const titleFs = Math.max(18, Math.round(H * 0.026));
  const fs = Math.max(12, Math.round(H * 0.015));
  const lineH = Math.round(fs * 1.7);

  const els: LabelElement[] = [];
  let y = pad;

  els.push(palletText(pad, y, innerW, Math.round(titleFs * 1.4), "ПАЛЛЕТНЫЙ ЛИСТ", titleFs, { bold: true, align: "center" }));
  y += Math.round(titleFs * 1.4) + Math.round(H * 0.012);

  els.push(palletText(pad, y, innerW, lineH, "Паллета №: {{pallet_number}}", fs, { bold: true }));
  y += lineH;
  els.push(palletText(pad, y, Math.round(innerW / 2), lineH, "Дата отгрузки: {{shipping_date}}", fs));
  els.push(palletText(pad + Math.round(innerW / 2), y, Math.round(innerW / 2), lineH, "Дата произв.: {{production_date}}", fs));
  y += lineH + Math.round(H * 0.015);

  const totalsH = lineH * 2 + Math.round(H * 0.02);
  const tableY = y;
  const tableH = Math.max(160, H - tableY - totalsH - pad);

  const table: TableElement = {
    id: uid(),
    type: "table",
    x: pad,
    y: tableY,
    w: innerW,
    h: tableH,
    rotation: 0,
    columns: [
      { id: uid(), key: "name", title: "Наименование", widthRatio: 42 },
      { id: uid(), key: "batch_number", title: "Партия", widthRatio: 20 },
      { id: uid(), key: "quantity", title: "Кол-во", widthRatio: 13 },
      { id: uid(), key: "weight_brutto_pack", title: "Вес, кг", widthRatio: 25 },
    ],
    groupBy: "none",
    sortBy: "none",
    fontSize: Math.max(10, Math.round(fs * 0.85)),
    showHeaders: true,
    showBorders: true,
    fontFamily: "Inter",
    fontStyle: "normal",
  };
  els.push(table);

  let ty = tableY + tableH + Math.round(H * 0.012);
  els.push(palletText(pad, ty, innerW, lineH, "Всего единиц: {{total_count}}        Кол-во коробов: {{total_boxes}}", fs, { bold: true }));
  ty += lineH;
  els.push(palletText(pad, ty, innerW, lineH, "Общий вес (брутто): {{weight_total}} кг", fs, { bold: true }));

  return els;
}

function validateDoc(input: unknown): LabelDoc | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Partial<LabelDoc>;
  if (obj.version !== 1) return null;
  if (!obj.canvas || typeof obj.canvas !== "object") return null;
  if (!Array.isArray(obj.elements)) return null;

  const canvas = obj.canvas as LabelDoc["canvas"];
  const dpi = safeNumber(canvas.dpi, DPI_203);
  const widthCm = safeNumber(canvas.widthCm, 10);
  const heightCm = safeNumber(canvas.heightCm, 6);
  const width = canvas.width || cmToPx(widthCm, dpi);
  const height = canvas.height || cmToPx(heightCm, dpi);

  const normalized: LabelDoc = {
    version: 1,
    canvas: {
      width: clamp(width, 10, 5000),
      height: clamp(height, 10, 5000),
      widthCm: clamp(widthCm, 0.1, 100),
      heightCm: clamp(heightCm, 0.1, 100),
      dpi: clamp(dpi, 72, 1200),
      background: typeof canvas.background === "string" ? canvas.background : "#ffffff",
      showGrid: Boolean(canvas.showGrid),
      gridSize: clamp(safeNumber(canvas.gridSize, 16), 4, 64),
      labelType: (["pack", "box", "pallet"].includes(canvas.labelType as string) ? canvas.labelType : "pack") as "pack" | "box" | "pallet",
      printedZones: Array.isArray((canvas as any).printedZones)
        ? (canvas as any).printedZones
          .filter((z: any) => z && typeof z === "object" && typeof z.id === "string")
          .map((z: any): PrintedZone => ({
            id: z.id,
            label: typeof z.label === "string" ? z.label : "Зона",
            side: ["top", "bottom", "left", "right"].includes(z.side) ? z.side : "top",
            sizeMm: clamp(safeNumber(z.sizeMm, 10), 0, 500),
            color: typeof z.color === "string" ? z.color : "#1e40af",
          }))
        : [],
    },
    elements: obj.elements
      .map((e) => {
        if (!e || typeof e !== "object") return null;
        const el = e as Partial<LabelElement>;
        if (typeof el.id !== "string" || typeof el.type !== "string") return null;
        const base: LabelElementBase = {
          id: el.id,
          type: el.type as ElementType,
          x: safeNumber(el.x, 0),
          y: safeNumber(el.y, 0),
          w: clamp(safeNumber(el.w, 40), 1, 5000),
          h: clamp(safeNumber(el.h, 20), 1, 5000),
          rotation: clamp(safeNumber(el.rotation, 0), -360, 360),
        };

        if (el.type === "text") {
          const t = el as Partial<TextElement>;
          const textEl: TextElement = {
            ...base,
            type: "text",
            text: typeof t.text === "string" ? t.text : "Текст",
            fontSize: clamp(safeNumber(t.fontSize, 14), 4, 200),
            color: typeof t.color === "string" ? t.color : "#000000",
            fontWeight: Number(t.fontWeight) || 600,
            fontFamily: typeof t.fontFamily === "string" ? t.fontFamily : "Inter",
            fontStyle: (["normal", "italic"].includes(t.fontStyle as string) ? t.fontStyle : "normal") as "normal" | "italic",
            textAlign: (["left", "center", "right"].includes(t.textAlign as string) ? t.textAlign : "left") as "left" | "center" | "right",
            textDecoration: (["none", "underline"].includes(t.textDecoration as string) ? t.textDecoration : "none") as "none" | "underline",
            minLength: typeof t.minLength === "number" ? t.minLength : undefined,
          };
          // Force minLength = 12 for known counters
          if (textEl.text.includes("{{ pack_number }}") || textEl.text.includes("{{ box_number }}")) {
            textEl.minLength = 12;
          }
          return textEl;
        }

        if (el.type === "rect") {
          const r = el as Partial<RectElement>;
          const rectEl: RectElement = {
            ...base,
            type: "rect",
            fill: typeof r.fill === "string" ? r.fill : "transparent",
            borderColor: typeof r.borderColor === "string" ? r.borderColor : "#000000",
            borderWidth: clamp(safeNumber(r.borderWidth, 1), 0, 50),
            borderRadius: clamp(safeNumber(r.borderRadius, 0), 0, 500),
          };
          return rectEl;
        }

        if (el.type === "barcode") {
          const b = el as Partial<BarcodeElement>;
          const res: BarcodeElement = {
            ...base,
            type: "barcode",
            value: typeof b.value === "string" ? b.value : "123456789012",
            barcodeType: (b.barcodeType as BarcodeType) || "CODE128",
            showText: typeof b.showText === "boolean" ? b.showText : true,
          };
          if (b.templateId !== undefined) res.templateId = b.templateId;
          if (b.imageData !== undefined) res.imageData = b.imageData;
          if (b.error !== undefined) res.error = b.error;
          return res;
        }

        if (el.type === "table") {
          const t = el as Partial<TableElement>;
          const tableEl: TableElement = {
            ...base,
            type: "table",
            columns: Array.isArray(t.columns)
              ? t.columns.map((col: any) => ({
                id: typeof col.id === "string" ? col.id : uid(),
                key: typeof col.key === "string" ? col.key : "id",
                title: typeof col.title === "string" ? col.title : "Column",
                widthRatio: clamp(safeNumber(col.widthRatio, 25), 1, 100),
              }))
              : [
                { id: uid(), key: "name", title: "Наименование", widthRatio: 50 },
                { id: uid(), key: "weight_netto_pack", title: "Вес", widthRatio: 50 },
              ],
            groupBy: (["none", "nomenclature", "batch"].includes(t.groupBy as string) ? t.groupBy : "none") as any,
            sortBy: (["name", "date", "none"].includes(t.sortBy as string) ? t.sortBy : "none") as any,
            fontSize: clamp(safeNumber(t.fontSize, 12), 4, 100),
            showHeaders: typeof t.showHeaders === "boolean" ? t.showHeaders : true,
            showBorders: typeof t.showBorders === "boolean" ? t.showBorders : true,
            fontFamily: typeof t.fontFamily === "string" ? t.fontFamily : "Inter",
            fontStyle: (["normal", "italic"].includes(t.fontStyle as string) ? t.fontStyle : "normal") as any,
          };
          return tableEl;
        }

        return null;
      })
      .filter((e): e is LabelElement => e !== null),
  };

  return normalized;
}



export default function LabelDesigner() {
  const { t } = useTranslation();
  const [hasMounted, setHasMounted] = useState(false);
  const [doc, setDoc] = useState<LabelDoc>(defaultDoc());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);
  // Nomenclature selection state
  const [nomenclatures, setNomenclatures] = useState<any[]>([]);
  const [globalAttributes, setGlobalAttributes] = useState<any[]>([]);
  const [selectedNomenclatureId, setSelectedNomenclatureId] = useState<string>("");
  const [previewData, setPreviewData] = useState<Record<string, any>>(DEFAULT_PREVIEW_DATA);
  const [barcodeTemplates, setBarcodeTemplates] = useState<any[]>([]);

  // Ref mirror of doc.elements — lets callbacks read elements without creating deps that trigger infinite loops
  const elementsRef = useRef<LabelElement[]>([]);
  useEffect(() => { elementsRef.current = doc.elements; }, [doc.elements]);

  const generateBarcodeImage = useCallback(async (template: any, elementId: string) => {
    try {
      console.log(`Generating barcode for ${elementId} with template ${template.name}`, template.structure);
      const payload: { barcode_structure: any; product_id?: string } = {
        barcode_structure: template.structure,
      };
      if (selectedNomenclatureId) {
        payload.product_id = selectedNomenclatureId;
      }
      const response = await client.barcodes.generate(payload);
      if (response && response.png) {
        console.log(`Success generating barcode ${elementId}`);
        setDoc((d: LabelDoc) => ({
          ...d,
          elements: d.elements.map((el: LabelElement) =>
            el.id === elementId ? { ...el, imageData: response.png } as BarcodeElement : el
          )
        }));
      }
    } catch (err: any) {
      console.error("Failed to generate barcode image", err);
      setDoc((d: LabelDoc) => ({
        ...d,
        elements: d.elements.map((el: LabelElement) =>
          el.id === elementId ? { ...el, imageData: undefined, error: err.message } as BarcodeElement : el
        )
      }));
    }
  }, [selectedNomenclatureId]);


  // Refresh barcodes when nomenclature/preview data changes OR when imageData is missing
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const barcodes = doc.elements.filter(el => el.type === "barcode") as BarcodeElement[];
      for (const b of barcodes) {
        if (!active) break;
        if (!b.imageData) {
          const template = b.templateId
            ? barcodeTemplates.find((t: any) => t.id === b.templateId)
            : barcodeTemplates.find((t: any) => t.name === b.barcodeType);

          if (template) {
            await generateBarcodeImage(template, b.id);
          }
        }
      }
    };

    if (barcodeTemplates.length > 0) {
      refresh();
    }

    return () => { active = false; };
  }, [previewData, barcodeTemplates, generateBarcodeImage, doc.elements.length, doc.elements.some(e => e.type === "barcode" && !(e as BarcodeElement).imageData)]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<"hub" | "editor">("hub");

  const dragRef = useRef<{
    active: boolean;
    elementId: string;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const panRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    initialPan: { x: number; y: number };
  } | null>(null);

  /* Resizing State */
  const resizeRef = useRef<{
    active: boolean;
    handle: string; // n, s, e, w, ne, nw, se, sw
    startX: number;
    startY: number;
    initialElement: LabelElement;
  } | null>(null);

  // Helper: Rotate point around origin
  const rotatePoint = (x: number, y: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      x: x * cos - y * sin,
      y: x * sin + y * cos,
    };
  };


  // Load initial data and restore selection
  useEffect(() => {
    const loadData = async () => {
      try {
        const [nomenclaturesData, attributesData, barcodesData] = await Promise.all([
          client.nomenclature.list(),
          client.attributes.list(),
          client.barcodes.list()
        ]);
        const nums = Array.isArray(nomenclaturesData) ? nomenclaturesData : nomenclaturesData.results || [];
        setNomenclatures(nums);
        setGlobalAttributes(Array.isArray(attributesData) ? attributesData : attributesData.results || []);
        const templates = Array.isArray(barcodesData) ? barcodesData : barcodesData.results || [];
        setBarcodeTemplates(templates);

        // Restore selection
        // Restore selection or select first
        const savedId = localStorage.getItem("labelDesigner_selectedNomenclatureId");
        if (savedId) {
          const item = nums.find((n: any) => n.id.toString() === savedId);
          if (item) {
            setSelectedNomenclatureId(savedId);
            updatePreviewData(item);
          } else if (nums.length > 0) {
            // Saved ID not found, but we have items -> select first
            const first = nums[0];
            setSelectedNomenclatureId(String(first.id));
            updatePreviewData(first);
          }
        } else if (nums.length > 0) {
          // No saved ID, default to first
          const first = nums[0];
          setSelectedNomenclatureId(String(first.id));
          updatePreviewData(first);
        }
      } catch (e) {
        console.error("Failed to load designer data", e);
      }
    };
    loadData();
  }, []);

  const updatePreviewData = useCallback((item: any) => {
    const data: Record<string, any> = {
      name: item.name || "",
      article: item.article || "",
      exp_date: String(item.exp_date || "30"),
      pack_counter: "1",
      close_box_counter: String(item.close_box_counter || "10"),
      weight_netto_pack: "99.999",
      weight_brutto_pack: "99.999",
      weight_netto_box: "99.999",
      weight_brutto_box: "99.999",
      weight_netto_pallet: "99.999",
      weight_brutto_pallet: "99.999",
      pack_number: "000000000001",
      box_number: "000000000001",
      pallet_number: "000000000001",
      production_date: formatDate(new Date()),
      exp_date_full: formatDate(new Date(Date.now() + Number(item.exp_date || 30) * 24 * 60 * 60 * 1000)),
      batch_number: "9999999999",
      operator: "07",
      operator_name: "Иванов И.И.",
      items: []
    };

    // Find if there's a table with maxRows — read from ref to avoid dep on doc.elements
    const tableEl = elementsRef.current.find(e => e.type === "table") as TableElement | undefined;
    const count = (tableEl?.maxRows && tableEl.maxRows > 0) ? tableEl.maxRows : 12;

    const SAMPLE_SKUS = [
      { name: "Колбаса «Молочная»", article: "ART-1001" },
      { name: "Сосиски «Сливочные»", article: "ART-1002" },
      { name: "Сардельки «Говяжьи»", article: "ART-1003" },
      { name: "Ветчина «Особая»", article: "ART-1004" },
      { name: "Карбонад «Классический»", article: "ART-1005" },
      { name: "Грудинка «Копчёная»", article: "ART-1006" },
      { name: "Бекон «Завтрак»", article: "ART-1007" },
      { name: "Шпикачки «Охотничьи»", article: "ART-1008" },
    ];
    const today = formatDate(new Date());
    const expiry = formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const yesterday = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const expiry2 = formatDate(new Date(Date.now() + 29 * 24 * 60 * 60 * 1000));
    // Несколько партий с разными датами — чтобы группировка была наглядной
    const BATCHES = [
      { num: "LOT-1001", prod: today, exp: expiry },
      { num: "LOT-1002", prod: yesterday, exp: expiry2 },
    ];
    let sumNetto = 0;
    let sumBrutto = 0;
    let sumQty = 0;
    for (let i = 0; i < count; i++) {
      const sku = SAMPLE_SKUS[i % 3];
      const batch = BATCHES[i % BATCHES.length];
      const qty = 8 + (i % 5) * 2;
      const netto = 9.5 + (i % 4) * 0.75;
      const brutto = netto + 0.4;
      sumNetto += netto;
      sumBrutto += brutto;
      sumQty += qty;
      data.items.push({
        name: sku.name,
        article: sku.article,
        quantity: String(qty),
        weight_netto_pack: netto.toFixed(3),
        weight_brutto_pack: brutto.toFixed(3),
        batch_number: batch.num,
        production_date_batch: batch.prod,
        exp_date_full: batch.exp,
        weight_netto_batch: (netto * qty).toFixed(3),
        weight_brutto_batch: (brutto * qty).toFixed(3),
        weight_netto_nomenclature: netto.toFixed(3),
        weight_brutto_nomenclature: brutto.toFixed(3),
      });
    }

    // Итоги паллеты — считаются из тех же строк, чтобы шапка и таблица сходились
    data.weight_total = sumBrutto.toFixed(3);
    data.weight_netto_pallet = sumNetto.toFixed(3);
    data.weight_brutto_pallet = sumBrutto.toFixed(3);
    data.total_count = String(sumQty);
    data.total_positions = String(count);
    data.total_places = String(count);
    data.total_boxes = String(sumQty);
    data.shipping_date = today;

    if (item.extra_data) {
      Object.entries(item.extra_data).forEach(([k, v]) => {
        data[k] = String(v);
      });
    }
    setPreviewData(data);
    // elementsRef is a ref — safe to read without adding to deps; no dep on doc.elements to avoid re-render loops
  }, []);

  const handleNomenclatureSelect = (id: string) => {
    setSelectedNomenclatureId(id);
    localStorage.setItem("labelDesigner_selectedNomenclatureId", id);

    const item = nomenclatures.find(n => n.id.toString() === id);

    if (!item) {
      setPreviewData(DEFAULT_PREVIEW_DATA);
      return;
    }

    // Clear cached barcode images so they are re-generated with the new product's data
    setDoc((d: LabelDoc) => ({
      ...d,
      elements: d.elements.map((el: LabelElement) =>
        el.type === "barcode" ? { ...el, imageData: undefined } as BarcodeElement : el
      )
    }));

    updatePreviewData(item);
  };


  const mainAttributes = useMemo(() => {
    const type = doc.canvas.labelType || "pack";

    const common = [
      { key: "name", label: t('designer.attrName'), icon: "📦" },
      { key: "article", label: t('designer.attrArticle'), icon: "🏷️" },
      { key: "exp_date", label: t('designer.attrExpDateDays'), icon: "⏳" },
      { key: "production_date", label: t('designer.attrProductionDate'), icon: "📅" },
      { key: "exp_date_full", label: t('designer.attrExpDateFullDate'), icon: "📅" },
      { key: "batch_number", label: t('designer.attrBatchNumber'), icon: "🔢" },
      { key: "operator", label: t('designer.attrOperatorNum'), icon: "👤" },
      { key: "operator_name", label: t('designer.attrOperatorName'), icon: "👤" },
    ];

    if (type === "pack") {
      return [
        ...common,
        { key: "weight_netto_pack", label: t('designer.attrWeightNettoPack'), icon: "⚖️" },
        { key: "weight_brutto_pack", label: t('designer.attrWeightBruttoPack'), icon: "⚖️" },
        { key: "pack_number", label: t('designer.attrPackNumber'), icon: "#️⃣" },
      ];
    } else if (type === "box") {
      return [
        ...common,
        { key: "close_box_counter", label: t('designer.attrCloseBoxCounter'), icon: "🔢" },
        { key: "weight_netto_box", label: t('designer.attrWeightNettoBox'), icon: "📦" },
        { key: "weight_brutto_box", label: t('designer.attrWeightBruttoBox'), icon: "📦" },
        { key: "box_number", label: t('designer.attrBoxNumber'), icon: "#️⃣" },
      ];
    } else {
      // pallet
      return [
        { key: "pallet_number", label: t('designer.attrPalletNumber'), icon: "#️⃣" },
        { key: "shipping_date", label: t('designer.attrShippingDate'), icon: "🚚" },
        { key: "production_date", label: t('designer.attrProductionDate'), icon: "📅" },
        { key: "operator", label: t('designer.attrOperatorNum'), icon: "👤" },
        { key: "operator_name", label: t('designer.attrOperatorName'), icon: "👤" },
        { key: "total_count", label: t('designer.attrTotalCount'), icon: "🔢" },
        { key: "total_places", label: t('designer.attrTotalPlaces'), icon: "📦" },
        { key: "total_boxes", label: t('designer.attrTotalBoxes'), icon: "📦" },
        { key: "weight_total", label: t('designer.attrWeightTotal'), icon: "⚖️" },
        { key: "weight_netto_pallet", label: t('designer.attrWeightNettoPallet'), icon: "🏗️" },
        { key: "weight_brutto_pallet", label: t('designer.attrWeightBruttoPallet'), icon: "🏗️" },
        { key: "weight_netto_batch", label: t('designer.attrWeightNettoBatch'), icon: "⚖️" },
        { key: "weight_brutto_batch", label: t('designer.attrWeightBruttoBatch'), icon: "⚖️" },
        { key: "production_date_batch", label: t('designer.attrProductionDateBatch'), icon: "📅" },
        { key: "exp_date_full", label: t('designer.attrExpDateFull'), icon: "📅" },
        { key: "weight_netto_nomenclature", label: t('designer.attrWeightNettoNomenclature'), icon: "⚖️" },
        { key: "weight_brutto_nomenclature", label: t('designer.attrWeightBruttoNomenclature'), icon: "⚖️" },
      ];
    }
  }, [doc.canvas.labelType, t]);

  const customAttributes = useMemo(() => {
    return globalAttributes.map((a: any) => ({
      key: a.name,
      label: a.name,
      icon: "✨"
    }));
  }, [globalAttributes]);

  const allAttributes = useMemo(() => {
    return [...mainAttributes, ...customAttributes];
  }, [mainAttributes, customAttributes]);

  useEffect(() => {
    const isEditable = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) setIsAltPressed(true);
      if (e.code === "Space" && !isEditable(e.target)) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) setIsAltPressed(false);
      if (e.code === "Space") setIsSpacePressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Canvas Rendering Effect
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpi = doc.canvas.dpi || DPI_203;
    const widthPx = cmToPx(doc.canvas.widthCm || 10, dpi);
    const heightPx = cmToPx(doc.canvas.heightCm || 6, dpi);

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = widthPx * dpr;
    canvas.height = heightPx * dpr;
    canvas.style.width = `${widthPx}px`;
    canvas.style.height = `${heightPx}px`;

    renderLabel(ctx, doc, previewData, {
      pixelRatio: dpr,
      showZones: true
    });
  }, [doc, previewData]);

  // Native wheel event listener with passive: false to prevent page scroll
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Always prevent default to stop page scrolling
      e.preventDefault();

      // Zoom: use deltaY for zooming
      const delta = -e.deltaY;
      const scaleFactor = 1.05;
      setZoom((prevZoom: number) => {
        let newZoom = delta > 0 ? prevZoom * scaleFactor : prevZoom / scaleFactor;
        newZoom = Math.min(Math.max(newZoom, 0.1), 5);
        return newZoom;
      });
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [view]);

  const onPointerDownViewport = useCallback((e: React.PointerEvent) => {
    // Ctrl+Left click, Alt+Left click, or Middle mouse for panning
    if (e.ctrlKey || isAltPressed || isSpacePressed || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      panRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        initialPan: pan,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      setSelectedId(null);
    }
  }, [isAltPressed, isSpacePressed, pan]);

  const onPointerMoveViewport = useCallback((e: React.PointerEvent) => {
    if (panRef.current?.active) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPan({
        x: panRef.current.initialPan.x + dx,
        y: panRef.current.initialPan.y + dy,
      });
      return;
    }
    // onPointerMove is defined later but stable — safe to call via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
    onPointerMove(e);
    // Empty deps: panRef is a ref (not state), onPointerMove reads zoom via closure
    // Adding pan/onPointerMove would cause infinite re-render loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerUpViewport = useCallback((e: React.PointerEvent) => {
    if (panRef.current?.active) {
      panRef.current = null;
      setIsPanning(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch { }
      return;
    }
    onPointerUp(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (selectedId && !doc.elements.some((e) => e.id === selectedId)) {
      setSelectedId(doc.elements[doc.elements.length - 1]?.id ?? null);
    }
  }, [doc.elements, selectedId]);

  // Canvas Rendering Effect
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpi = doc.canvas.dpi || DPI_203;
    const widthPx = cmToPx(doc.canvas.widthCm || 10, dpi);
    const heightPx = cmToPx(doc.canvas.heightCm || 6, dpi);

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = widthPx * dpr;
    canvas.height = heightPx * dpr;
    canvas.style.width = `${widthPx}px`;
    canvas.style.height = `${heightPx}px`;

    renderLabel(ctx, doc, previewData, {
      pixelRatio: dpr,
      showZones: true
    });
  }, [doc, previewData]);

  // New state for API integration
  const [labelId, setLabelId] = useState<number | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"element" | "canvas" | "zones">("element");
  const [labelName, setLabelName] = useState<string>(() => t('designer.newLayout'));

  // Restore state from localStorage on mount
  useEffect(() => {
    setHasMounted(true);

    // Restoration logic
    try {
      // 1. Label Doc — sessionStorage is tab-local so two tabs don't overwrite each other
      const savedDoc = sessionStorage.getItem(STORAGE_KEY);
      let currentDoc = doc;
      if (savedDoc) {
        const parsed = JSON.parse(savedDoc);
        const validated = validateDoc(parsed);
        if (validated) {
          setDoc(validated);
          currentDoc = validated;
        }
      }

      // 2. Selected Element
      const savedSelectedId = sessionStorage.getItem("labelDesigner_selectedId");
      if (savedSelectedId && currentDoc.elements.some(e => e.id === savedSelectedId)) {
        setSelectedId(savedSelectedId);
      } else if (currentDoc.elements.length > 0) {
        setSelectedId(currentDoc.elements[currentDoc.elements.length - 1].id);
      }

      // 3. View Port — also tab-local
      const savedZoom = sessionStorage.getItem("labelDesigner_zoom");
      if (savedZoom) setZoom(Number(savedZoom));

      const savedPan = sessionStorage.getItem("labelDesigner_pan");
      if (savedPan) {
        try { setPan(JSON.parse(savedPan)); } catch { }
      }

      // 4. API State
      const savedLabelId = localStorage.getItem("labelDesigner_labelId");
      if (savedLabelId) setLabelId(Number(savedLabelId));

      const savedLabelName = sessionStorage.getItem("labelDesigner_labelName");
      if (savedLabelName) setLabelName(savedLabelName);

    } catch (err) {
      console.error("Failed to restore designer state:", err);
    }
  }, []);
  const [savedLabels, setSavedLabels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!hasMounted || !selectedNomenclatureId) return;
    const item = nomenclatures.find(n => n.id.toString() === selectedNomenclatureId);
    if (item) {
      updatePreviewData(item);
    }
  }, [selectedNomenclatureId, nomenclatures, updatePreviewData]);

  useEffect(() => {
    if (!hasMounted) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  }, [doc, hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;
    if (labelId !== null) {
      localStorage.setItem("labelDesigner_labelId", labelId.toString());
    } else {
      localStorage.removeItem("labelDesigner_labelId");
    }
  }, [labelId, hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;
    sessionStorage.setItem("labelDesigner_labelName", labelName);
  }, [labelName, hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;
    sessionStorage.setItem("labelDesigner_zoom", zoom.toString());
  }, [zoom, hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;
    sessionStorage.setItem("labelDesigner_pan", JSON.stringify(pan));
  }, [pan, hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;
    if (selectedId) {
      sessionStorage.setItem("labelDesigner_selectedId", selectedId);
    } else {
      sessionStorage.removeItem("labelDesigner_selectedId");
    }
  }, [selectedId, hasMounted]);

  useEffect(() => {
    loadLabelsList();
  }, []);

  const loadLabelsList = async () => {
    try {
      const list = await client.labels.list();
      setSavedLabels(list);
    } catch (e) {
      console.error("Failed to load labels", e);
    }
  };

  const addText = useCallback(() => {
    const el: TextElement = {
      id: uid(),
      type: "text",
      x: 40,
      y: 40,
      w: 260,
      h: 44,
      rotation: 0,
      text: "Новый текст",
      fontSize: 20,
      color: "#000000",
      fontWeight: 600,
      fontFamily: "Inter",
      textAlign: "left",
      fontStyle: "normal",
      textDecoration: "none",
    };
    setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }, []);

  const addRect = useCallback(() => {
    const el: RectElement = {
      id: uid(),
      type: "rect",
      x: 48,
      y: 104,
      w: 240,
      h: 120,
      rotation: 0,
      fill: "#0B1220",
      borderColor: "#334155",
      borderWidth: 2,
      borderRadius: 14,
    };
    setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }, [setDoc, setSelectedId]); // Added setDoc, setSelectedId to dependencies

  const addBarcode = useCallback(async (templateName: string) => {
    const template = barcodeTemplates.find(t => t.name === templateName);
    if (!template) return;

    // Detect 2D barcodes (QR, DataMatrix, etc.) for square default dimensions
    const barcodeType = template.structure?.barcode_type || '';
    const is2D = ['qrcode', 'gs1qrcode', 'datamatrix', 'azteccode'].includes(barcodeType.toLowerCase());

    const el: BarcodeElement = {
      id: uid(),
      type: "barcode",
      x: 48,
      y: 240,
      w: is2D ? 150 : 260,
      h: is2D ? 150 : 80,
      rotation: 0,
      value: "{{ barcode }}",
      barcodeType: template.name,
      showText: !is2D,
      templateId: template.id,
    };

    setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);

    // Immediately fetch image
    await generateBarcodeImage(template, el.id);
  }, [barcodeTemplates, generateBarcodeImage]);

  const addTable = useCallback(() => {
    const el: TableElement = {
      id: uid(),
      type: "table",
      x: 40,
      y: 300,
      w: 600,
      h: 400,
      rotation: 0,
      columns: [
        { id: uid(), key: "name", title: "Наименование", widthRatio: 40 },
        { id: uid(), key: "batch_number", title: "Партия", widthRatio: 30 },
        { id: uid(), key: "weight_netto_pack", title: "Вес", widthRatio: 30 },
      ],
      groupBy: "none",
      sortBy: "none",
      fontSize: 12,
      showHeaders: true,
      showBorders: true,
      fontFamily: "Inter",
      fontStyle: "normal",
    };
    setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }, []);

  const addAttribute = useCallback((attributeKey: string, label: string) => {
    const el: TextElement = {
      id: uid(),
      type: "text",
      x: 40,
      y: 40,
      w: 260,
      h: 36,
      rotation: 0,
      text: `{{ ${attributeKey}}}`,
      fontSize: 14,
      color: "#000000",
      fontWeight: 500,
      fontFamily: "Inter",
      textAlign: "left",
      fontStyle: "normal",
      textDecoration: "none",
    };

    // If adding a counter variable, fixed minLength to 12
    if (attributeKey.includes("pack_number") || attributeKey.includes("box_number")) {
      el.minLength = 12;
    }

    setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }, []);

  const updateSelected = useCallback(
    (patch: Partial<LabelElement>) => {
      if (!selectedId) return;

      const el = doc.elements.find((e: LabelElement) => e.id === selectedId);

      // If updating text, detect if a counter variable was added manually or via helper
      const textPatch = (patch as any).text;
      if (el?.type === "text" && textPatch !== undefined && typeof textPatch === "string") {
        const oldText = (el as TextElement).text;
        const newText = textPatch;
        const counters = ["{{ pack_number }}", "{{ box_number }}"];
        const addedCounter = counters.find(c => newText.includes(c) && !oldText.includes(c));

        if (addedCounter && !(el as TextElement).minLength) {
          (patch as any).minLength = 12;
        }
      }

      let finalPatch = { ...patch };

      // Handle barcode-specific snapping for EAN-13
      if (el?.type === "barcode" && (el as BarcodeElement).barcodeType.toLowerCase().includes("ean13")) {
        if (patch.w !== undefined) {
          const mw = Math.round(patch.w / 95);
          finalPatch.w = Math.max(1, mw) * 95;
        }
      }

      setDoc((d: LabelDoc) => ({
        ...d,
        elements: d.elements.map((e: LabelElement) =>
          e.id === selectedId ? ({ ...e, ...finalPatch } as LabelElement) : e
        ),
      }));
    },
    [selectedId, doc.elements]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setDoc((d: LabelDoc) => ({ ...d, elements: d.elements.filter((e: LabelElement) => e.id !== selectedId) }));
  }, [selectedId]);

  const moveLayer = useCallback(
    (dir: "up" | "down") => {
      if (!selectedId) return;
      setDoc((d) => {
        const idx = d.elements.findIndex((e) => e.id === selectedId);
        if (idx < 0) return d;
        const nextIdx = dir === "up" ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= d.elements.length) return d;
        const copy = d.elements.slice();
        const [item] = copy.splice(idx, 1);
        copy.splice(nextIdx, 0, item);
        return { ...d, elements: copy };
      });
    },
    [selectedId]
  );

  const onPointerDownElement = useCallback(
    (e: React.PointerEvent, elementId: string) => {
      // В режиме пана (пробел / ctrl / alt / средняя кнопка) не хватаем элемент — пусть холст панорамируется
      if (isSpacePressed || e.ctrlKey || isAltPressed || e.button === 1) return;
      e.preventDefault();
      e.stopPropagation();
      const el = doc.elements.find((x) => x.id === elementId);
      if (!el) return;
      setSelectedId(elementId);

      // Simple: just mark as dragging, no offset calculation needed
      dragRef.current = {
        active: true,
        elementId,
        offsetX: 0,
        offsetY: 0,
        startX: el.x,
        startY: el.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [doc.elements]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // 1. Resizing
    if (resizeRef.current?.active) {
      const resize = resizeRef.current;
      const el = resize.initialElement;

      // Calculate delta in screen pixels, then convert to canvas scaling
      const globalDx = (e.clientX - resize.startX) / zoom;
      const globalDy = (e.clientY - resize.startY) / zoom;

      // Project delta into element's local coordinate system (unrotated)
      // We rotate the global delta by -rotation
      const localDelta = rotatePoint(globalDx, globalDy, -el.rotation);

      let newX = el.x;
      let newY = el.y;
      let newW = el.w;
      let newH = el.h;

      // Apply changes based on handle
      // Note: In local coords, x/y is top-left, w/h extends right/down

      const { handle } = resize;

      if (handle.includes("e")) {
        let w = el.w + localDelta.x;
        if (el.type === "barcode" && (el as BarcodeElement).barcodeType.toLowerCase().includes("ean13")) {
          const mw = Math.round(w / 95);
          w = Math.max(mw, 1) * 95;
        }
        newW = Math.max(1, w);
      }
      if (handle.includes("w")) {
        let w = el.w - localDelta.x;
        if (el.type === "barcode" && (el as BarcodeElement).barcodeType.toLowerCase().includes("ean13")) {
          const mw = Math.round(w / 95);
          w = Math.max(mw, 1) * 95;
        }
        newW = Math.max(1, w);

        if (newW !== el.w) {
          const effectiveLocalDx = el.w - newW;
          const shiftWorld = rotatePoint(effectiveLocalDx, 0, el.rotation);
          newX += shiftWorld.x;
          newY += shiftWorld.y;
        }
      }

      if (handle.includes("s")) {
        newH = Math.max(1, el.h + localDelta.y);
      }
      if (handle.includes("n")) {
        newH = Math.max(1, el.h - localDelta.y);
        if (newH !== el.h) {
          const shiftWorld = rotatePoint(0, localDelta.y, el.rotation);
          newX += shiftWorld.x;
          newY += shiftWorld.y;
        }
      }

      setDoc((d: LabelDoc) => ({
        ...d,
        elements: d.elements.map((curr: LabelElement) =>
          curr.id === el.id ? { ...curr, x: newX, y: newY, w: newW, h: newH } : curr
        ),
      }));
      return;
    }

    // 2. Dragging
    const drag = dragRef.current;

    if (!drag?.active) return;

    // Use movementX/Y - the delta since last pointer event
    // Divide by zoom to convert screen pixels to canvas pixels
    const deltaX = e.movementX / zoom;
    const deltaY = e.movementY / zoom;

    setDoc((d) => ({
      ...d,
      elements: d.elements.map((el) =>
        el.id === drag.elementId
          ? ({ ...el, x: el.x + deltaX, y: el.y + deltaY } as LabelElement)
          : el
      ),
    }));
  }, [zoom]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (resizeRef.current?.active) {
      resizeRef.current = null;
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { }
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const toggleGrid = useCallback(() => {
    setDoc((d) => ({ ...d, canvas: { ...d.canvas, showGrid: !d.canvas.showGrid } }));
  }, []);

  const saveToApi = useCallback(async () => {
    setIsLoading(true);
    try {
      const payload = {
        name: labelName,
        scheme: doc
      };

      if (labelId) {
        await client.labels.update(labelId, payload);
        alert(t('designer.layoutUpdated'));
      } else {
        const name = window.prompt(t('designer.enterLayoutName'), labelName);
        if (!name) {
          setIsLoading(false);
          return;
        }
        setLabelName(name);
        payload.name = name;
        const created = await client.labels.create(payload);
        setLabelId(created.id);
        alert(t('designer.layoutSaved'));
      }
      loadLabelsList();
    } catch (e) {
      console.error(e);
      alert(t('designer.saveError'));
    } finally {
      setIsLoading(false);
    }
  }, [doc, labelId, labelName, t]);

  const loadLabelEntry = useCallback((label: any) => {
    if (!confirm(t('designer.confirmLoadLayout'))) return;
    try {
      let scheme = label.scheme;

      // Fallback: if scheme is not an object, try parsing 'structure'
      if (!scheme || typeof scheme !== 'object') {
        const structure = label.structure || label.scheme;
        if (typeof structure === 'string') {
          try {
            scheme = JSON.parse(structure);
          } catch (e) {
            console.error("Failed to parse structure string", e);
          }
        }
      }

      const v = validateDoc(scheme);
      if (v) {
        setDoc(v);
        setLabelId(label.id);
        setLabelName(label.name);
        setSelectedId(null);
      } else {
        alert(t('designer.invalidLayoutFormat'));
      }
    } catch (e) {
      console.error(e);
      alert(t('designer.loadError'));
    }
  }, [t]);

  const deleteLabelEntry = useCallback(async (id: number) => {
    if (!confirm(t('designer.confirmDeleteLayout'))) return;
    try {
      await client.labels.delete(id);
      if (labelId === id) {
        setLabelId(null);
        setLabelName(t('designer.newLayout'));
        setDoc(defaultDoc());
      }
      loadLabelsList();
    } catch (e) {
      console.error(e);
      alert(t('designer.deleteError'));
    }
  }, [labelId, t]);

  const resetDoc = useCallback(() => {
    if (!confirm(t('designer.confirmResetLayout'))) return;
    const d = defaultDoc();
    setDoc(d);
    setLabelId(null);
    setLabelName(t('designer.newLayout'));
    setSelectedId(d.elements[d.elements.length - 1]?.id ?? null);
  }, [t]);

  // ── Template-first: открыть существующий / создать новый, затем войти в редактор ──
  const openTemplate = useCallback((label: any) => {
    let scheme = label?.scheme;
    if (!scheme || typeof scheme !== "object") {
      const structure = label?.structure ?? label?.scheme;
      if (typeof structure === "string") {
        try {
          scheme = JSON.parse(structure);
        } catch {
          scheme = null;
        }
      }
    }
    const v = validateDoc(scheme);
    if (!v) {
      alert(t('designer.invalidTemplateFormat'));
      return;
    }
    setDoc(v);
    setLabelId(label.id);
    setLabelName(label.name);
    setSelectedId(null);
    setView("editor");
    if (v.canvas.labelType === "pallet") {
      updatePreviewData({});
    }
  }, [updatePreviewData, t]);

  const createTemplate = useCallback(
    (opts: { name: string; labelType: "pack" | "box" | "pallet"; widthCm: number; heightCm: number }) => {
      const base = defaultDoc();
      const width = cmToPx(opts.widthCm, base.canvas.dpi);
      const height = cmToPx(opts.heightCm, base.canvas.dpi);
      const d: LabelDoc = {
        ...base,
        canvas: {
          ...base.canvas,
          labelType: opts.labelType,
          widthCm: opts.widthCm,
          heightCm: opts.heightCm,
          width,
          height,
        },
        elements: opts.labelType === "pallet" ? buildPalletLayout(width, height) : base.elements,
      };
      setDoc(d);
      setLabelId(null);
      setLabelName(opts.name || t('designer.newTemplate'));
      setSelectedId(null);
      setView("editor");
      if (opts.labelType === "pallet") {
        updatePreviewData({});
      }
    },
    [updatePreviewData, t]
  );

  // ... (copyJson, canvasStyle) ...


  const copyJson = useCallback(async () => {
    const text = JSON.stringify(doc, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      alert(t('designer.jsonCopied'));
    } catch {
      // ignore
    }
  }, [doc, t]);

  const copyZpl = useCallback(async () => {
    const zpl = labelToZpl(doc, previewData);
    try {
      await navigator.clipboard.writeText(zpl);
      alert(t('designer.zplCopied'));
    } catch {
      // ignore
    }
  }, [doc, previewData, t]);

  const printLabel = useCallback(() => {
    // High-resolution print implementation
    const dpi = doc.canvas.dpi || 203;
    const widthPx = cmToPx(doc.canvas.widthCm || 10, dpi);
    const heightPx = cmToPx(doc.canvas.heightCm || 6, dpi);

    // Create a temporary canvas for high-res rendering
    // We increase resolution for printing (300 DPI equivalent or scale x2)
    const printScale = 2; // Simple scale multiplier for clarity
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = widthPx * printScale;
    tempCanvas.height = heightPx * printScale;
    const tempCtx = tempCanvas.getContext("2d");

    if (!tempCtx) return;

    renderLabel(tempCtx, doc, previewData, {
      pixelRatio: printScale,
      showZones: false
    });

    const dataUrl = tempCanvas.toDataURL("image/png");

    // Open a new window and print
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert(t('designer.allowPopupsForPrint'));
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${t('designer.printLabelTitle', { name: labelName })}</title>
          <style>
            body { margin: 0; display: flex; justify-content: center; align-items: flex-start; background: white; }
            img { width: 100%; max-width: ${doc.canvas.widthCm}cm; height: auto; display: block; }
            @page { margin: 0; size: ${doc.canvas.widthCm}cm ${doc.canvas.heightCm}cm; }
            @media print {
              img { width: ${doc.canvas.widthCm}cm; height: ${doc.canvas.heightCm}cm; }
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" />
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [doc, previewData, labelName]);

  const selected = useMemo(
    () => doc.elements.find((e) => e.id === selectedId) ?? null,
    [doc.elements, selectedId]
  );

  const canvasStyle = useMemo(() => {
    // Compute pixel dimensions from cm and dpi
    const widthPx = cmToPx(doc.canvas.widthCm || 10, doc.canvas.dpi || DPI_203);
    const heightPx = cmToPx(doc.canvas.heightCm || 6, doc.canvas.dpi || DPI_203);

    const grid =
      doc.canvas.showGrid && doc.canvas.gridSize > 0
        ? {
          backgroundImage: `
                                    linear-gradient(to right, rgba(0,0,0,0.15) 1px, transparent 1px),
                                    linear-gradient(to bottom, rgba(0,0,0,0.15) 1px, transparent 1px)
                                    `,
          backgroundSize: `${doc.canvas.gridSize}px ${doc.canvas.gridSize}px`,
        }
        : {};
    return {
      width: `${widthPx}px`,
      height: `${heightPx}px`,
      backgroundColor: doc.canvas.background,
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: "center center",
      transition: isPanning ? "none" : "transform 0.1s ease-out",
      boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      border: "2px solid #64748b",
      ...grid,
    } as React.CSSProperties;
  }, [doc.canvas, zoom, pan, isPanning]);

  if (view === "hub") {
    return (
      <TemplateHub
        templates={savedLabels}
        onOpen={openTemplate}
        onCreate={createTemplate}
        onDelete={deleteLabelEntry}
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col gap-3 overflow-hidden">
      {/* Top: template anchor + add tools */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
        <button
          onClick={() => setView("hub")}
          title={t('designer.toTemplates')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
            <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('designer.templates')}
        </button>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">{labelName}</div>
          <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-white/45">
            {doc.canvas.widthCm}×{doc.canvas.heightCm} {t('designer.cmUnit')} · {doc.canvas.labelType === "pack" ? t('designer.typePack') : doc.canvas.labelType === "box" ? t('designer.typeBox') : t('designer.typePallet')}
          </div>
        </div>

        <div className="mx-1 h-6 w-px bg-white/10" />

        <span className="font-[family-name:var(--font-geist-mono)] text-[9px] uppercase tracking-wider text-indigo-300/70">{t('designer.add')}</span>
        <SmallButton variant="secondary" onClick={addText}>
          <Icon name="text" />
          {t('designer.text')}
        </SmallButton>
        <SmallButton variant="secondary" onClick={addRect}>
          <Icon name="rect" />
          {t('designer.shape')}
        </SmallButton>
        {barcodeTemplates.length > 0 && (
          <div className="relative">
            <select
              className="h-8 w-[150px] cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/10 pl-3 pr-7 text-xs font-medium text-white outline-none transition-all hover:bg-white/15"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  addBarcode(e.target.value);
                  e.target.value = "";
                }
              }}
            >
              <option value="" disabled className="bg-[#1A1D24]">{t('designer.barcodeDots')}</option>
              {barcodeTemplates.map((t: any) => (
                <option key={t.id} value={t.name} className="bg-[#1A1D24]">{t.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/40">
              <Icon name="chevron-down" className="h-3 w-3" />
            </div>
          </div>
        )}
        {doc.canvas.labelType === "pallet" && (
          <SmallButton variant="secondary" onClick={addTable}>
            <Icon name="table" />
            {t('designer.table')}
          </SmallButton>
        )}

        <div className="mx-1 h-6 w-px bg-white/10" />

        <div className="relative">
          <select
            className="h-8 w-[190px] cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/10 pl-9 pr-7 text-xs font-medium text-white outline-none transition-all hover:bg-white/15"
            value={selectedNomenclatureId}
            onChange={(e) => handleNomenclatureSelect(e.target.value)}
          >
            <option value="" className="bg-[#1A1D24]">{t('designer.selectProduct')}</option>
            {nomenclatures.map((n) => (
              <option key={n.id} value={n.id} className="bg-[#1A1D24]">
                {n.article} - {n.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40">
            <Icon name="box" className="h-4 w-4" />
          </div>
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/40">
            <Icon name="chevron-down" className="h-3 w-3" />
          </div>
        </div>

        <span className="flex-1" />

        <SmallButton variant={doc.canvas.showGrid ? "primary" : "ghost"} onClick={toggleGrid} title={t('designer.grid')}>
          <Icon name="grid" />
        </SmallButton>
        <SmallButton variant="primary" onClick={saveToApi} disabled={isLoading} title={t('designer.save')}>
          <Icon name="save" />
          {t('designer.save')}
        </SmallButton>
        <SmallButton variant="secondary" onClick={copyZpl} title={t('designer.exportZpl')}>ZPL</SmallButton>
        <SmallButton variant="ghost" onClick={copyJson} title={t('designer.copyJson')}>JSON</SmallButton>
        <SmallButton variant="ghost" onClick={resetDoc} title={t('designer.resetLayout')}>
          <Icon name="reset" />
        </SmallButton>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* Left: tools + layers */}
        <aside style={{ width: 208, minWidth: 0, flexGrow: 0, flexShrink: 0 }} className="overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">

        {/* Product Attributes Section */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <details className="group" open>
            <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-white list-none">
              <span>{t('designer.productAttributes')}</span>
              <span className="text-white/50 transition-transform duration-200 group-open:rotate-90">▶</span>
            </summary>
            <div className="mt-3 max-h-64 overflow-y-auto custom-scrollbar flex flex-col gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 px-1">{t('designer.mainAttributes')}</div>
                <div className="flex flex-col gap-1">
                  {mainAttributes.map((attr) => (
                    <button
                      key={attr.key}
                      onClick={() => addAttribute(attr.key, attr.label)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
                    >
                      <span className="text-sm">{attr.icon}</span>
                      <span>{attr.label}</span>
                    </button>
                  ))}
                  {doc.canvas.labelType === "pallet" && (
                    <button
                      onClick={addTable}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all font-semibold mt-1"
                    >
                      <Icon name="table" />
                      <span>{t('designer.addTable')}</span>
                    </button>
                  )}
                </div>
              </div>

              {customAttributes.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 px-1">{t('designer.customAttributes')}</div>
                  <div className="flex flex-col gap-1">
                    {customAttributes.map((attr: any) => (
                      <button
                        key={attr.key}
                        onClick={() => addAttribute(attr.key, attr.label)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
                      >
                        <span className="text-sm">{attr.icon}</span>
                        <span>{attr.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">{t('designer.layers')}</div>
            <div className="flex items-center gap-1">
              <SmallButton
                variant="ghost"
                onClick={() => moveLayer("down")}
                disabled={!selectedId}
                title={t('designer.moveBack')}
              >
                <Icon name="down" />
              </SmallButton>
              <SmallButton
                variant="ghost"
                onClick={() => moveLayer("up")}
                disabled={!selectedId}
                title={t('designer.moveForward')}
              >
                <Icon name="up" />
              </SmallButton>
            </div>
          </div>

          <div className="my-4 h-px bg-white/10" />

          <div className="mt-3 flex flex-col gap-1">
            {doc.elements.map((el: LabelElement, i: number) => (
              <button
                key={el.id}
                onClick={() => setSelectedId(el.id)}
                title={el.type === "text" ? (el as TextElement).text : el.type}
                className={cx(
                  "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all",
                  selectedId === el.id
                    ? "border-blue-500/50 bg-blue-500/10 text-white"
                    : "border-transparent text-white/60 hover:bg-white/5 hover:text-white/90"
                )}
              >
                <div className="flex h-5 w-5 flex-none items-center justify-center rounded bg-white/5 text-[10px] font-semibold text-white/50">
                  {i + 1}
                </div>
                <Icon name={el.type as any} className="h-4 w-4 flex-none opacity-40" />
                <span className="min-w-0 grow truncate text-xs font-medium">
                  {((elType: string) =>
                    elType === "text"
                      ? ((el as TextElement).text?.trim() || t('designer.text'))
                      : elType === "barcode" ? t('designer.barcode')
                        : elType === "rect" ? t('designer.shape')
                          : elType === "table" ? t('designer.table')
                            : elType === "image" ? t('designer.image')
                              : elType)(el.type as string)}
                </span>
              </button>
            ))}
            {doc.elements.length === 0 && (
              <div className="py-8 text-center text-xs text-white/30 italic">
                {t('designer.noElements')}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Center: Infinite Canvas */}
      <main
        ref={mainRef}
        className={cx(
          "relative flex min-w-0 flex-1 items-center justify-center bg-white overflow-hidden rounded-2xl border border-slate-200 shadow-inner",
          isSpacePressed && !isPanning && "cursor-grab",
          isPanning && "cursor-grabbing"
        )}
        onPointerDown={onPointerDownViewport}
        onPointerMove={onPointerMoveViewport}
        onPointerUp={onPointerUpViewport}
      >
        {/* Workspace Info */}
        <div className="absolute top-4 left-4 z-10 flex cursor-default items-center gap-3 rounded-xl border border-slate-200 bg-white/80 p-2 px-3 text-xs font-medium text-slate-600 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">{t('designer.layoutLabel')}</span>
            <span className="text-slate-900 font-bold max-w-[200px] truncate" title={labelName}>
              {labelName}
            </span>
            <button
              onClick={() => {
                const name = window.prompt(t('designer.enterNewLayoutName'), labelName);
                if (name && name.trim()) setLabelName(name.trim());
              }}
              className="ml-1 text-slate-400 hover:text-indigo-600 transition-colors"
              title={t('designer.rename')}
            >
              <Icon name="edit" className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-slate-400">{t('designer.scaleLabel')}</span>
            <span className="text-slate-900 font-bold">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-slate-400">{t('designer.sizeLabel')}</span>
            <span className="text-slate-900 font-bold">
              {doc.canvas.widthCm}x{doc.canvas.heightCm} {t('designer.cmUnit')}
            </span>
          </div>
        </div>

        {/* The Viewport */}
        <div
          ref={viewportRef}
          className="relative w-full h-full flex items-center justify-center overflow-auto"
        >
          {/* The Canvas */}
          <div
            ref={canvasRef}
            className="relative shadow-2xl flex-shrink-0"
            style={canvasStyle}
          >
            {/* The Unified Canvas Preview */}
            <canvas
              ref={previewCanvasRef}
              className="absolute inset-0 pointer-events-none"
            />

            {doc.elements.map((el: LabelElement) => {
              const commonProps = {
                onPointerDown: (e: React.PointerEvent) => onPointerDownElement(e, el.id),
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSelectedId(el.id);
                },
                className: cx(
                  "absolute cursor-move select-none",
                  selectedId === el.id ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-[#121212] z-10" : "hover:ring-1 hover:ring-white/20"
                ),
                style: {
                  left: el.x,
                  top: el.y,
                  width: el.w,
                  height: el.h,
                  transform: `rotate(${el.rotation}deg)`,
                  transformOrigin: "center center",
                } as React.CSSProperties,
              };

              // Resize handles
              const isSelected = selectedId === el.id;
              const handles = isSelected && !isPanning ? (
                <>
                  {["nw", "ne", "se", "sw", "n", "s", "e", "w"].map((h) => {
                    // Position handles relative to the element box
                    // The element is transformed by rotation, so we can just place handles at 0/100%
                    // and they will rotate with it.
                    let top = "0%";
                    let left = "0%";
                    let cursor = "nwse-resize"; // default fallback

                    if (h.includes("n")) top = "-6px";
                    else if (h.includes("s")) top = "calc(100% - 6px)"; // slightly inside/outside? let's center on edge
                    else top = "calc(50% - 6px)";

                    if (h.includes("w")) left = "-6px";
                    else if (h.includes("e")) left = "calc(100% - 6px)";
                    else left = "calc(50% - 6px)";

                    // Simple cursor logic that doesn't account for rotation (for now)
                    // TODO: Adjust cursor based on rotation + handle

                    return (
                      <div
                        key={h}
                        className="absolute h-3 w-3 border border-blue-500 bg-white shadow-sm z-50 rounded-full"
                        style={{ top, left, cursor: "pointer" }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          resizeRef.current = {
                            active: true,
                            handle: h,
                            startX: e.clientX,
                            startY: e.clientY,
                            initialElement: { ...el },
                          };
                          (e.currentTarget.parentElement?.parentElement?.parentElement as HTMLElement).setPointerCapture(e.pointerId);
                        }}
                      />
                    );
                  })}
                </>
              ) : null;



              // 1. Interaction Layer (Transparent blocks for dragging/selecting)
              return (
                <div key={el.id} {...commonProps}>
                  {/* Visual content is handled by the canvas below, except for rotation/selection highlight */}
                  {isSelected && (
                    <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none" />
                  )}
                  {handles}
                </div>
              );

              return null;
            })}
          </div>
        </div>

        {/* Zoom Controls Overlay */}
        <div className="absolute bottom-4 right-4 z-10 flex gap-1 rounded-xl border border-white/10 bg-black/40 p-1 backdrop-blur-md">
          <SmallButton
            variant="ghost"
            onClick={() => setZoom((z: number) => Math.max(0.2, z - 0.1))}
            title={t('designer.zoomOut')}
          >
            <Icon name="minus" className="h-4 w-4" />
          </SmallButton>
          <div className="flex items-center px-2 text-[10px] font-bold text-white min-w-[40px] justify-center">
            {Math.round(zoom * 100)}%
          </div>
          <SmallButton
            variant="ghost"
            onClick={() => setZoom((z: number) => Math.min(5, z + 0.1))}
            title={t('designer.zoomIn')}
          >
            <Icon name="plus" className="h-4 w-4" />
          </SmallButton>
          <div className="w-px bg-white/10 mx-1" />
          <SmallButton
            variant="ghost"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            title={t('designer.reset')}
          >
            Reset
          </SmallButton>
        </div>
      </main>

      {/* Right: properties */}
        <aside style={{ width: 320, minWidth: 0, flexGrow: 0, flexShrink: 0 }} className="overflow-y-auto overflow-x-hidden pl-2 custom-scrollbar">
        <div className="mb-3 flex gap-1.5 rounded-xl border border-white/10 bg-white/5 p-1">
          {([
            { k: "element", label: t('designer.tabElement') },
            { k: "canvas", label: t('designer.tabCanvas') },
            { k: "zones", label: t('designer.tabZones') },
          ] as const).map((tab) => (
            <button
              key={tab.k}
              onClick={() => setInspectorTab(tab.k)}
              className={cx(
                "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition border",
                inspectorTab === tab.k
                  ? "border-indigo-400/30 bg-indigo-400/15 text-indigo-200"
                  : "border-transparent text-white/55 hover:bg-white/5 hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {inspectorTab === "element" && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">{t('designer.properties')}</div>
              <div className="text-xs text-white/60">
                {selected ? t('designer.selectedType', { type: selected.type }) : t('designer.selectElement')}
              </div>
            </div>
            <SmallButton
              variant="danger"
              disabled={!selected}
              onClick={deleteSelected}
              title={t('designer.delete')}
            >
              <Icon name="trash" />
            </SmallButton>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {selected ? (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                  <Field label="X (px)">
                    <NumberInput
                      value={Math.round(selected.x)}
                      onChange={(v) => updateSelected({ x: v })}
                    />
                  </Field>
                  <Field label="Y (px)">
                    <NumberInput
                      value={Math.round(selected.y)}
                      onChange={(v) => updateSelected({ y: v })}
                    />
                  </Field>
                  <Field label="W (px)">
                    <NumberInput
                      value={Math.round(selected.w)}
                      onChange={(v) => updateSelected({ w: Math.max(1, v) })}
                    />
                  </Field>
                  <Field label="H (px)">
                    <NumberInput
                      value={Math.round(selected.h)}
                      onChange={(v) => updateSelected({ h: Math.max(1, v) })}
                    />
                  </Field>
                </div>
                <Field label={t('designer.rotationAngle')}>
                  <NumberInput
                    value={Math.round(selected.rotation)}
                    onChange={(v) => updateSelected({ rotation: v })}
                    min={-360}
                    max={360}
                  />
                </Field>

                <div className="my-2 h-px bg-white/10" />

                {selected.type === "text" && (
                  <div className="flex flex-col gap-3">
                    <Field label={t('designer.text')}>
                      <VariableTextInput
                        value={(selected as TextElement).text}
                        onChange={(v) => updateSelected({ text: v })}
                        attributes={allAttributes}
                      />
                    </Field>
                    <Field label={t('designer.fontSize')}>
                      <NumberInput
                        value={(selected as TextElement).fontSize}
                        onChange={(v) => updateSelected({ fontSize: v })}
                      />
                    </Field>
                    <Field label={t('designer.lengthZeroNone')}>
                      <NumberInput
                        value={(selected as TextElement).minLength || 0}
                        onChange={(v) => updateSelected({ minLength: v > 0 ? v : undefined })}
                        min={0}
                        max={50}
                      />
                    </Field>

                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                      <Field label={t('designer.font')}>
                        <CustomSelect
                          value={(selected as TextElement).fontFamily || "Inter"}
                          onChange={(v) => updateSelected({ fontFamily: v })}
                          options={FONTS.map(f => ({ value: f, label: f }))}
                          renderOption={(opt) => (
                            <span style={{ fontFamily: opt.value }}>{opt.label}</span>
                          )}
                        />
                      </Field>
                      <Field label={t('designer.weight')}>
                        <CustomSelect
                          value={(selected as TextElement).fontWeight}
                          onChange={(v) => updateSelected({ fontWeight: v })}
                          options={[100, 200, 300, 400, 500, 600, 700, 800, 900].map(w => ({
                            value: w,
                            label: w === 400 ? 'Regular' : w === 600 ? 'SemiBold' : w === 700 ? 'Bold' : String(w)
                          }))}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                      <Field label={t('designer.alignment')}>
                        <div className="flex bg-white/5 rounded-xl border border-white/10 p-1">
                          {(['left', 'center', 'right'] as const).map((align) => (
                            <button
                              key={align}
                              onClick={() => updateSelected({ textAlign: align })}
                              className={cx(
                                "flex-1 px-2 py-1.5 rounded-lg transition-all text-[10px] font-medium uppercase",
                                (selected as TextElement).textAlign === align || (!(selected as TextElement).textAlign && align === 'left')
                                  ? "bg-white/20 text-white shadow-sm"
                                  : "text-white/40 hover:text-white/60"
                              )}
                            >
                              {align === 'left' ? 'L' : align === 'center' ? 'C' : 'R'}
                            </button>
                          ))}
                        </div>
                      </Field>
                      <Field label={t('designer.style')}>
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateSelected({ fontStyle: (selected as TextElement).fontStyle === 'italic' ? 'normal' : 'italic' })}
                            className={cx(
                              "h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 transition-all font-serif italic text-sm",
                              (selected as TextElement).fontStyle === 'italic'
                                ? "bg-white/20 text-white border-white/20"
                                : "bg-white/5 text-white/40 hover:bg-white/10"
                            )}
                          >
                            I
                          </button>
                          <button
                            onClick={() => updateSelected({ textDecoration: (selected as TextElement).textDecoration === 'underline' ? 'none' : 'underline' })}
                            className={cx(
                              "h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 transition-all underline text-sm",
                              (selected as TextElement).textDecoration === 'underline'
                                ? "bg-white/20 text-white border-white/20"
                                : "bg-white/5 text-white/40 hover:bg-white/10"
                            )}
                          >
                            U
                          </button>
                        </div>
                      </Field>
                    </div>
                    <Field label={t('designer.color')}>
                      <ColorInput
                        value={(selected as TextElement).color}
                        onChange={(v) => updateSelected({ color: v })}
                      />
                    </Field>
                  </div>
                )}

                {selected.type === "rect" && (
                  <div className="flex flex-col gap-3">
                    <Field label={t('designer.background')}>
                      <ColorInput
                        value={(selected as RectElement).fill}
                        onChange={(v) => updateSelected({ fill: v })}
                      />
                    </Field>
                    <Field label={t('designer.borderColor')}>
                      <ColorInput
                        value={(selected as RectElement).borderColor}
                        onChange={(v) => updateSelected({ borderColor: v })}
                      />
                    </Field>
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                      <Field label={t('designer.borderWidth')}>
                        <NumberInput
                          value={(selected as RectElement).borderWidth}
                          onChange={(v) => updateSelected({ borderWidth: v })}
                        />
                      </Field>
                      <Field label={t('designer.borderRadius')}>
                        <NumberInput
                          value={(selected as RectElement).borderRadius}
                          onChange={(v) => updateSelected({ borderRadius: v })}
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {selected.type === "barcode" && (
                  <div className="flex flex-col gap-3">
                    <Field label={t('designer.barcodeType')}>
                      <select
                        className="h-9 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white outline-none hover:bg-white/15 transition-all"
                        value={(selected as BarcodeElement).barcodeType}
                        onChange={(e) => {
                          const name = e.target.value;
                          const template = barcodeTemplates.find(t => t.name === name);
                          updateSelected({
                            barcodeType: name,
                            templateId: template?.id,
                            imageData: undefined // Force refresh
                          });
                        }}
                      >
                        {barcodeTemplates.map((t: any) => (
                          <option key={t.id} value={t.name} className="bg-[#1A1D24]">{t.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('designer.barcodeValue')}>
                      <VariableTextInput
                        value={(selected as BarcodeElement).value}
                        onChange={(v) => updateSelected({ value: v })}
                        attributes={allAttributes}
                        multiline={false}
                      />
                    </Field>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/60">{t('designer.showText')}</span>
                      <input
                        type="checkbox"
                        checked={(selected as BarcodeElement).showText}
                        onChange={(e) => updateSelected({ showText: e.target.checked })}
                      />
                    </div>
                  </div>
                )}

                {selected.type === "table" && (
                  <div className="flex flex-col gap-4">
                    {/* Колонки */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{t('designer.columns')}</span>
                        <SmallButton variant="secondary" onClick={() => {
                          const tbl = selected as TableElement;
                          updateSelected({ columns: [...tbl.columns, { id: uid(), key: "name", title: t('designer.newColumn'), widthRatio: 15 }] });
                        }}>
                          <Icon name="plus" /> {t('designer.add')}
                        </SmallButton>
                      </div>
                      <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
                        {(selected as TableElement).columns.map((col) => (
                          <div key={col.id} className="flex items-center gap-1.5">
                            <input
                              value={col.title}
                              placeholder={t('designer.columnHeaderPlaceholder')}
                              onChange={(e) => {
                                const tbl = selected as TableElement;
                                updateSelected({ columns: tbl.columns.map(c => c.id === col.id ? { ...c, title: e.target.value } : c) });
                              }}
                              className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/20"
                            />
                            <select
                              value={col.key}
                              onChange={(e) => {
                                const tbl = selected as TableElement;
                                updateSelected({ columns: tbl.columns.map(c => c.id === col.id ? { ...c, key: e.target.value } : c) });
                              }}
                              className="h-8 w-[116px] flex-none cursor-pointer rounded-lg border border-white/10 bg-white/10 px-1.5 text-xs text-white outline-none"
                            >
                              {TABLE_COLUMN_KEYS.map(a => <option key={a.key} value={a.key} className="bg-[#1A1D24]">{t(a.labelKey)}</option>)}
                            </select>
                            <input
                              type="number"
                              value={col.widthRatio}
                              min={1}
                              max={100}
                              title={t('designer.widthPercent')}
                              onChange={(e) => {
                                const tbl = selected as TableElement;
                                updateSelected({ columns: tbl.columns.map(c => c.id === col.id ? { ...c, widthRatio: clamp(Number(e.target.value), 1, 100) } : c) });
                              }}
                              className="h-8 w-[46px] flex-none rounded-lg border border-white/10 bg-white/5 px-1 text-center text-xs text-white outline-none focus:border-white/20"
                            />
                            <button
                              onClick={() => {
                                const tbl = selected as TableElement;
                                updateSelected({ columns: tbl.columns.filter(c => c.id !== col.id) });
                              }}
                              title={t('designer.deleteColumn')}
                              className="flex-none p-1 text-red-400/50 transition-colors hover:text-red-400"
                            >
                              <Icon name="trash" className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Данные */}
                    <div className="flex flex-col gap-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{t('designer.data')}</span>
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                        <Field label={t('designer.grouping')}>
                          <CustomSelect
                            value={(selected as TableElement).groupBy}
                            onChange={(v) => updateSelected({ groupBy: v as any })}
                            options={[
                              { value: "none", label: t('designer.none') },
                              { value: "nomenclature", label: t('designer.byProduct') },
                              { value: "batch", label: t('designer.byBatch') },
                            ]}
                          />
                        </Field>
                        <Field label={t('designer.sorting')}>
                          <CustomSelect
                            value={(selected as TableElement).sortBy}
                            onChange={(v) => updateSelected({ sortBy: v as any })}
                            options={[
                              { value: "none", label: t('designer.none') },
                              { value: "name", label: t('designer.byName') },
                              { value: "date", label: t('designer.byDate') },
                            ]}
                          />
                        </Field>
                      </div>
                      <Field label={t('designer.maxRows')}>
                        <NumberInput
                          value={(selected as TableElement).maxRows || 0}
                          onChange={(v) => updateSelected({ maxRows: v > 0 ? v : undefined })}
                          min={0}
                          max={100}
                        />
                      </Field>
                    </div>

                    {/* Оформление */}
                    <div className="flex flex-col gap-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{t('designer.appearance')}</span>
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                        <Field label={t('designer.font')}>
                          <CustomSelect
                            value={(selected as TableElement).fontFamily || "Inter"}
                            onChange={(v) => updateSelected({ fontFamily: v })}
                            options={FONTS.map(f => ({ value: f, label: f }))}
                          />
                        </Field>
                        <Field label={t('designer.size')}>
                          <NumberInput
                            value={(selected as TableElement).fontSize}
                            onChange={(v) => updateSelected({ fontSize: v })}
                          />
                        </Field>
                      </div>
                      <div className="flex items-center gap-6 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
                          <input
                            type="checkbox"
                            checked={(selected as TableElement).showHeaders}
                            onChange={(e) => updateSelected({ showHeaders: e.target.checked })}
                          />
                          {t('designer.headers')}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
                          <input
                            type="checkbox"
                            checked={(selected as TableElement).showBorders}
                            onChange={(e) => updateSelected({ showBorders: e.target.checked })}
                          />
                          {t('designer.borders')}
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-xs text-white/30 italic">
                {t('designer.noElementSelected')}
              </div>
            )}
          </div>
        </div>
        )}

        {inspectorTab === "canvas" && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">{t('designer.canvasSettings')}</div>
          <div className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <Field label={t('designer.widthCm')}>
                <NumberInput
                  value={doc.canvas.widthCm ?? 10}
                  onChange={(v) => {
                    const px = cmToPx(v, doc.canvas.dpi);
                    setDoc(d => ({
                      ...d,
                      canvas: { ...d.canvas, widthCm: v, width: px }
                    }));
                  }}
                  step={0.1}
                />
              </Field>
              <Field label={t('designer.heightCm')}>
                <NumberInput
                  value={doc.canvas.heightCm ?? 6}
                  onChange={(v) => {
                    const px = cmToPx(v, doc.canvas.dpi);
                    setDoc(d => ({
                      ...d,
                      canvas: { ...d.canvas, heightCm: v, height: px }
                    }));
                  }}
                  step={0.1}
                />
              </Field>
            </div>

            <Field label={t('designer.labelTypeField')}>
              <select
                className="h-9 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white outline-none hover:bg-white/15 transition-all"
                value={doc.canvas.labelType || "pack"}
                onChange={(e) => {
                  const val = e.target.value as "pack" | "box" | "pallet";
                  setDoc(d => ({ ...d, canvas: { ...d.canvas, labelType: val } }));
                }}
              >
                <option value="pack" className="bg-[#1A1D24]">{t('designer.labelOnPackage')}</option>
                <option value="box" className="bg-[#1A1D24]">{t('designer.labelOnBox')}</option>
                <option value="pallet" className="bg-[#1A1D24]">{t('designer.palletSheet')}</option>
              </select>
            </Field>

            <Field label={t('designer.resolutionDpi')}>
              <NumberInput
                value={doc.canvas.dpi ?? DPI_203}
                onChange={(v) => {
                  setDoc(d => {
                    const width = cmToPx(d.canvas.widthCm || 10, v);
                    const height = cmToPx(d.canvas.heightCm || 6, v);
                    return {
                      ...d,
                      canvas: { ...d.canvas, dpi: v, width, height }
                    };
                  });
                }}
              />
            </Field>
            <Field label={t('designer.backgroundColor')}>
              <ColorInput
                value={doc.canvas.background}
                onChange={(v) => setDoc(d => ({ ...d, canvas: { ...d.canvas, background: v } }))}
              />
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">{t('designer.grid')}</span>
              <input
                type="checkbox"
                checked={doc.canvas.showGrid}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDoc(d => ({ ...d, canvas: { ...d.canvas, showGrid: e.target.checked } }))}
              />
            </div>
          </div>
        </div>

        )}

        {inspectorTab === "zones" && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <details className="group" open>
            <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-white list-none">
              <span>{t('designer.preprintedZones')}</span>
              <span className="text-white/50 transition-transform duration-200 group-open:rotate-90">▶</span>
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <SmallButton
                variant="secondary"
                onClick={() => {
                  const newZone: PrintedZone = {
                    id: uid(),
                    label: t('designer.zoneHeader'),
                    side: "top",
                    sizeMm: 10,
                    color: "#1e40af",
                  };
                  setDoc(d => ({
                    ...d,
                    canvas: {
                      ...d.canvas,
                      printedZones: [...d.canvas.printedZones, newZone],
                    },
                  }));
                }}
                className="w-full"
              >
                <Icon name="plus" />
                {t('designer.addZone')}
              </SmallButton>

              {doc.canvas.printedZones.map((zone, idx) => (
                <div
                  key={zone.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                      {t('designer.zoneN', { n: idx + 1 })}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDoc(d => ({
                          ...d,
                          canvas: {
                            ...d.canvas,
                            printedZones: d.canvas.printedZones.filter(z => z.id !== zone.id),
                          },
                        }));
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-white/30 hover:bg-red-500/20 hover:text-red-400 transition-all"
                      title={t('designer.delete')}
                    >
                      <Icon name="trash" className="h-3 w-3" />
                    </button>
                  </div>

                  <Field label={t('designer.name')}>
                    <TextInput
                      value={zone.label}
                      onChange={(v) => {
                        setDoc(d => ({
                          ...d,
                          canvas: {
                            ...d.canvas,
                            printedZones: d.canvas.printedZones.map(z =>
                              z.id === zone.id ? { ...z, label: v } : z
                            ),
                          },
                        }));
                      }}
                    />
                  </Field>

                  <Field label={t('designer.side')}>
                    <CustomSelect<string>
                      value={zone.side}
                      onChange={(v) => {
                        setDoc(d => ({
                          ...d,
                          canvas: {
                            ...d.canvas,
                            printedZones: d.canvas.printedZones.map(z =>
                              z.id === zone.id ? { ...z, side: v as PrintedZone["side"] } : z
                            ),
                          },
                        }));
                      }}
                      options={[
                        { value: "top", label: t('designer.sideTop') },
                        { value: "bottom", label: t('designer.sideBottom') },
                        { value: "left", label: t('designer.sideLeft') },
                        { value: "right", label: t('designer.sideRight') },
                      ]}
                    />
                  </Field>

                  <Field label={t('designer.thicknessMm')}>
                    <NumberInput
                      value={zone.sizeMm}
                      onChange={(v) => {
                        setDoc(d => ({
                          ...d,
                          canvas: {
                            ...d.canvas,
                            printedZones: d.canvas.printedZones.map(z =>
                              z.id === zone.id ? { ...z, sizeMm: Math.max(0, v) } : z
                            ),
                          },
                        }));
                      }}
                      min={0}
                      max={500}
                      step={0.5}
                    />
                  </Field>

                  <Field label={t('designer.color')}>
                    <ColorInput
                      value={zone.color}
                      onChange={(v) => {
                        setDoc(d => ({
                          ...d,
                          canvas: {
                            ...d.canvas,
                            printedZones: d.canvas.printedZones.map(z =>
                              z.id === zone.id ? { ...z, color: v } : z
                            ),
                          },
                        }));
                      }}
                    />
                  </Field>
                </div>
              ))}

              {doc.canvas.printedZones.length === 0 && (
                <div className="py-4 text-center text-xs text-white/30 italic">
                  {t('designer.noZonesDefined')}
                </div>
              )}
            </div>
          </details>
        </div>
        )}
      </aside >
      </div>
    </div >
  );
}
