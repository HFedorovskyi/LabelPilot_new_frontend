import { describe, it, expect } from 'vitest';
import { euCheck, fieldKeys, isEuChecked, keySatisfies, textSize, xHeightMm } from '../eu';
import { cmToPx, DPI_203 } from '../helpers';
import type { LabelDoc, TextElement } from '../types';

const PT_MM = 25.4 / 72;

function label(widthMm: number, heightMm: number, texts: Array<[string, number]>, type: 'pack' | 'box' | 'pallet' = 'pack'): LabelDoc {
  const widthCm = widthMm / 10;
  const heightCm = heightMm / 10;
  const ppm = DPI_203 / 25.4;
  return {
    version: 1,
    canvas: {
      width: cmToPx(widthCm), height: cmToPx(heightCm), widthCm, heightCm, dpi: DPI_203,
      background: '#ffffff', showGrid: false, gridSize: 16, labelType: type, printedZones: [],
    },
    elements: texts.map(([text, pt], i): TextElement => ({
      id: `t${i}`, type: 'text', x: 10, y: 10 + i * 30, w: 400, h: 28, rotation: 0, text,
      fontSize: pt * PT_MM * ppm, fontWeight: 400, color: '#000000', fontFamily: 'Inter',
      fontStyle: 'normal', textAlign: 'left', textDecoration: 'none',
    })),
  };
}

const ALL: Array<[string, number]> = [
  ['{{ name }}', 10],
  ['Масса нетто: {{ weight_netto_pack }} кг', 9],
  ['Годен до: {{ exp_date_full }}', 7],
  ['Партия: {{ batch_number }}', 7],
  ['Состав: {{ Состав }}', 7],
  ['Хранить при 0…+6 °C', 7],
  ['Производитель: ООО «Пример», Рига', 7],
];

describe('fieldKeys', () => {
  it('reads keys with and without spaces', () => {
    expect(fieldKeys('{{name}} / {{ weight_netto_pack }} / {{ Условия хранения }}')).toEqual(['name', 'weight_netto_pack', 'Условия хранения']);
  });
});

describe('keySatisfies', () => {
  it('maps built-in fields and extra fields in all four languages', () => {
    expect(keySatisfies('net', 'weight_netto_pack')).toBe(true);
    expect(keySatisfies('net', 'weight_brutto_pack')).toBe(false);
    expect(keySatisfies('ingredients', 'Состав')).toBe(true);
    expect(keySatisfies('ingredients', 'Склад')).toBe(true);
    expect(keySatisfies('ingredients', 'Zutaten')).toBe(true);
    expect(keySatisfies('storage', 'Aufbewahrungsbedingungen')).toBe(true);
    expect(keySatisfies('producer', 'Manufacturer and address')).toBe(true);
  });
});

describe('euCheck', () => {
  it('finds every particular on a complete pack label, fixed text included', () => {
    const check = euCheck(label(58, 40, ALL));
    expect(check.gaps).toEqual([]);
    expect(check.ready).toBe(7);
  });

  it('reports what is missing', () => {
    const check = euCheck(label(58, 40, ALL.filter(([text]) => !text.includes('Состав') && !text.includes('Партия'))));
    expect(check.gaps).toEqual(['lot', 'ingredients']);
  });

  it('counts a particular printed too small as a gap', () => {
    const texts = ALL.map(([text, pt]): [string, number] => [text, text.includes('Состав') ? 4 : pt]);
    expect(euCheck(label(58, 40, texts)).gaps).toEqual(['ingredients']);
  });

  it('only checks consumer pack labels', () => {
    expect(isEuChecked(label(100, 150, ALL, 'box'))).toBe(false);
    expect(isEuChecked(label(58, 40, ALL))).toBe(true);
  });
});

describe('textSize', () => {
  it('measures the x-height of Inter: 6.5 pt is at least 1.2 mm', () => {
    const doc = label(58, 40, [['x', 6.5]]);
    const el = doc.elements[0] as TextElement;
    expect(xHeightMm(el, doc.canvas)).toBeGreaterThanOrEqual(1.2);
    expect(textSize(el, doc.canvas)).toBe('ok');
  });

  it('allows 0.9–1.2 mm only where the pack may be under 80 cm²', () => {
    const small = label(58, 40, [['x', 5]]);
    expect(textSize(small.elements[0] as TextElement, small.canvas)).toBe('smallPack');
    const large = label(100, 100, [['x', 5]]);
    expect(textSize(large.elements[0] as TextElement, large.canvas)).toBe('tooSmall');
  });

  it('rejects text under 0.9 mm', () => {
    const doc = label(58, 40, [['x', 4]]);
    expect(textSize(doc.elements[0] as TextElement, doc.canvas)).toBe('tooSmall');
  });
});
