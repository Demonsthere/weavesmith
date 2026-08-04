import { simulate } from '@weavesmith/core';
import type { Pattern } from '@weavesmith/core';

export interface SVGOptions {
  /** Side of one woven cell, in pixels. */
  cell?: number;
}

/**
 * Side of one exported cell. The SVG is vector, so this is not a resolution
 * choice — it is the size a viewer opens the file at, and 16px made the
 * default band 128px wide, which reads as a thumbnail of itself.
 */
const DEFAULT_CELL = 32;

/** Roughly how long the exported PNG's longest edge should be, in pixels. */
export const PNG_TARGET_EDGE = 2000;

/** Ceiling on the upscale, so a four-card sampler is not blown up absurdly. */
export const MAX_PNG_SCALE = 8;

/**
 * How long to wait for the browser to decode the SVG before giving up.
 *
 * `Image` is only guaranteed to fire `load` or `error` in practice, not in
 * principle — and a promise that never settles leaves the Export PNG button
 * silently dead, with no report, which is the one outcome this module exists
 * to avoid. Generous enough that a large band on a slow machine finishes
 * first; the timeout is a backstop, not a budget.
 */
export const PNG_TIMEOUT = 15_000;

/**
 * How much to scale an SVG of this size so its long edge lands near
 * `PNG_TARGET_EDGE`.
 *
 * A fixed multiplier cannot serve both ends of the range this app allows: 2x
 * of a 4-card sampler is still a thumbnail, and 2x of a 40-card belt at 200
 * picks is an image no viewer will open. Scaling to the long edge makes both
 * come out usefully big without a control to explain.
 */
export function pngScaleFor(width: number, height: number): number {
  const longest = Math.max(width, height);
  if (!Number.isFinite(longest) || longest <= 0) return 1;
  return Math.min(PNG_TARGET_EDGE / longest, MAX_PNG_SCALE);
}

/**
 * Trims binary floating-point noise off a coordinate: a fractional `cell`
 * turns 7 x 10.3 into 72.10000000000001, which is both ugly in the output
 * and a needless precision claim about a thread's position.
 */
const num = (value: number): string => String(Number(value.toFixed(3)));

const escapeXML = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Perceived lightness of a `#rrggbb` colour, 0–1. Used only to decide
 * whether the lean stroke should be drawn light or dark — a fixed stroke
 * colour disappears against half the palette, and walnut next to undyed
 * wool is exactly that case.
 */
function lightness(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 1;
  const value = Number.parseInt(match[1]!, 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  // Rec. 601 luma: close enough for a contrast decision, and no colour
  // science dependency for something this small.
  return (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255;
}

/**
 * The woven band as a standalone SVG document, built as a string so it
 * needs no DOM and stays testable in Node.
 *
 * One `<rect>` per cell in its thread colour, plus a diagonal `<path>` for
 * the way that stitch leans. The lean is not decoration: a threaded-in band
 * reads as chevrons and diagonals precisely because neighbouring cards lean
 * opposite ways, and a grid of flat colour would be a different picture.
 */
export function bandToSVG(pattern: Pattern, options: SVGOptions = {}): string {
  const cell = options.cell ?? DEFAULT_CELL;
  const grid = simulate(pattern);
  const width = pattern.cards.length * cell;
  const height = pattern.picks.length * cell;

  const parts: string[] = [];
  grid.forEach((row, pick) => {
    row.forEach((woven, card) => {
      const x = card * cell;
      const y = pick * cell;
      const fill = pattern.palette[woven.color] ?? '#000000';
      parts.push(
        `<rect x="${num(x)}" y="${num(y)}" width="${num(cell)}" height="${num(cell)}" ` +
          `fill="${escapeXML(fill)}"/>`,
      );
      // `/` runs bottom-left to top-right; `\` the other way. Inset so the
      // stroke reads as a stitch on the cell rather than a grid line
      // between cells.
      const inset = cell * 0.18;
      const [x1, y1, x2, y2] =
        woven.lean === '/'
          ? [x + inset, y + cell - inset, x + cell - inset, y + inset]
          : [x + inset, y + inset, x + cell - inset, y + cell - inset];
      const stroke = lightness(fill) < 0.5 ? '#ffffff' : '#000000';
      parts.push(
        `<path data-lean="${woven.lean === '/' ? '/' : '\\'}" ` +
          `d="M${num(x1)} ${num(y1)}L${num(x2)} ${num(y2)}" ` +
          `stroke="${stroke}" stroke-opacity="0.35" stroke-width="${(cell * 0.16).toFixed(2)}" ` +
          `stroke-linecap="round"/>`,
      );
    });
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(height)}" ` +
    `viewBox="0 0 ${num(width)} ${num(height)}" role="img">` +
    `<title>${escapeXML(pattern.meta.name)}</title>` +
    parts.join('') +
    `</svg>`
  );
}

/** MIME type for the SVG blobs this module produces. */
export const SVG_TYPE = 'image/svg+xml;charset=utf-8';

/**
 * Rasterises an SVG string to a PNG blob by drawing it into a canvas.
 *
 * Needs a real browser: jsdom has neither an image decoder nor a canvas
 * backend. Every failure path rejects rather than resolving with something
 * empty, so a caller can say what went wrong instead of handing the weaver
 * a 0-byte file.
 */
export function svgToPNG(svg: string, options: SVGOptions & { scale?: number } = {}): Promise<Blob> {
  // Each attribute looked up on its own, and decimals allowed. The previous
  // single pattern required `width` and `height` to be adjacent, in that
  // order, and integral — so it rejected both a fractional `cell` from this
  // very module and almost any SVG written by anything else, with the
  // misleading complaint that the document was not an SVG.
  const dimension = (name: 'width' | 'height'): number | null => {
    const match = new RegExp(`\\b${name}="([0-9]*\\.?[0-9]+)(?:px)?"`).exec(svg);
    return match ? Number(match[1]) : null;
  };
  const parsedWidth = dimension('width');
  const parsedHeight = dimension('height');
  if (parsedWidth === null || parsedHeight === null || parsedWidth <= 0 || parsedHeight <= 0) {
    return Promise.reject(new Error('This does not look like an SVG document.'));
  }
  const natural = { width: parsedWidth, height: parsedHeight };
  const scale = options.scale ?? pngScaleFor(natural.width, natural.height);
  const width = Math.max(1, Math.round(natural.width * scale));
  const height = Math.max(1, Math.round(natural.height * scale));

  return new Promise<Blob>((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: SVG_TYPE }));
    const image = new Image();
    let settled = false;

    const timer = setTimeout(() => {
      fail('The band took too long to draw. Try the SVG export instead.');
    }, PNG_TIMEOUT);

    const finish = () => {
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    };

    function fail(reason: string) {
      if (settled) return;
      finish();
      reject(new Error(reason));
    }

    const succeed = (blob: Blob) => {
      if (settled) return;
      finish();
      resolve(blob);
    };

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return fail('This browser cannot draw to a canvas.');
      context.drawImage(image, 0, 0, width, height);
      if (typeof canvas.toBlob !== 'function') {
        return fail('This browser cannot turn the band into a PNG.');
      }
      canvas.toBlob((blob) => {
        if (blob) succeed(blob);
        else fail('This browser cannot turn the band into a PNG.');
      }, 'image/png');
    };
    image.onerror = () => fail('The band could not be drawn as an image.');
    image.src = url;
  });
}
