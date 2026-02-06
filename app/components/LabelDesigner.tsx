"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api as client } from "@/lib/api/client";

type ElementType = "text" | "rect" | "barcode";

type LabelElementBase = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // deg
};

type TextElement = LabelElementBase & {
  type: "text";
  text: string;
  fontSize: number;
  fontWeight: number;
  color: string;
}

export interface RectElement extends LabelElementBase {
  type: "rect";
  fill: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
}

// BarcodeType now comes from database templates as string
export type BarcodeType = string;

export interface BarcodeElement extends LabelElementBase {
  type: "barcode";
  value: string;
  barcodeType: string; // Using string to support arbitrary template names
  showText: boolean;
  templateId?: number;
  imageData?: string; // base64 PNG
  error?: string; // Error message from backend
}

export type LabelElement = TextElement | RectElement | BarcodeElement;

// Значения по умолчанию когда номенклатура не выбрана
const DEFAULT_PREVIEW_DATA: Record<string, string> = {
  name: "Пример товара",
  article: "ART-00000",
  exp_date: "30",
  close_box_counter: "10",
};

// Фиксированные атрибуты модели Nomenclature
const FIXED_PRODUCT_ATTRIBUTES = [
  { key: "name", label: "Наименование" },
  { key: "article", label: "Артикул" },
  { key: "exp_date", label: "Срок годности (сут)" },
  { key: "close_box_counter", label: "Вложений в короб" },
] as const;

export interface CanvasConfig {
  width: number;
  height: number;
  widthCm: number;
  heightCm: number;
  dpi: number;
  background: string;
  showGrid: boolean;
  gridSize: number;
}

type LabelDoc = {
  version: 1;
  canvas: CanvasConfig;
  elements: LabelElement[];
};

const STORAGE_KEY = "label_designer_doc_v1";

const DPI_203 = 203;
const CM_TO_INCH = 1 / 2.54;

function cmToPx(cm: number, dpi: number = DPI_203) {
  return Math.round(cm * CM_TO_INCH * dpi);
}

function pxToCm(px: number, dpi: number = DPI_203) {
  return Number((px / dpi / CM_TO_INCH).toFixed(2));
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
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

function processDynamicText(text: string, data: Record<string, string>) {
  return text.replace(/{{\s*([^{}]+)\s*}}/g, (match, key) => {
    return data[key.trim()] || match;
  });
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
  | "minus";
  className?: string;
}) {
  const common = "h-4 w-4";
  switch (name) {
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
    <label className="grid gap-1">
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
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20 focus:bg-white/10"
    />
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
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20 focus:bg-white/10"
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
        onChange={(e) => onChange(e.target.value)}
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
    },
    elements: [
      {
        id: uid(),
        type: "rect",
        x: 32,
        y: 32,
        w: 280,
        h: 120,
        rotation: 0,
        fill: "transparent",
        borderColor: "#000000",
        borderWidth: 2,
        borderRadius: 0,
      },
      {
        id: uid(),
        type: "text",
        x: 56,
        y: 56,
        w: 240,
        h: 48,
        rotation: 0,
        text: "Пример этикетки",
        fontSize: 20,
        color: "#000000",
        fontWeight: 700,
      },
    ],
  };
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
          return {
            ...base,
            type: "text",
            text: typeof t.text === "string" ? t.text : "Текст",
            fontSize: clamp(safeNumber(t.fontSize, 14), 4, 200),
            color: typeof t.color === "string" ? t.color : "#000000",
            fontWeight: [400, 500, 600, 700].includes(Number(t.fontWeight))
              ? (Number(t.fontWeight) as TextElement["fontWeight"])
              : 600,
          } satisfies TextElement;
        }

        if (el.type === "rect") {
          const r = el as Partial<RectElement>;
          return {
            ...base,
            type: "rect",
            fill: typeof r.fill === "string" ? r.fill : "transparent",
            borderColor: typeof r.borderColor === "string" ? r.borderColor : "#000000",
            borderWidth: clamp(safeNumber(r.borderWidth, 1), 0, 50),
            borderRadius: clamp(safeNumber(r.borderRadius, 0), 0, 500),
          } satisfies RectElement;
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

        return null;
      })
      .filter((x): x is LabelElement => Boolean(x)),
  };

  return normalized;
}



export default function LabelDesigner() {
  const [doc, setDoc] = useState<LabelDoc>(() => defaultDoc());
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    doc.elements[doc.elements.length - 1]?.id ?? null
  );

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);
  // Nomenclature selection state
  const [nomenclatures, setNomenclatures] = useState<any[]>([]);
  const [globalAttributes, setGlobalAttributes] = useState<any[]>([]);
  const [selectedNomenclatureId, setSelectedNomenclatureId] = useState<string>("");
  const [previewData, setPreviewData] = useState<Record<string, string>>(DEFAULT_PREVIEW_DATA);
  const [barcodeTemplates, setBarcodeTemplates] = useState<any[]>([]);

  const generateBarcodeImage = useCallback(async (template: any, elementId: string) => {
    try {
      console.log(`Generating barcode for ${elementId} with template ${template.name}`, template.structure);
      const response = await client.barcodes.generate(template.structure);
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
  }, []);

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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);

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

  const updatePreviewData = (item: any) => {
    const data: Record<string, string> = {
      name: item.name || "",
      article: item.article || "",
      exp_date: String(item.exp_date || ""),
      close_box_counter: String(item.close_box_counter || ""),
    };

    if (item.extra_data) {
      Object.entries(item.extra_data).forEach(([k, v]) => {
        data[k] = String(v);
      });
    }
    setPreviewData(data);
  };

  const handleNomenclatureSelect = (id: string) => {
    setSelectedNomenclatureId(id);
    localStorage.setItem("labelDesigner_selectedNomenclatureId", id);

    const item = nomenclatures.find(n => n.id.toString() === id);

    if (!item) {
      setPreviewData(DEFAULT_PREVIEW_DATA);
      return;
    }

    updatePreviewData(item);
  };

  const allAttributes = useMemo(() => {
    const dynamic = globalAttributes.map((a: any) => ({
      key: a.name,
      label: a.name,
      icon: "✨"
    }));
    return [
      { key: "name", label: "Наименование", icon: "📦" },
      { key: "article", label: "Артикул", icon: "🏷️" },
      { key: "exp_date", label: "Срок годности", icon: "⏳" },
      { key: "close_box_counter", label: "Вложений", icon: "🔢" },
      ...dynamic
    ];
  }, [globalAttributes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) setIsAltPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) setIsAltPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

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
  }, []);

  const onPointerDownViewport = useCallback((e: React.PointerEvent) => {
    // Ctrl+Left click, Alt+Left click, or Middle mouse for panning
    if (e.ctrlKey || isAltPressed || e.button === 1) {
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
  }, [isAltPressed, pan]);

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
    onPointerMove(e);
  }, [pan]);

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
  }, []);

  useEffect(() => {
    if (selectedId && !doc.elements.some((e) => e.id === selectedId)) {
      setSelectedId(doc.elements[doc.elements.length - 1]?.id ?? null);
    }
  }, [doc.elements, selectedId]);

  // New state for API integration
  const [labelId, setLabelId] = useState<number | null>(null);
  const [labelName, setLabelName] = useState<string>("Новый макет");
  const [savedLabels, setSavedLabels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

    const el: BarcodeElement = {
      id: uid(),
      type: "barcode",
      x: 48,
      y: 240,
      w: 260,
      h: 80,
      rotation: 0,
      value: "{{ barcode }}",
      barcodeType: template.name,
      showText: true,
      templateId: template.id,
    };

    setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);

    // Immediately fetch image
    await generateBarcodeImage(template, el.id);
  }, [barcodeTemplates, generateBarcodeImage]);

  const addAttribute = useCallback((attributeKey: string, label: string) => {
    const el: TextElement = {
      id: uid(),
      type: "text",
      x: 40,
      y: 40,
      w: 260,
      h: 36,
      rotation: 0,
      text: `{{${attributeKey}}}`,
      fontSize: 14,
      color: "#000000",
      fontWeight: 500,
    };
    setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }, []);

  const updateSelected = useCallback(
    (patch: Partial<LabelElement>) => {
      if (!selectedId) return;
      setDoc((d) => ({
        ...d,
        elements: d.elements.map((e) =>
          e.id === selectedId ? ({ ...e, ...patch } as LabelElement) : e
        ),
      }));
    },
    [selectedId]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setDoc((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== selectedId) }));
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
        newW = Math.max(1, el.w + localDelta.x);
      }
      if (handle.includes("w")) {
        const d = Math.min(el.w - 1, localDelta.x); // changed max(1) logic slightly
        // we need actual delta applied.
        const actualD = Math.min(d, el.w - 1);
        // actually simpler: just compute new width
        newW = Math.max(1, el.w - localDelta.x);

        if (newW !== el.w) {
          // If we changed width from left, we must shift center/pos
          const shiftLocal = { x: localDelta.x, y: 0 };
          // Use exact logic:
          // visual right edge = x + w (rotated).
          // if we move left edge by dx, new x = x + dx (rotated). new w = w - dx.
          // localDelta.x is positive moving right.

          // Let's rely on simple shift:
          const shiftWorld = rotatePoint(localDelta.x, 0, el.rotation);
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

      setDoc((d) => ({
        ...d,
        elements: d.elements.map((curr) =>
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
        alert("Макет обновлен!");
      } else {
        const name = window.prompt("Введите название макета:", labelName);
        if (!name) {
          setIsLoading(false);
          return;
        }
        setLabelName(name);
        payload.name = name;
        const created = await client.labels.create(payload);
        setLabelId(created.id);
        alert("Макет сохранен!");
      }
      loadLabelsList();
    } catch (e) {
      console.error(e);
      alert("Ошибка при сохранении");
    } finally {
      setIsLoading(false);
    }
  }, [doc, labelId, labelName]);

  const loadLabelEntry = useCallback((label: any) => {
    if (!confirm("Загрузить макет? Несохраненные изменения текущего макета будут потеряны.")) return;
    try {
      const v = validateDoc(label.scheme);
      if (v) {
        setDoc(v);
        setLabelId(label.id);
        setLabelName(label.name);
        setSelectedId(null);
      } else {
        alert("Ошибка: некорректный формат данных макета");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка при загрузке");
    }
  }, []);

  const resetDoc = useCallback(() => {
    if (!confirm("Сбросить текущий макет?")) return;
    const d = defaultDoc();
    setDoc(d);
    setLabelId(null);
    setLabelName("Новый макет");
    setSelectedId(d.elements[d.elements.length - 1]?.id ?? null);
  }, []);

  // ... (copyJson, canvasStyle) ...


  const copyJson = useCallback(async () => {
    const text = JSON.stringify(doc, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }, [doc]);

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

  return (
    <div className="grid h-[calc(100vh-140px)] gap-4 md:grid-cols-12 overflow-hidden">
      {/* Left: tools + layers */}
      <aside className="md:col-span-3 h-full overflow-y-auto pr-2 custom-scrollbar">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white">Инструменты</div>
            <SmallButton variant="ghost" onClick={resetDoc} title="Сбросить макет">
              <Icon name="reset" />
            </SmallButton>
          </div>

          <div className="mt-3 grid gap-2">
            <SmallButton variant="secondary" onClick={addText}>
              <Icon name="text" />
              Текст
            </SmallButton>
            <SmallButton variant="secondary" onClick={addRect}>
              <Icon name="rect" />
              Прямоугольник
            </SmallButton>
            {/* Barcode dropdown - styled dark */}
            {barcodeTemplates.length > 0 ? (
              <div className="relative group">
                <select
                  className="w-full h-9 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white outline-none cursor-pointer hover:bg-white/15 transition-all appearance-none"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addBarcode(e.target.value);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="" disabled className="bg-[#1A1D24]">➕ Добавить штрихкод...</option>
                  {barcodeTemplates.map((t: any) => (
                    <option key={t.id} value={t.name} className="bg-[#1A1D24]">{t.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                  <Icon name="chevron-down" className="h-3 w-3" />
                </div>
              </div>
            ) : (
              <SmallButton variant="secondary" disabled title="Нет шаблонов штрихкодов" className="w-full">
                <Icon name="barcode" />
                Штрихкод
              </SmallButton>
            )}

            <div className="my-2 h-px bg-white/10" />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="relative col-span-2">
                <select
                  className="w-full h-9 rounded-xl border border-white/10 bg-white/10 pl-10 pr-8 py-2 text-xs font-medium text-white outline-none cursor-pointer hover:bg-white/15 transition-all appearance-none"
                  value={selectedNomenclatureId}
                  onChange={(e) => handleNomenclatureSelect(e.target.value)}
                >
                  <option value="" className="bg-[#1A1D24]">📦 Выберите товар...</option>
                  {nomenclatures.map((n) => (
                    <option key={n.id} value={n.id} className="bg-[#1A1D24]">
                      {n.article} - {n.name}
                    </option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                  <Icon name="box" />
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                  <Icon name="chevron-down" className="h-3 w-3" />
                </div>
              </div>

              <div className="col-span-1">
                <SmallButton
                  variant={doc.canvas.showGrid ? "primary" : "ghost"}
                  onClick={toggleGrid}
                  className="w-full"
                >
                  <Icon name="grid" />
                  Сетка
                </SmallButton>
              </div>

              <div className="col-span-1">
                <SmallButton variant="ghost" onClick={copyJson} title="Скопировать JSON" className="w-full">
                  <Icon name="copy" />
                  JSON
                </SmallButton>
              </div>

              <div className="relative col-span-1">
                <select
                  className="w-full h-9 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white outline-none cursor-pointer hover:bg-white/15 transition-all appearance-none"
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const id = Number(e.target.value);
                    const l = savedLabels.find((x: any) => x.id === id);
                    if (l) loadLabelEntry(l);
                    e.target.value = "";
                  }}
                  defaultValue=""
                >
                  <option value="" disabled className="bg-[#1A1D24]">📂 Загрузить...</option>
                  {savedLabels.map((l: any) => <option key={l.id} value={l.id} className="bg-[#1A1D24]">{l.name}</option>)}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                  <Icon name="chevron-down" className="h-3 w-3" />
                </div>
              </div>

              <div className="col-span-1">
                <SmallButton variant="primary" onClick={saveToApi} title="Сохранить" disabled={isLoading} className="w-full">
                  <Icon name="save" />
                  Save
                </SmallButton>
              </div>
            </div>
          </div>
        </div>

        {/* Product Attributes Section */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <details className="group" open>
            <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-white list-none">
              <span>Атрибуты товара</span>
              <span className="text-white/50 transition-transform duration-200 group-open:rotate-90">▶</span>
            </summary>
            <div className="mt-3 grid gap-1 max-h-64 overflow-y-auto custom-scrollbar">
              {allAttributes.map((attr) => (
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
          </details>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Слои</div>
            <div className="flex items-center gap-1">
              <SmallButton
                variant="ghost"
                onClick={() => moveLayer("down")}
                disabled={!selectedId}
                title="Назад"
              >
                <Icon name="down" />
              </SmallButton>
              <SmallButton
                variant="ghost"
                onClick={() => moveLayer("up")}
                disabled={!selectedId}
                title="Вперёд"
              >
                <Icon name="up" />
              </SmallButton>
            </div>
          </div>

          <div className="my-4 h-px bg-white/10" />

          <div className="mt-3 grid gap-1">
            {doc.elements.map((el: LabelElement, i: number) => (
              <button
                key={el.id}
                onClick={() => setSelectedId(el.id)}
                className={cx(
                  "flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all",
                  selectedId === el.id
                    ? "border-blue-500/50 bg-blue-500/10 text-white"
                    : "border-transparent text-white/60 hover:bg-white/5"
                )}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded bg-white/5 text-[10px] font-bold">
                  {i + 1}
                </div>
                <div className="grow truncate text-xs font-medium">
                  {el.type === "text" ? (el as TextElement).text : el.type}
                </div>
                <Icon name={el.type as any} className="opacity-40" />
              </button>
            ))}
            {doc.elements.length === 0 && (
              <div className="py-8 text-center text-xs text-white/30 italic">
                Нет элементов
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Center: Infinite Canvas */}
      <main
        ref={mainRef}
        className={cx(
          "md:col-span-6 relative flex items-center justify-center bg-white overflow-hidden rounded-2xl border border-slate-200 shadow-inner",
          isPanning && "cursor-grabbing"
        )}
        onPointerDown={onPointerDownViewport}
        onPointerMove={onPointerMoveViewport}
        onPointerUp={onPointerUpViewport}
      >
        {/* Workspace Info */}
        <div className="absolute top-4 left-4 z-10 flex cursor-default items-center gap-3 rounded-xl border border-slate-200 bg-white/80 p-2 px-3 text-xs font-medium text-slate-600 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Масштаб:</span>
            <span className="text-slate-900 font-bold">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-slate-400">Размер:</span>
            <span className="text-slate-900 font-bold">
              {doc.canvas.widthCm}x{doc.canvas.heightCm} см
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



              if (el.type === "text") {
                const t = el as TextElement;
                const displayText = processDynamicText(t.text, previewData);
                return (
                  <div key={el.id} {...commonProps}>
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        fontSize: `${t.fontSize}px`,
                        color: t.color,
                        fontWeight: t.fontWeight,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        overflow: "hidden",
                        wordBreak: "break-word",
                        lineHeight: 1.1,
                      }}
                    >
                      {displayText}
                    </div>
                    {handles}
                  </div>
                );
              }

              if (el.type === "barcode") {
                const b = el as BarcodeElement;
                return (
                  <div key={el.id} {...commonProps}>
                    <div className="flex h-full flex-col items-center justify-center bg-white overflow-hidden rounded-sm">
                      {b.imageData ? (
                        <img
                          src={`data:image/png;base64,${b.imageData}`}
                          alt="barcode"
                          className="max-w-full max-h-full object-contain select-none"
                          draggable={false}
                        />
                      ) : b.error ? (
                        <div className="grow flex items-center justify-center text-red-500 font-mono text-[9px] border border-red-500/20 bg-red-500/5 px-2 text-center uppercase break-words overflow-hidden leading-tight">
                          Error: {b.error}
                        </div>
                      ) : (
                        <div className="grow flex items-center justify-center text-black font-mono text-[10px] border border-black/10 px-2 uppercase italic opacity-60">
                          [{b.barcodeType}]
                        </div>
                      )}
                    </div>
                    {handles}
                  </div>
                );
              }

              if (el.type === "rect") {
                const r = el as RectElement;
                return (
                  <div key={el.id} {...commonProps}>
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: r.fill,
                        border: `${r.borderWidth}px solid ${r.borderColor}`,
                        borderRadius: `${r.borderRadius}px`,
                      }}
                    />
                    {handles}
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>

        {/* Zoom Controls Overlay */}
        <div className="absolute bottom-4 right-4 z-10 flex gap-1 rounded-xl border border-white/10 bg-black/40 p-1 backdrop-blur-md">
          <SmallButton
            variant="ghost"
            onClick={() => setZoom((z: number) => Math.max(0.2, z - 0.1))}
            title="Отдалить"
          >
            <Icon name="minus" className="h-4 w-4" />
          </SmallButton>
          <div className="flex items-center px-2 text-[10px] font-bold text-white min-w-[40px] justify-center">
            {Math.round(zoom * 100)}%
          </div>
          <SmallButton
            variant="ghost"
            onClick={() => setZoom((z: number) => Math.min(5, z + 0.1))}
            title="Приблизить"
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
            title="Сбросить"
          >
            Reset
          </SmallButton>
        </div>
      </main>

      {/* Right: properties */}
      <aside className="md:col-span-3 h-full overflow-y-auto pl-2 custom-scrollbar">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Свойства</div>
              <div className="text-xs text-white/60">
                {selected ? `Выбран: ${selected.type}` : "Выберите элемент"}
              </div>
            </div>
            <SmallButton
              variant="danger"
              disabled={!selected}
              onClick={deleteSelected}
              title="Удалить"
            >
              <Icon name="trash" />
            </SmallButton>
          </div>

          <div className="mt-4 grid gap-3">
            {selected ? (
              <>
                <div className="grid grid-cols-2 gap-3">
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
                <Field label="Угол поворота (°)">
                  <NumberInput
                    value={Math.round(selected.rotation)}
                    onChange={(v) => updateSelected({ rotation: v })}
                    min={-360}
                    max={360}
                  />
                </Field>

                <div className="my-2 h-px bg-white/10" />

                {selected.type === "text" && (
                  <div className="grid gap-3">
                    <Field label="Текст">
                      <TextInput
                        value={(selected as TextElement).text}
                        onChange={(v) => updateSelected({ text: v })}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Размер шрифта">
                        <NumberInput
                          value={(selected as TextElement).fontSize}
                          onChange={(v) => updateSelected({ fontSize: v })}
                        />
                      </Field>
                      <Field label="Вес">
                        <select
                          value={(selected as TextElement).fontWeight}
                          onChange={(e) => updateSelected({ fontWeight: Number(e.target.value) })}
                          className="h-10 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-xs text-white outline-none hover:bg-white/15 transition-colors"
                        >
                          <option value="400">Regular</option>
                          <option value="600">SemiBold</option>
                          <option value="700">Bold</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Цвет">
                      <ColorInput
                        value={(selected as TextElement).color}
                        onChange={(v) => updateSelected({ color: v })}
                      />
                    </Field>
                  </div>
                )}

                {selected.type === "rect" && (
                  <div className="grid gap-3">
                    <Field label="Фон">
                      <ColorInput
                        value={(selected as RectElement).fill}
                        onChange={(v) => updateSelected({ fill: v })}
                      />
                    </Field>
                    <Field label="Цвет рамки">
                      <ColorInput
                        value={(selected as RectElement).borderColor}
                        onChange={(v) => updateSelected({ borderColor: v })}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Толщина">
                        <NumberInput
                          value={(selected as RectElement).borderWidth}
                          onChange={(v) => updateSelected({ borderWidth: v })}
                        />
                      </Field>
                      <Field label="Скругление">
                        <NumberInput
                          value={(selected as RectElement).borderRadius}
                          onChange={(v) => updateSelected({ borderRadius: v })}
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {selected.type === "barcode" && (
                  <div className="grid gap-3">
                    <Field label="Тип штрихкода">
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
                    <Field label="Значение (поддерживает {{ плейсхолдеры }})">
                      <TextInput
                        value={(selected as BarcodeElement).value}
                        onChange={(v) => updateSelected({ value: v })}
                      />
                    </Field>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/60">Показывать текст</span>
                      <input
                        type="checkbox"
                        checked={(selected as BarcodeElement).showText}
                        onChange={(e) => updateSelected({ showText: e.target.checked })}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-xs text-white/30 italic">
                Элемент не выбран
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">Настройки холста</div>
          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ширина (см)">
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
              <Field label="Высота (см)">
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
            <Field label="Разрешение (DPI)">
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
            <Field label="Цвет фона">
              <ColorInput
                value={doc.canvas.background}
                onChange={(v) => setDoc(d => ({ ...d, canvas: { ...d.canvas, background: v } }))}
              />
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">Сетка</span>
              <input
                type="checkbox"
                checked={doc.canvas.showGrid}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDoc(d => ({ ...d, canvas: { ...d.canvas, showGrid: e.target.checked } }))}
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
