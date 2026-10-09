import { describe, it, expect } from 'vitest';
import {
  cmToPx,
  pxToCm,
  mmToPx,
  clamp,
  isFiniteNumber,
  safeNumber,
  formatDate,
  uid,
  DPI_203,
  CM_TO_INCH,
} from '../helpers';

describe('cmToPx', () => {
  it('converts 10cm at 203 DPI', () => {
    // 10 * (1/2.54) * 203 ≈ 799.2 → 799
    expect(cmToPx(10)).toBe(799);
  });

  it('converts 1cm at 203 DPI', () => {
    expect(cmToPx(1)).toBe(Math.round(1 * CM_TO_INCH * DPI_203));
  });

  it('converts 0cm', () => {
    expect(cmToPx(0)).toBe(0);
  });

  it('uses custom DPI', () => {
    // 10cm at 300 DPI: 10 / 2.54 * 300 ≈ 1181
    expect(cmToPx(10, 300)).toBe(Math.round(10 * CM_TO_INCH * 300));
  });

  it('handles decimal cm', () => {
    expect(cmToPx(5.5)).toBe(Math.round(5.5 * CM_TO_INCH * DPI_203));
  });
});

describe('pxToCm', () => {
  it('is inverse of cmToPx (approximately)', () => {
    const cm = 10;
    const px = cmToPx(cm);
    // Rounding causes tiny drift, but should be within 0.02
    expect(pxToCm(px)).toBeCloseTo(cm, 1);
  });

  it('converts 0px', () => {
    expect(pxToCm(0)).toBe(0);
  });

  it('uses custom DPI', () => {
    const cm = 5;
    const px = cmToPx(cm, 300);
    expect(pxToCm(px, 300)).toBeCloseTo(cm, 1);
  });
});

describe('mmToPx', () => {
  it('converts 25.4mm to DPI value (1 inch)', () => {
    expect(mmToPx(25.4, 203)).toBe(203);
  });

  it('converts 10mm at 203 DPI', () => {
    expect(mmToPx(10)).toBe(Math.round(10 * 203 / 25.4));
  });

  it('converts 0mm', () => {
    expect(mmToPx(0)).toBe(0);
  });
});

describe('clamp', () => {
  it('returns value when in range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('handles min === max', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it('handles negative range', () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
  });

  it('clamps exactly at boundary', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('isFiniteNumber', () => {
  it('true for normal numbers', () => {
    expect(isFiniteNumber(42)).toBe(true);
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-3.14)).toBe(true);
  });

  it('false for NaN', () => {
    expect(isFiniteNumber(NaN)).toBe(false);
  });

  it('false for Infinity', () => {
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
  });

  it('false for non-numbers', () => {
    expect(isFiniteNumber("42")).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
    expect(isFiniteNumber({})).toBe(false);
  });
});

describe('safeNumber', () => {
  it('returns value if finite number', () => {
    expect(safeNumber(42, 0)).toBe(42);
  });

  it('returns fallback for NaN', () => {
    expect(safeNumber(NaN, 99)).toBe(99);
  });

  it('returns fallback for undefined', () => {
    expect(safeNumber(undefined, 10)).toBe(10);
  });

  it('returns fallback for string', () => {
    expect(safeNumber("hello", 5)).toBe(5);
  });
});

describe('formatDate', () => {
  it('formats date as DD.MM.YYYY', () => {
    const d = new Date(2024, 0, 15); // Jan 15, 2024
    expect(formatDate(d)).toBe('15.01.2024');
  });

  it('pads single-digit day and month', () => {
    const d = new Date(2024, 2, 5); // Mar 5, 2024
    expect(formatDate(d)).toBe('05.03.2024');
  });

  it('handles Dec 31', () => {
    const d = new Date(2025, 11, 31);
    expect(formatDate(d)).toBe('31.12.2025');
  });
});

describe('uid', () => {
  it('returns a non-empty string', () => {
    const id = uid();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });

  it('contains underscore separator', () => {
    expect(uid()).toMatch(/_/);
  });
});
