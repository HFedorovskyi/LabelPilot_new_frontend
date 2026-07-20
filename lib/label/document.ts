/**
 * Label document creation and validation.
 * Extracted from LabelDesigner.tsx for reuse and testability.
 */

import {
  LabelDoc,
  LabelElement,
  LabelElementBase,
  TextElement,
  RectElement,
  BarcodeElement,
  TableElement,
  PrintedZone,
  ElementType,
  BarcodeType,
} from "./types";
import { cmToPx, clamp, safeNumber, uid, DPI_203 } from "./helpers";

/** Creates a default empty label document */
export function defaultDoc(): LabelDoc {
  return {
    version: 1,
    canvas: {
      width: cmToPx(10),
      height: cmToPx(6),
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

/** Validate and normalize a raw object into a LabelDoc, or return null */
export function validateDoc(input: unknown): LabelDoc | null {
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
