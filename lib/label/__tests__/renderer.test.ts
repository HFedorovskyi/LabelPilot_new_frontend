import { describe, it, expect } from 'vitest';
import { processDynamicText } from '../renderer';

describe('processDynamicText', () => {
  describe('basic substitution', () => {
    it('replaces a single placeholder', () => {
      expect(processDynamicText('Hello {{ name }}', { name: 'World' }))
        .toBe('Hello World');
    });

    it('replaces multiple placeholders', () => {
      const result = processDynamicText('{{ article }} - {{ name }}', {
        article: 'ART-001',
        name: 'Товар',
      });
      expect(result).toBe('ART-001 - Товар');
    });

    it('replaces repeated placeholder', () => {
      expect(processDynamicText('{{ x }} and {{ x }}', { x: 'A' }))
        .toBe('A and A');
    });

    it('handles whitespace variations in placeholders', () => {
      expect(processDynamicText('{{name}}', { name: 'Test' })).toBe('Test');
      expect(processDynamicText('{{  name  }}', { name: 'Test' })).toBe('Test');
      expect(processDynamicText('{{ name}}', { name: 'Test' })).toBe('Test');
    });

    it('converts non-string values to string', () => {
      expect(processDynamicText('{{ count }}', { count: 42 })).toBe('42');
      expect(processDynamicText('{{ flag }}', { flag: true })).toBe('true');
    });
  });

  describe('missing keys', () => {
    it('keeps original placeholder when key not in data', () => {
      expect(processDynamicText('{{ missing }}', {})).toBe('{{ missing }}');
    });

    it('replaces known keys but preserves missing ones', () => {
      expect(processDynamicText('{{ a }} {{ b }}', { a: 'yes' }))
        .toBe('yes {{ b }}');
    });
  });

  describe('pack_number padding', () => {
    it('pads pack_number to 12 digits', () => {
      expect(processDynamicText('{{ pack_number }}', { pack_number: '1' }))
        .toBe('000000000001');
    });

    it('pads pack_number when already some digits', () => {
      expect(processDynamicText('{{ pack_number }}', { pack_number: '12345' }))
        .toBe('000000012345');
    });

    it('does not pad pack_number if 12+ digits', () => {
      expect(processDynamicText('{{ pack_number }}', { pack_number: '123456789012' }))
        .toBe('123456789012');
    });

    it('does not pad non-numeric pack_number', () => {
      expect(processDynamicText('{{ pack_number }}', { pack_number: 'ABC' }))
        .toBe('ABC');
    });
  });

  describe('box_number padding', () => {
    it('pads box_number to 12 digits', () => {
      expect(processDynamicText('{{ box_number }}', { box_number: '42' }))
        .toBe('000000000042');
    });

    it('does not pad non-numeric box_number', () => {
      expect(processDynamicText('{{ box_number }}', { box_number: 'X1' }))
        .toBe('X1');
    });
  });

  describe('minLength padding for pallet_number / pack_counter', () => {
    it('pads pallet_number with minLength', () => {
      expect(processDynamicText('{{ pallet_number }}', { pallet_number: '5' }, { minLength: 8 }))
        .toBe('00000005');
    });

    it('does not pad pallet_number without minLength', () => {
      expect(processDynamicText('{{ pallet_number }}', { pallet_number: '5' }))
        .toBe('5');
    });

    it('pads pack_counter with minLength', () => {
      expect(processDynamicText('{{ pack_counter }}', { pack_counter: '99' }, { minLength: 6 }))
        .toBe('000099');
    });

    it('does not affect other keys even with minLength', () => {
      expect(processDynamicText('{{ name }}', { name: 'Test' }, { minLength: 20 }))
        .toBe('Test');
    });
  });

  describe('edge cases', () => {
    it('handles empty text', () => {
      expect(processDynamicText('', { name: 'Test' })).toBe('');
    });

    it('handles text without any placeholders', () => {
      expect(processDynamicText('Plain text', {})).toBe('Plain text');
    });

    it('handles nested braces (not valid placeholder)', () => {
      // {{{}}} — inner {{}} should not match because regex requires no braces in group
      expect(processDynamicText('prefix {{{ name }}} suffix', { name: 'X' }))
        .toBe('prefix {X} suffix');
    });

    it('handles undefined data value — treated as missing key', () => {
      // processDynamicText checks `data[key] !== undefined`, so undefined keeps the placeholder
      expect(processDynamicText('{{ key }}', { key: undefined }))
        .toBe('{{ key }}');
    });
  });
});
