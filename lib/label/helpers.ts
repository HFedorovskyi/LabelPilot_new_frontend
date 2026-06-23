/**
 * Pure utility functions for the Label Designer module.
 * Extracted from LabelDesigner.tsx for reuse and testability.
 */

export const DPI_203 = 203;
export const CM_TO_INCH = 1 / 2.54;

/** Convert centimeters to pixels at given DPI */
export function cmToPx(cm: number, dpi: number = DPI_203): number {
  return Math.round(cm * CM_TO_INCH * dpi);
}

/** Convert pixels to centimeters at given DPI */
export function pxToCm(px: number, dpi: number = DPI_203): number {
  return Number((px / dpi / CM_TO_INCH).toFixed(2));
}

/** Convert millimeters to pixels at given DPI */
export function mmToPx(mm: number, dpi: number = DPI_203): number {
  return Math.round(mm * dpi / 25.4);
}

/** Clamp a number to [min, max] */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Type guard: checks that value is a finite number */
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Return value if it's a finite number, otherwise return fallback */
export function safeNumber(v: unknown, fallback: number): number {
  return isFiniteNumber(v) ? v : fallback;
}

/** Format a Date as DD.MM.YYYY */
export function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

/** Generate a unique id string */
export function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
