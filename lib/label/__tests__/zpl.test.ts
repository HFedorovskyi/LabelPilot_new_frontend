import { describe, it, expect } from 'vitest';
import { labelToZpl } from '../zpl';
import type { LabelDoc, TextElement, RectElement, BarcodeElement, TableElement } from '../types';

function makeDoc(elements: any[] = [], canvasOverrides: any = {}): LabelDoc {
  return {
    version: 1,
    canvas: {
      width: 799,
      height: 479,
      widthCm: 10,
      heightCm: 6,
      dpi: 203,
      background: '#ffffff',
      showGrid: false,
      gridSize: 16,
      labelType: 'pack',
      printedZones: [],
      ...canvasOverrides,
    },
    elements,
  };
}

describe('labelToZpl', () => {
  describe('document structure', () => {
    it('empty doc produces ^XA ... ^XZ envelope', () => {
      const zpl = labelToZpl(makeDoc());
      expect(zpl).toMatch(/^\^XA\n/);
      expect(zpl).toMatch(/\^XZ$/);
    });

    it('includes ^CI28 for UTF-8', () => {
      expect(labelToZpl(makeDoc())).toContain('^CI28');
    });

    it('includes ^PW with correct width dots', () => {
      const zpl = labelToZpl(makeDoc());
      const widthDots = Math.round(10 * (203 / 2.54));
      expect(zpl).toContain(`^PW${widthDots}`);
    });

    it('includes ^LL with correct height dots', () => {
      const zpl = labelToZpl(makeDoc());
      const heightDots = Math.round(6 * (203 / 2.54));
      expect(zpl).toContain(`^LL${heightDots}`);
    });
  });

  describe('text elements', () => {
    it('generates text ZPL command', () => {
      const el: TextElement = {
        id: 't1', type: 'text',
        x: 50, y: 30, w: 200, h: 40, rotation: 0,
        text: 'Hello', fontSize: 20, fontWeight: 400,
        color: '#000', fontFamily: 'Inter',
        fontStyle: 'normal', textAlign: 'left', textDecoration: 'none',
      };
      const zpl = labelToZpl(makeDoc([el]));
      expect(zpl).toContain('^FO50,30');
      expect(zpl).toContain('^A0N,20,20');
      expect(zpl).toContain('^FDHello^FS');
    });

    it('handles text alignment (center)', () => {
      const el: TextElement = {
        id: 't1', type: 'text',
        x: 10, y: 10, w: 300, h: 30, rotation: 0,
        text: 'Center', fontSize: 16, fontWeight: 400,
        color: '#000', fontFamily: 'Inter',
        fontStyle: 'normal', textAlign: 'center', textDecoration: 'none',
      };
      const zpl = labelToZpl(makeDoc([el]));
      // ^FB wraps text, alignment is C for center
      expect(zpl).toContain('^FB300,999,0,C,0');
    });

    it('handles text alignment (right)', () => {
      const el: TextElement = {
        id: 't1', type: 'text',
        x: 10, y: 10, w: 300, h: 30, rotation: 0,
        text: 'Right', fontSize: 16, fontWeight: 400,
        color: '#000', fontFamily: 'Inter',
        fontStyle: 'normal', textAlign: 'right', textDecoration: 'none',
      };
      const zpl = labelToZpl(makeDoc([el]));
      expect(zpl).toContain('^FB300,999,0,R,0');
    });

    it('substitutes dynamic text', () => {
      const el: TextElement = {
        id: 't1', type: 'text',
        x: 0, y: 0, w: 200, h: 30, rotation: 0,
        text: '{{ name }}', fontSize: 14, fontWeight: 400,
        color: '#000', fontFamily: 'Inter',
        fontStyle: 'normal', textAlign: 'left', textDecoration: 'none',
      };
      const zpl = labelToZpl(makeDoc([el]), { name: 'Тест' });
      expect(zpl).toContain('^FDТест^FS');
    });

    it('pads pack_number in text to 12 digits', () => {
      const el: TextElement = {
        id: 't1', type: 'text',
        x: 0, y: 0, w: 200, h: 30, rotation: 0,
        text: '{{ pack_number }}', fontSize: 14, fontWeight: 400,
        color: '#000', fontFamily: 'Inter',
        fontStyle: 'normal', textAlign: 'left', textDecoration: 'none',
        minLength: 12,
      };
      const zpl = labelToZpl(makeDoc([el]), { pack_number: '5' });
      expect(zpl).toContain('^FD000000000005^FS');
    });
  });

  describe('rect elements', () => {
    it('generates ^GB command', () => {
      const el: RectElement = {
        id: 'r1', type: 'rect',
        x: 100, y: 50, w: 200, h: 100, rotation: 0,
        fill: 'transparent', borderColor: '#000',
        borderWidth: 2, borderRadius: 0,
      };
      const zpl = labelToZpl(makeDoc([el]));
      expect(zpl).toContain('^FO100,50');
      expect(zpl).toContain('^GB200,100,2,B,0^FS');
    });

    it('maps borderRadius to ZPL rounding (0-8)', () => {
      const el: RectElement = {
        id: 'r1', type: 'rect',
        x: 0, y: 0, w: 100, h: 100, rotation: 0,
        fill: 'transparent', borderColor: '#000',
        borderWidth: 1, borderRadius: 50,
      };
      const zpl = labelToZpl(makeDoc([el]));
      // rounding = floor(50/10) = 5
      expect(zpl).toContain('^GB100,100,1,B,5^FS');
    });

    it('caps rounding at 8', () => {
      const el: RectElement = {
        id: 'r1', type: 'rect',
        x: 0, y: 0, w: 100, h: 100, rotation: 0,
        fill: 'transparent', borderColor: '#000',
        borderWidth: 1, borderRadius: 200,
      };
      const zpl = labelToZpl(makeDoc([el]));
      expect(zpl).toContain(',8^FS');
    });
  });

  describe('barcode elements', () => {
    it('generates EAN-13 barcode (^BE)', () => {
      const el: BarcodeElement = {
        id: 'b1', type: 'barcode',
        x: 10, y: 200, w: 190, h: 80, rotation: 0,
        value: '4607100230121', barcodeType: 'EAN13', showText: true,
      };
      const zpl = labelToZpl(makeDoc([el]));
      expect(zpl).toContain('^FO10,200');
      expect(zpl).toContain('^BE');
      expect(zpl).toContain('^FD4607100230121^FS');
    });

    it('generates Code128 barcode (^BCN)', () => {
      const el: BarcodeElement = {
        id: 'b1', type: 'barcode',
        x: 10, y: 200, w: 200, h: 60, rotation: 0,
        value: 'ABC123', barcodeType: 'CODE128', showText: true,
      };
      const zpl = labelToZpl(makeDoc([el]));
      expect(zpl).toContain('^BCN');
      expect(zpl).toContain('^FDABC123^FS');
    });

    it('generates QR code (^BQ)', () => {
      const el: BarcodeElement = {
        id: 'b1', type: 'barcode',
        x: 10, y: 200, w: 150, h: 150, rotation: 0,
        value: 'https://example.com', barcodeType: 'QRCODE', showText: false,
      };
      const zpl = labelToZpl(makeDoc([el]));
      expect(zpl).toContain('^BQ');
      expect(zpl).toContain('^FDQA,https://example.com^FS');
    });

    it('falls back to Code128 for unknown barcode type', () => {
      const el: BarcodeElement = {
        id: 'b1', type: 'barcode',
        x: 0, y: 0, w: 200, h: 60, rotation: 0,
        value: 'DATA', barcodeType: 'UNKNOWN', showText: true,
      };
      const zpl = labelToZpl(makeDoc([el]));
      expect(zpl).toContain('^BCN');
    });

    it('substitutes dynamic value in barcode', () => {
      const el: BarcodeElement = {
        id: 'b1', type: 'barcode',
        x: 0, y: 0, w: 200, h: 60, rotation: 0,
        value: '{{ article }}', barcodeType: 'CODE128', showText: true,
      };
      const zpl = labelToZpl(makeDoc([el]), { article: 'ART-001' });
      expect(zpl).toContain('^FDART-001^FS');
    });
  });

  describe('table elements', () => {
    const makeTable = (overrides: Partial<TableElement> = {}): TableElement => ({
      id: 'tbl1', type: 'table',
      x: 0, y: 0, w: 400, h: 200, rotation: 0,
      columns: [
        { id: 'c1', key: 'name', title: 'Наименование', widthRatio: 60 },
        { id: 'c2', key: 'weight_netto_pack', title: 'Вес', widthRatio: 40 },
      ],
      groupBy: 'none', sortBy: 'none',
      fontSize: 12, showHeaders: true, showBorders: true,
      fontFamily: 'Inter', fontStyle: 'normal',
      ...overrides,
    });

    it('generates table FX comment', () => {
      const zpl = labelToZpl(makeDoc([makeTable()]));
      expect(zpl).toContain('^FX Table tbl1');
    });

    it('generates headers when showHeaders is true', () => {
      const zpl = labelToZpl(makeDoc([makeTable()]));
      expect(zpl).toContain('^FDНаименование^FS');
      expect(zpl).toContain('^FDВес^FS');
    });

    it('generates data rows with substituted values', () => {
      const data = { items: [{ name: 'Товар A', weight_netto_pack: '10.5' }] };
      const zpl = labelToZpl(makeDoc([makeTable()]), data);
      expect(zpl).toContain('^FDТовар A^FS');
      expect(zpl).toContain('^FD10.5^FS');
    });

    it('limits rows to maxRows', () => {
      const table = makeTable({ maxRows: 1 });
      const data = {
        items: [
          { name: 'A', weight_netto_pack: '1' },
          { name: 'B', weight_netto_pack: '2' },
        ],
      };
      const zpl = labelToZpl(makeDoc([table]), data);
      expect(zpl).toContain('^FDA^FS');
      expect(zpl).not.toContain('^FDB^FS');
    });

    it('uses data as single row when no items array', () => {
      const data = { name: 'Single', weight_netto_pack: '5.0' };
      const zpl = labelToZpl(makeDoc([makeTable()]), data);
      expect(zpl).toContain('^FDSingle^FS');
    });

    it('generates borders when showBorders=true', () => {
      const zpl = labelToZpl(makeDoc([makeTable()]));
      // Should have ^GB commands for borders
      expect(zpl).toContain('^GB');
    });
  });

  describe('multiple elements', () => {
    it('generates ZPL for all elements in order', () => {
      const text: TextElement = {
        id: 't1', type: 'text',
        x: 0, y: 0, w: 200, h: 30, rotation: 0,
        text: 'Title', fontSize: 20, fontWeight: 700,
        color: '#000', fontFamily: 'Inter',
        fontStyle: 'normal', textAlign: 'left', textDecoration: 'none',
      };
      const rect: RectElement = {
        id: 'r1', type: 'rect',
        x: 0, y: 40, w: 200, h: 2, rotation: 0,
        fill: '#000', borderColor: '#000', borderWidth: 1, borderRadius: 0,
      };
      const zpl = labelToZpl(makeDoc([text, rect]));
      const textIdx = zpl.indexOf('^FDTitle^FS');
      const rectIdx = zpl.indexOf('^GB200,2,1');
      expect(textIdx).toBeLessThan(rectIdx);
    });
  });
});
