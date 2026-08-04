import { simulate } from '@weavesmith/core';
import type { Pattern } from '@weavesmith/core';

export interface SVGOptions {
  /** Side of one woven cell, in pixels. */
  cell?: number;
}

const DEFAULT_CELL = 16;

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
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${escapeXML(fill)}"/>`,
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
        `<path data-lean="${woven.lean === '/' ? '/' : '\\'}" d="M${x1} ${y1}L${x2} ${y2}" ` +
          `stroke="${stroke}" stroke-opacity="0.35" stroke-width="${(cell * 0.16).toFixed(2)}" ` +
          `stroke-linecap="round"/>`,
      );
    });
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img">` +
    `<title>${escapeXML(pattern.meta.name)}</title>` +
    parts.join('') +
    `</svg>`
  );
}

/** File name stem shared by every export of one band. */
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
  const scale = options.scale ?? 2;
  const size = /width="(\d+)" height="(\d+)"/.exec(svg);
  if (!size) return Promise.reject(new Error('This does not look like an SVG document.'));
  const width = Number(size[1]) * scale;
  const height = Number(size[2]) * scale;

  return new Promise<Blob>((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: SVG_TYPE }));
    const image = new Image();

    const fail = (reason: string) => {
      URL.revokeObjectURL(url);
      reject(new Error(reason));
    };

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return fail('This browser cannot draw to a canvas.');
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      if (typeof canvas.toBlob !== 'function') {
        return reject(new Error('This browser cannot turn the band into a PNG.'));
      }
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('This browser cannot turn the band into a PNG.'));
      }, 'image/png');
    };
    image.onerror = () => fail('The band could not be drawn as an image.');
    image.src = url;
  });
}
