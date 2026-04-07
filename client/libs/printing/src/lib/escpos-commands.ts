/**
 * Pure ESC/POS command builders.
 * Each function returns a Uint8Array of bytes to send to a thermal printer.
 * Reference: https://reference.epson-biz.com/modules/ref_escpos/
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Default print width in characters (48 for 80mm paper, 32 for 58mm) */
export const DEFAULT_WIDTH = 32;

/** Reset printer to default settings */
export function initialize(): Uint8Array {
  return new Uint8Array([ESC, 0x40]);
}

/** Feed n lines */
export function feedLines(n: number): Uint8Array {
  return new Uint8Array([ESC, 0x64, n & 0xff]);
}

/** Full paper cut */
export function cut(): Uint8Array {
  return new Uint8Array([GS, 0x56, 0x00]);
}

/** Partial paper cut */
export function partialCut(): Uint8Array {
  return new Uint8Array([GS, 0x56, 0x01]);
}

/** Align left */
export function alignLeft(): Uint8Array {
  return new Uint8Array([ESC, 0x61, 0x00]);
}

/** Align center */
export function alignCenter(): Uint8Array {
  return new Uint8Array([ESC, 0x61, 0x01]);
}

/** Align right */
export function alignRight(): Uint8Array {
  return new Uint8Array([ESC, 0x61, 0x02]);
}

/** Enable bold */
export function boldOn(): Uint8Array {
  return new Uint8Array([ESC, 0x45, 0x01]);
}

/** Disable bold */
export function boldOff(): Uint8Array {
  return new Uint8Array([ESC, 0x45, 0x00]);
}

/** Enable double-height text */
export function doubleHeightOn(): Uint8Array {
  return new Uint8Array([ESC, 0x21, 0x10]);
}

/** Disable double-height text */
export function doubleHeightOff(): Uint8Array {
  return new Uint8Array([ESC, 0x21, 0x00]);
}

/** Encode a string to bytes (ASCII/CP437) and append a line feed */
export function textLine(text: string): Uint8Array {
  const encoded = encodeText(text);
  const result = new Uint8Array(encoded.length + 1);
  result.set(encoded);
  result[encoded.length] = LF;
  return result;
}

/** Encode text without a trailing line feed */
export function encodeText(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[i] = code > 127 ? 0x3f : code; // Replace non-ASCII with '?'
  }
  return bytes;
}

/** Print a separator line (e.g., dashes) */
export function separator(char = '-', width = DEFAULT_WIDTH): Uint8Array {
  return textLine(char.repeat(width));
}

/**
 * Open cash drawer via printer.
 * @param pin Connector pin: 0 = pin 2 (most common), 1 = pin 5
 */
export function cashDrawerKick(pin: 0 | 1 = 0): Uint8Array {
  // ESC p m t1 t2
  // m = pin (0 or 1), t1 = on time (25*2ms = 50ms), t2 = off time (120*2ms = 240ms)
  return new Uint8Array([ESC, 0x70, pin, 0x19, 0x78]);
}

/** Concatenate multiple Uint8Arrays into one */
export function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Format a two-column line: left-aligned text on the left, right-aligned text on the right.
 * E.g., "Green Machine          $7.50"
 */
export function twoColumnLine(left: string, right: string, width = DEFAULT_WIDTH): Uint8Array {
  const gap = width - left.length - right.length;
  if (gap < 1) {
    // Truncate left side if too long
    const maxLeft = width - right.length - 1;
    return textLine(left.substring(0, maxLeft) + ' ' + right);
  }
  return textLine(left + ' '.repeat(gap) + right);
}
