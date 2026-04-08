import { describe, it, expect } from 'vitest';
import {
  initialize,
  cut,
  partialCut,
  feedLines,
  alignLeft,
  alignCenter,
  alignRight,
  boldOn,
  boldOff,
  doubleHeightOn,
  doubleHeightOff,
  textLine,
  encodeText,
  separator,
  cashDrawerKick,
  concat,
  twoColumnLine,
  DEFAULT_WIDTH,
} from './escpos-commands';

describe('ESC/POS Commands', () => {
  describe('initialize', () => {
    it('should return ESC @ then ESC t 16 (reset + select CP1252)', () => {
      expect(Array.from(initialize())).toEqual([0x1b, 0x40, 0x1b, 0x74, 16]);
    });
  });

  describe('cut', () => {
    it('should return GS V 0 for full cut', () => {
      expect(Array.from(cut())).toEqual([0x1d, 0x56, 0x00]);
    });

    it('should return GS V 1 for partial cut', () => {
      expect(Array.from(partialCut())).toEqual([0x1d, 0x56, 0x01]);
    });
  });

  describe('feedLines', () => {
    it('should feed 3 lines', () => {
      expect(Array.from(feedLines(3))).toEqual([0x1b, 0x64, 0x03]);
    });

    it('should feed 0 lines', () => {
      expect(Array.from(feedLines(0))).toEqual([0x1b, 0x64, 0x00]);
    });

    it('should mask to single byte', () => {
      expect(Array.from(feedLines(256))).toEqual([0x1b, 0x64, 0x00]);
    });
  });

  describe('alignment', () => {
    it('alignLeft returns ESC a 0', () => {
      expect(Array.from(alignLeft())).toEqual([0x1b, 0x61, 0x00]);
    });

    it('alignCenter returns ESC a 1', () => {
      expect(Array.from(alignCenter())).toEqual([0x1b, 0x61, 0x01]);
    });

    it('alignRight returns ESC a 2', () => {
      expect(Array.from(alignRight())).toEqual([0x1b, 0x61, 0x02]);
    });
  });

  describe('bold', () => {
    it('boldOn returns ESC E 1', () => {
      expect(Array.from(boldOn())).toEqual([0x1b, 0x45, 0x01]);
    });

    it('boldOff returns ESC E 0', () => {
      expect(Array.from(boldOff())).toEqual([0x1b, 0x45, 0x00]);
    });
  });

  describe('doubleHeight', () => {
    it('doubleHeightOn returns ESC ! 0x10', () => {
      expect(Array.from(doubleHeightOn())).toEqual([0x1b, 0x21, 0x10]);
    });

    it('doubleHeightOff returns ESC ! 0x00', () => {
      expect(Array.from(doubleHeightOff())).toEqual([0x1b, 0x21, 0x00]);
    });
  });

  describe('encodeText', () => {
    it('should encode ASCII text', () => {
      const result = encodeText('Hi');
      expect(Array.from(result)).toEqual([0x48, 0x69]);
    });

    it('should encode Latin-1 characters (é = 0xE9 in CP1252)', () => {
      const result = encodeText('café');
      expect(result[3]).toBe(0xe9); // é is 0xE9 in CP1252/Latin-1
    });

    it('should encode € as 0x80 in CP1252', () => {
      const result = encodeText('€');
      expect(result[0]).toBe(0x80);
    });

    it('should encode £ as 0xA3 in CP1252', () => {
      const result = encodeText('£');
      expect(result[0]).toBe(0xa3);
    });

    it('should replace unmapped Unicode with ?', () => {
      const result = encodeText('\u4e2d'); // Chinese character
      expect(result[0]).toBe(0x3f);
    });
  });

  describe('textLine', () => {
    it('should encode text with trailing LF', () => {
      const result = textLine('Hi');
      expect(Array.from(result)).toEqual([0x48, 0x69, 0x0a]);
    });

    it('should handle empty string', () => {
      const result = textLine('');
      expect(Array.from(result)).toEqual([0x0a]);
    });
  });

  describe('separator', () => {
    it('should create a line of dashes with default width', () => {
      const result = separator();
      const decoded = String.fromCharCode(...result.slice(0, -1)); // strip LF
      expect(decoded).toBe('-'.repeat(DEFAULT_WIDTH));
      expect(result[result.length - 1]).toBe(0x0a);
    });

    it('should use custom char and width', () => {
      const result = separator('=', 10);
      const decoded = String.fromCharCode(...result.slice(0, -1));
      expect(decoded).toBe('='.repeat(10));
    });
  });

  describe('cashDrawerKick', () => {
    it('should kick pin 2 (default)', () => {
      expect(Array.from(cashDrawerKick())).toEqual([0x1b, 0x70, 0x00, 0x19, 0x78]);
    });

    it('should kick pin 5', () => {
      expect(Array.from(cashDrawerKick(1))).toEqual([0x1b, 0x70, 0x01, 0x19, 0x78]);
    });
  });

  describe('concat', () => {
    it('should concatenate multiple arrays', () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([3, 4, 5]);
      expect(Array.from(concat(a, b))).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle empty arrays', () => {
      const a = new Uint8Array([]);
      const b = new Uint8Array([1]);
      expect(Array.from(concat(a, b))).toEqual([1]);
    });
  });

  describe('twoColumnLine', () => {
    it('should format left and right text with padding', () => {
      const result = twoColumnLine('Item', '$5.00', 20);
      const decoded = String.fromCharCode(...result.slice(0, -1));
      expect(decoded).toBe('Item           $5.00');
      expect(decoded.length).toBe(20);
    });

    it('should truncate long left text', () => {
      const result = twoColumnLine('Very Long Product Name', '$5.00', 20);
      const decoded = String.fromCharCode(...result.slice(0, -1));
      expect(decoded.length).toBe(20);
      expect(decoded.endsWith('$5.00')).toBe(true);
    });
  });
});
