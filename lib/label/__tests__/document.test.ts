import { describe, it, expect } from 'vitest';
import { defaultDoc, validateDoc } from '../document';
import { DPI_203 } from '../helpers';
import type { LabelDoc, TextElement, RectElement, BarcodeElement, TableElement } from '../types';

describe('defaultDoc', () => {
  it('returns a valid document structure', () => {
    const doc = defaultDoc();
    expect(doc.version).toBe(1);
    expect(doc.canvas).toBeDefined();
    expect(doc.elements).toEqual([]);
  });

  it('has correct default canvas dimensions', () => {
    const doc = defaultDoc();
    expect(doc.canvas.widthCm).toBe(10);
    expect(doc.canvas.heightCm).toBe(6);
    expect(doc.canvas.dpi).toBe(DPI_203);
  });

  it('has default canvas properties', () => {
    const doc = defaultDoc();
    expect(doc.canvas.background).toBe('#ffffff');
    expect(doc.canvas.showGrid).toBe(true);
    expect(doc.canvas.gridSize).toBe(16);
    expect(doc.canvas.labelType).toBe('pack');
    expect(doc.canvas.printedZones).toEqual([]);
  });

  it('width/height px match cm calculation', () => {
    const doc = defaultDoc();
    expect(doc.canvas.width).toBe(Math.round(10 * (1 / 2.54) * DPI_203));
    expect(doc.canvas.height).toBe(Math.round(6 * (1 / 2.54) * DPI_203));
  });
});

describe('validateDoc', () => {
  const minValidDoc: any = {
    version: 1,
    canvas: {
      widthCm: 10,
      heightCm: 6,
      dpi: 203,
      background: '#ffffff',
      showGrid: true,
      gridSize: 16,
    },
    elements: [],
  };

  describe('returns null for invalid inputs', () => {
    it('null input', () => {
      expect(validateDoc(null)).toBeNull();
    });

    it('undefined input', () => {
      expect(validateDoc(undefined)).toBeNull();
    });

    it('string input', () => {
      expect(validateDoc('hello')).toBeNull();
    });

    it('wrong version', () => {
      expect(validateDoc({ ...minValidDoc, version: 2 })).toBeNull();
    });

    it('missing canvas', () => {
      expect(validateDoc({ version: 1, elements: [] })).toBeNull();
    });

    it('canvas is not object', () => {
      expect(validateDoc({ version: 1, canvas: 'bad', elements: [] })).toBeNull();
    });

    it('missing elements', () => {
      expect(validateDoc({ version: 1, canvas: {} })).toBeNull();
    });

    it('elements is not array', () => {
      expect(validateDoc({ version: 1, canvas: {}, elements: 'bad' })).toBeNull();
    });
  });

  describe('normalizes valid doc', () => {
    it('returns a valid document from minimal input', () => {
      const result = validateDoc(minValidDoc);
      expect(result).not.toBeNull();
      expect(result!.version).toBe(1);
      expect(result!.elements).toEqual([]);
    });

    it('clamps canvas widthCm to [0.1, 100]', () => {
      const result = validateDoc({ ...minValidDoc, canvas: { ...minValidDoc.canvas, widthCm: -5 } });
      expect(result!.canvas.widthCm).toBe(0.1);

      const result2 = validateDoc({ ...minValidDoc, canvas: { ...minValidDoc.canvas, widthCm: 999 } });
      expect(result2!.canvas.widthCm).toBe(100);
    });

    it('clamps dpi to [72, 1200]', () => {
      const result = validateDoc({ ...minValidDoc, canvas: { ...minValidDoc.canvas, dpi: 10 } });
      expect(result!.canvas.dpi).toBe(72);

      const result2 = validateDoc({ ...minValidDoc, canvas: { ...minValidDoc.canvas, dpi: 9999 } });
      expect(result2!.canvas.dpi).toBe(1200);
    });

    it('defaults background to #ffffff', () => {
      const result = validateDoc({ ...minValidDoc, canvas: { ...minValidDoc.canvas, background: undefined } });
      expect(result!.canvas.background).toBe('#ffffff');
    });

    it('defaults labelType to pack', () => {
      const result = validateDoc(minValidDoc);
      expect(result!.canvas.labelType).toBe('pack');
    });

    it('accepts valid labelType', () => {
      const result = validateDoc({ ...minValidDoc, canvas: { ...minValidDoc.canvas, labelType: 'box' } });
      expect(result!.canvas.labelType).toBe('box');

      const result2 = validateDoc({ ...minValidDoc, canvas: { ...minValidDoc.canvas, labelType: 'pallet' } });
      expect(result2!.canvas.labelType).toBe('pallet');
    });

    it('defaults invalid labelType to pack', () => {
      const result = validateDoc({ ...minValidDoc, canvas: { ...minValidDoc.canvas, labelType: 'invalid' } });
      expect(result!.canvas.labelType).toBe('pack');
    });
  });

  describe('validates elements', () => {
    it('filters out null/invalid elements', () => {
      const doc = {
        ...minValidDoc,
        elements: [null, undefined, 'string', { type: 'text' /* no id */ }],
      };
      const result = validateDoc(doc);
      expect(result!.elements).toEqual([]);
    });

    it('normalizes text element with defaults', () => {
      const doc = {
        ...minValidDoc,
        elements: [{ id: 'e1', type: 'text' }],
      };
      const result = validateDoc(doc);
      expect(result!.elements).toHaveLength(1);
      const el = result!.elements[0] as TextElement;
      expect(el.type).toBe('text');
      expect(el.text).toBe('Текст');
      expect(el.fontSize).toBe(14);
      expect(el.fontFamily).toBe('Inter');
      expect(el.textAlign).toBe('left');
      expect(el.fontStyle).toBe('normal');
      expect(el.textDecoration).toBe('none');
    });

    it('preserves valid text element properties', () => {
      const doc = {
        ...minValidDoc,
        elements: [{
          id: 'e1',
          type: 'text',
          x: 10, y: 20, w: 100, h: 50, rotation: 45,
          text: 'Hello',
          fontSize: 24,
          color: '#ff0000',
          fontWeight: 700,
          fontFamily: 'Arial',
          fontStyle: 'italic',
          textAlign: 'center',
          textDecoration: 'underline',
        }],
      };
      const result = validateDoc(doc);
      const el = result!.elements[0] as TextElement;
      expect(el.x).toBe(10);
      expect(el.text).toBe('Hello');
      expect(el.fontSize).toBe(24);
      expect(el.color).toBe('#ff0000');
      expect(el.fontWeight).toBe(700);
      expect(el.fontFamily).toBe('Arial');
      expect(el.fontStyle).toBe('italic');
      expect(el.textAlign).toBe('center');
      expect(el.textDecoration).toBe('underline');
    });

    it('forces minLength=12 for pack_number text', () => {
      const doc = {
        ...minValidDoc,
        elements: [{ id: 'e1', type: 'text', text: '{{ pack_number }}' }],
      };
      const result = validateDoc(doc);
      expect((result!.elements[0] as TextElement).minLength).toBe(12);
    });

    it('forces minLength=12 for box_number text', () => {
      const doc = {
        ...minValidDoc,
        elements: [{ id: 'e1', type: 'text', text: '{{ box_number }}' }],
      };
      const result = validateDoc(doc);
      expect((result!.elements[0] as TextElement).minLength).toBe(12);
    });

    it('normalizes rect element', () => {
      const doc = {
        ...minValidDoc,
        elements: [{ id: 'r1', type: 'rect' }],
      };
      const result = validateDoc(doc);
      const el = result!.elements[0] as RectElement;
      expect(el.type).toBe('rect');
      expect(el.fill).toBe('transparent');
      expect(el.borderColor).toBe('#000000');
      expect(el.borderWidth).toBe(1);
      expect(el.borderRadius).toBe(0);
    });

    it('normalizes barcode element', () => {
      const doc = {
        ...minValidDoc,
        elements: [{ id: 'b1', type: 'barcode' }],
      };
      const result = validateDoc(doc);
      const el = result!.elements[0] as BarcodeElement;
      expect(el.type).toBe('barcode');
      expect(el.value).toBe('123456789012');
      expect(el.barcodeType).toBe('CODE128');
      expect(el.showText).toBe(true);
    });

    it('preserves barcode templateId and imageData', () => {
      const doc = {
        ...minValidDoc,
        elements: [{ id: 'b1', type: 'barcode', templateId: 5, imageData: 'base64data' }],
      };
      const result = validateDoc(doc);
      const el = result!.elements[0] as BarcodeElement;
      expect(el.templateId).toBe(5);
      expect(el.imageData).toBe('base64data');
    });

    it('normalizes table element with default columns', () => {
      const doc = {
        ...minValidDoc,
        elements: [{ id: 't1', type: 'table' }],
      };
      const result = validateDoc(doc);
      const el = result!.elements[0] as TableElement;
      expect(el.type).toBe('table');
      expect(el.columns).toHaveLength(2);
      expect(el.columns[0].key).toBe('name');
      expect(el.columns[1].key).toBe('weight_netto_pack');
      expect(el.groupBy).toBe('none');
      expect(el.sortBy).toBe('none');
      expect(el.showHeaders).toBe(true);
      expect(el.showBorders).toBe(true);
    });

    it('clamps element dimensions', () => {
      const doc = {
        ...minValidDoc,
        elements: [{ id: 'e1', type: 'text', w: -10, h: 99999 }],
      };
      const result = validateDoc(doc);
      const el = result!.elements[0];
      expect(el.w).toBe(1);   // min 1
      expect(el.h).toBe(5000); // max 5000
    });

    it('clamps rotation to [-360, 360]', () => {
      const doc = {
        ...minValidDoc,
        elements: [{ id: 'e1', type: 'text', rotation: 999 }],
      };
      const result = validateDoc(doc);
      expect(result!.elements[0].rotation).toBe(360);
    });

    it('filters unknown element types', () => {
      const doc = {
        ...minValidDoc,
        elements: [{ id: 'e1', type: 'unknown_type' }],
      };
      const result = validateDoc(doc);
      expect(result!.elements).toEqual([]);
    });
  });

  describe('printedZones', () => {
    it('validates zones with all required fields', () => {
      const doc = {
        ...minValidDoc,
        canvas: {
          ...minValidDoc.canvas,
          printedZones: [
            { id: 'z1', label: 'Header', side: 'top', sizeMm: 15, color: '#ff0000' },
          ],
        },
      };
      const result = validateDoc(doc);
      expect(result!.canvas.printedZones).toHaveLength(1);
      expect(result!.canvas.printedZones[0].id).toBe('z1');
      expect(result!.canvas.printedZones[0].label).toBe('Header');
      expect(result!.canvas.printedZones[0].side).toBe('top');
    });

    it('filters zones without string id', () => {
      const doc = {
        ...minValidDoc,
        canvas: {
          ...minValidDoc.canvas,
          printedZones: [
            { id: 123, label: 'Bad', side: 'top', sizeMm: 10, color: '#000' },
            null,
          ],
        },
      };
      const result = validateDoc(doc);
      expect(result!.canvas.printedZones).toEqual([]);
    });

    it('clamps zone sizeMm to [0, 500]', () => {
      const doc = {
        ...minValidDoc,
        canvas: {
          ...minValidDoc.canvas,
          printedZones: [
            { id: 'z1', side: 'top', sizeMm: 999 },
          ],
        },
      };
      const result = validateDoc(doc);
      expect(result!.canvas.printedZones[0].sizeMm).toBe(500);
    });

    it('defaults missing zone fields', () => {
      const doc = {
        ...minValidDoc,
        canvas: {
          ...minValidDoc.canvas,
          printedZones: [{ id: 'z1' }],
        },
      };
      const result = validateDoc(doc);
      const zone = result!.canvas.printedZones[0];
      expect(zone.label).toBe('Зона');
      expect(zone.side).toBe('top');
      expect(zone.color).toBe('#1e40af');
    });
  });
});
