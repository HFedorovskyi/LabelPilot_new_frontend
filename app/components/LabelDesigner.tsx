"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  color: string;
  fontWeight: 400 | 500 | 600 | 700;
};

type RectElement = LabelElementBase & {
  type: "rect";
  fill: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
};

type BarcodeElement = LabelElementBase & {
  type: "barcode";
  value: string;
};

type LabelElement = TextElement | RectElement | BarcodeElement;

type LabelDoc = {
  version: 1;
  canvas: {
    width: number;
    height: number;
    background: string;
    showGrid: boolean;
    gridSize: number;
  };
  elements: LabelElement[];
};

const STORAGE_KEY = "label_designer_doc_v1";

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
    | "reset";
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
        <svg viewBox="0 0 24 24" fill="none" className={cx(common, className)}>
          <path
            d="M4 4v6h6M20 20v-6h-6"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.5 14.5A7 7 0 0 0 19 9.5M18.5 9.5A7 7 0 0 0 5 14.5"
            className="stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function SmallButton({
  children,
  onClick,
  variant = "secondary",
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  title?: string;
  disabled?: boolean;
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
      className={cx(base, styles)}
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
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 cursor-pointer rounded-md bg-transparent"
      />
      <div className="text-xs text-white/70">{value.toUpperCase()}</div>
    </div>
  );
}

function defaultDoc(): LabelDoc {
  return {
    version: 1,
    canvas: {
      width: 640,
      height: 360,
      background: "#0B0F19",
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
        fill: "#111827",
        borderColor: "#334155",
        borderWidth: 2,
        borderRadius: 14,
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
        color: "#E5E7EB",
        fontWeight: 700,
      },
      {
        id: uid(),
        type: "barcode",
        x: 56,
        y: 112,
        w: 200,
        h: 56,
        rotation: 0,
        value: "4601234567890",
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
  const width = safeNumber(canvas.width, 640);
  const height = safeNumber(canvas.height, 360);

  const normalized: LabelDoc = {
    version: 1,
    canvas: {
      width: clamp(width, 120, 2000),
      height: clamp(height, 80, 2000),
      background: typeof canvas.background === "string" ? canvas.background : "#0B0F19",
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
          x: clamp(safeNumber(el.x, 0), -2000, 2000),
          y: clamp(safeNumber(el.y, 0), -2000, 2000),
          w: clamp(safeNumber(el.w, 120), 10, 3000),
          h: clamp(safeNumber(el.h, 40), 10, 3000),
          rotation: clamp(safeNumber(el.rotation, 0), -180, 180),
        };

        if (el.type === "text") {
          return {
            ...base,
            type: "text",
            text: typeof (el as Partial<TextElement>).text === "string" ? (el as Partial<TextElement>).text! : "Текст",
            fontSize: clamp(
              safeNumber((el as Partial<TextElement>).fontSize, 18),
              8,
              96
            ),
            color:
              typeof (el as Partial<TextElement>).color === "string"
                ? (el as Partial<TextElement>).color!
                : "#E5E7EB",
            fontWeight:
              (el as Partial<TextElement>).fontWeight === 400 ||
              (el as Partial<TextElement>).fontWeight === 500 ||
              (el as Partial<TextElement>).fontWeight === 600 ||
              (el as Partial<TextElement>).fontWeight === 700
                ? (el as Partial<TextElement>).fontWeight!
                : 600,
          } satisfies TextElement;
        }

        if (el.type === "rect") {
          return {
            ...base,
            type: "rect",
            fill:
              typeof (el as Partial<RectElement>).fill === "string"
                ? (el as Partial<RectElement>).fill!
                : "#111827",
            borderColor:
              typeof (el as Partial<RectElement>).borderColor === "string"
                ? (el as Partial<RectElement>).borderColor!
                : "#334155",
            borderWidth: clamp(
              safeNumber((el as Partial<RectElement>).borderWidth, 2),
              0,
              16
            ),
            borderRadius: clamp(
              safeNumber((el as Partial<RectElement>).borderRadius, 12),
              0,
              48
            ),
          } satisfies RectElement;
        }

        if (el.type === "barcode") {
          return {
            ...base,
            type: "barcode",
            value:
              typeof (el as Partial<BarcodeElement>).value === "string"
                ? (el as Partial<BarcodeElement>).value!
                : "0000000000000",
          } satisfies BarcodeElement;
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

  const selected = useMemo(
    () => doc.elements.find((e) => e.id === selectedId) ?? null,
    [doc.elements, selectedId]
  );

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    elementId: string;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    if (selectedId && !doc.elements.some((e) => e.id === selectedId)) {
      setSelectedId(doc.elements[doc.elements.length - 1]?.id ?? null);
    }
  }, [doc.elements, selectedId]);

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
      color: "#E5E7EB",
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
  }, []);

  const addBarcode = useCallback(() => {
    const el: BarcodeElement = {
      id: uid(),
      type: "barcode",
      x: 48,
      y: 240,
      w: 260,
      h: 64,
      rotation: 0,
      value: "123456789012",
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

        // elements later in array render on top; "up" => bring forward
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

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      const el = doc.elements.find((x) => x.id === elementId);
      if (!el) return;

      setSelectedId(elementId);

      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      dragRef.current = {
        active: true,
        elementId,
        offsetX: px - el.x,
        offsetY: py - el.y,
        startX: el.x,
        startY: el.y,
      };

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [doc.elements]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag?.active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const nextX = px - drag.offsetX;
    const nextY = py - drag.offsetY;

    setDoc((d) => ({
      ...d,
      elements: d.elements.map((el) =>
        el.id === drag.elementId
          ? ({
              ...el,
              x: Math.round(nextX),
              y: Math.round(nextY),
            } as LabelElement)
          : el
      ),
    }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
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

  const saveToLocal = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch {
      // ignore
    }
  }, [doc]);

  const loadFromLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      const v = validateDoc(parsed);
      if (!v) return;
      setDoc(v);
      setSelectedId(v.elements[v.elements.length - 1]?.id ?? null);
    } catch {
      // ignore
    }
  }, []);

  const resetDoc = useCallback(() => {
    const d = defaultDoc();
    setDoc(d);
    setSelectedId(d.elements[d.elements.length - 1]?.id ?? null);
  }, []);

  const copyJson = useCallback(async () => {
    const text = JSON.stringify(doc, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }, [doc]);

  const canvasStyle = useMemo(() => {
    const grid =
      doc.canvas.showGrid && doc.canvas.gridSize > 0
        ? {
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
            `,
            backgroundSize: `${doc.canvas.gridSize}px ${doc.canvas.gridSize}px`,
          }
        : {};
    return {
      width: `${doc.canvas.width}px`,
      height: `${doc.canvas.height}px`,
      backgroundColor: doc.canvas.background,
      ...grid,
    } as React.CSSProperties;
  }, [doc.canvas]);

  return (
    <div className="grid gap-4 md:grid-cols-12">
      {/* Left: tools + layers */}
      <aside className="md:col-span-3">
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
            <SmallButton variant="secondary" onClick={addBarcode}>
              <Icon name="barcode" />
              Штрихкод
            </SmallButton>

            <div className="my-2 h-px bg-white/10" />

            <div className="grid grid-cols-2 gap-2">
              <SmallButton variant="ghost" onClick={toggleGrid}>
                <Icon name="grid" />
                Сетка
              </SmallButton>
              <SmallButton variant="ghost" onClick={copyJson} title="Скопировать JSON макета">
                <Icon name="copy" />
                JSON
              </SmallButton>
              <SmallButton variant="ghost" onClick={saveToLocal} title="Сохранить в браузере">
                <Icon name="save" />
                Save
              </SmallButton>
              <SmallButton variant="ghost" onClick={loadFromLocal} title="Загрузить из браузера">
                <Icon name="load" />
                Load
              </SmallButton>
            </div>
          </div>
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

          <div className="mt-3 grid gap-2">
            {doc.elements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-3 text-xs text-white/60">
                Пока нет элементов. Добавьте текст/фигуру/штрихкод.
              </div>
            ) : (
              doc.elements
                .slice()
                .reverse()
                .map((el) => {
                  const isActive = el.id === selectedId;
                  const label =
                    el.type === "text"
                      ? `Текст: ${(el as TextElement).text.slice(0, 18)}`
                      : el.type === "rect"
                        ? "Прямоугольник"
                        : `Штрихкод: ${(el as BarcodeElement).value.slice(0, 18)}`;
                  return (
                    <button
                      key={el.id}
                      type="button"
                      onClick={() => setSelectedId(el.id)}
                      className={cx(
                        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-white/20",
                        isActive
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{label}</div>
                        <div className="text-xs text-white/55">
                          x:{Math.round(el.x)} y:{Math.round(el.y)} · {Math.round(el.w)}×
                          {Math.round(el.h)}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                        {el.type.toUpperCase()}
                      </div>
                    </button>
                  );
                })
            )}
          </div>
        </div>
      </aside>

      {/* Center: canvas */}
      <section className="md:col-span-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Холст</div>
              <div className="text-xs text-white/60">
                Перетаскивайте элементы мышью. Точные значения — справа.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                <span className="h-2 w-2 rounded-full bg-emerald-400/90" />
                {doc.canvas.width}×{doc.canvas.height}
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4">
            <div
              ref={canvasRef}
              className="relative select-none rounded-xl ring-1 ring-white/10"
              style={canvasStyle}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerDown={() => setSelectedId(null)}
            >
              {doc.elements.map((el) => {
                const isActive = el.id === selectedId;

                const baseStyle: React.CSSProperties = {
                  position: "absolute",
                  left: el.x,
                  top: el.y,
                  width: el.w,
                  height: el.h,
                  transform: `rotate(${el.rotation}deg)`,
                  transformOrigin: "top left",
                };

                const outline = isActive
                  ? "ring-2 ring-sky-400/70"
                  : "ring-1 ring-white/10 hover:ring-white/20";

                if (el.type === "rect") {
                  const r = el as RectElement;
                  return (
                    <div
                      key={el.id}
                      role="button"
                      tabIndex={0}
                      onPointerDown={(e) => onPointerDownElement(e, el.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(el.id);
                      }}
                      className={cx("cursor-move rounded-xl", outline)}
                      style={{
                        ...baseStyle,
                        background: r.fill,
                        borderColor: r.borderColor,
                        borderWidth: r.borderWidth,
                        borderStyle: "solid",
                        borderRadius: r.borderRadius,
                      }}
                    />
                  );
                }

                if (el.type === "text") {
                  const t = el as TextElement;
                  return (
                    <div
                      key={el.id}
                      role="button"
                      tabIndex={0}
                      onPointerDown={(e) => onPointerDownElement(e, el.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(el.id);
                      }}
                      className={cx(
                        "cursor-move overflow-hidden rounded-xl bg-white/0 p-2",
                        outline
                      )}
                      style={{
                        ...baseStyle,
                        color: t.color,
                        fontSize: t.fontSize,
                        fontWeight: t.fontWeight,
                        lineHeight: 1.1,
                      }}
                    >
                      {t.text}
                    </div>
                  );
                }

                const b = el as BarcodeElement;
                return (
                  <div
                    key={el.id}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(e) => onPointerDownElement(e, el.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(el.id);
                    }}
                    className={cx(
                      "cursor-move overflow-hidden rounded-xl bg-white/5 p-2",
                      outline
                    )}
                    style={baseStyle}
                  >
                    <div
                      className="h-[calc(100%-18px)] w-full rounded-lg border border-white/10"
                      style={{
                        background:
                          "repeating-linear-gradient(90deg, rgba(255,255,255,0.85) 0 2px, rgba(255,255,255,0) 2px 4px, rgba(255,255,255,0.65) 4px 5px, rgba(255,255,255,0) 5px 7px)",
                        opacity: 0.9,
                      }}
                    />
                    <div className="mt-1 text-center text-[11px] tracking-widest text-white/80">
                      {b.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Right: properties */}
      <aside className="md:col-span-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Свойства</div>
              <div className="text-xs text-white/60">
                {selected ? `Выбран: ${selected.type}` : "Выберите элемент на холсте"}
              </div>
            </div>
            <SmallButton
              variant="danger"
              disabled={!selected}
              onClick={deleteSelected}
              title="Удалить элемент"
            >
              <Icon name="trash" />
              Удалить
            </SmallButton>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="X">
                <NumberInput
                  value={selected ? Math.round(selected.x) : 0}
                  onChange={(v) => updateSelected({ x: v })}
                  step={1}
                />
              </Field>
              <Field label="Y">
                <NumberInput
                  value={selected ? Math.round(selected.y) : 0}
                  onChange={(v) => updateSelected({ y: v })}
                  step={1}
                />
              </Field>
              <Field label="W">
                <NumberInput
                  value={selected ? Math.round(selected.w) : 0}
                  onChange={(v) => updateSelected({ w: Math.max(10, v) })}
                  step={1}
                  min={10}
                />
              </Field>
              <Field label="H">
                <NumberInput
                  value={selected ? Math.round(selected.h) : 0}
                  onChange={(v) => updateSelected({ h: Math.max(10, v) })}
                  step={1}
                  min={10}
                />
              </Field>
            </div>

            <Field label="Rotation (deg)">
              <NumberInput
                value={selected ? Math.round(selected.rotation) : 0}
                onChange={(v) => updateSelected({ rotation: clamp(v, -180, 180) })}
                step={1}
                min={-180}
                max={180}
              />
            </Field>

            <div className="my-2 h-px bg-white/10" />

            {/* Type-specific */}
            {selected?.type === "text" ? (
              <div className="grid gap-3">
                <Field label="Текст">
                  <TextInput
                    value={selected.text}
                    onChange={(v) => updateSelected({ text: v })}
                    placeholder="Введите текст"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Размер">
                    <NumberInput
                      value={selected.fontSize}
                      onChange={(v) =>
                        updateSelected({ fontSize: clamp(Math.round(v), 8, 96) })
                      }
                      min={8}
                      max={96}
                      step={1}
                    />
                  </Field>
                  <Field label="Насыщенность">
                    <select
                      value={String(selected.fontWeight)}
                      onChange={(e) =>
                        updateSelected({
                          fontWeight: Number(e.target.value) as TextElement["fontWeight"],
                        })
                      }
                      className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20 focus:bg-white/10"
                    >
                      <option value="400">400</option>
                      <option value="500">500</option>
                      <option value="600">600</option>
                      <option value="700">700</option>
                    </select>
                  </Field>
                </div>

                <Field label="Цвет">
                  <ColorInput
                    value={selected.color}
                    onChange={(v) => updateSelected({ color: v })}
                  />
                </Field>
              </div>
            ) : null}

            {selected?.type === "rect" ? (
              <div className="grid gap-3">
                <Field label="Заливка">
                  <ColorInput
                    value={selected.fill}
                    onChange={(v) => updateSelected({ fill: v })}
                  />
                </Field>

                <Field label="Цвет рамки">
                  <ColorInput
                    value={selected.borderColor}
                    onChange={(v) => updateSelected({ borderColor: v })}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Толщина">
                    <NumberInput
                      value={selected.borderWidth}
                      onChange={(v) =>
                        updateSelected({ borderWidth: clamp(Math.round(v), 0, 16) })
                      }
                      min={0}
                      max={16}
                      step={1}
                    />
                  </Field>
                  <Field label="Скругление">
                    <NumberInput
                      value={selected.borderRadius}
                      onChange={(v) =>
                        updateSelected({ borderRadius: clamp(Math.round(v), 0, 48) })
                      }
                      min={0}
                      max={48}
                      step={1}
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {selected?.type === "barcode" ? (
              <div className="grid gap-3">
                <Field label="Значение">
                  <TextInput
                    value={selected.value}
                    onChange={(v) => updateSelected({ value: v })}
                    placeholder="Напр. 4601234567890"
                  />
                </Field>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                  На этом шаге штрихкод — визуальная заглушка. Генерацию реальных
                  форматов (EAN/Code128 и т.п.) добавим позже.
                </div>
              </div>
            ) : null}

            {!selected ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-3 text-xs text-white/60">
                Кликните по элементу на холсте, чтобы редактировать свойства.
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">Параметры холста</div>
          <div className="mt-3 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ширина">
                <NumberInput
                  value={doc.canvas.width}
                  onChange={(v) =>
                    setDoc((d) => ({
                      ...d,
                      canvas: { ...d.canvas, width: clamp(Math.round(v), 120, 2000) },
                    }))
                  }
                  min={120}
                  max={2000}
                />
              </Field>
              <Field label="Высота">
                <NumberInput
                  value={doc.canvas.height}
                  onChange={(v) =>
                    setDoc((d) => ({
                      ...d,
                      canvas: { ...d.canvas, height: clamp(Math.round(v), 80, 2000) },
                    }))
                  }
                  min={80}
                  max={2000}
                />
              </Field>
            </div>

            <Field label="Фон">
              <ColorInput
                value={doc.canvas.background}
                onChange={(v) =>
                  setDoc((d) => ({ ...d, canvas: { ...d.canvas, background: v } }))
                }
              />
            </Field>

            <Field label="Размер сетки">
              <NumberInput
                value={doc.canvas.gridSize}
                onChange={(v) =>
                  setDoc((d) => ({
                    ...d,
                    canvas: { ...d.canvas, gridSize: clamp(Math.round(v), 4, 64) },
                  }))
                }
                min={4}
                max={64}
              />
            </Field>
          </div>
        </div>
      </aside>
    </div>
  );
}
