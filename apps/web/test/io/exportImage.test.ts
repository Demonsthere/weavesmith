import { describe, expect, it, vi } from 'vitest';
import { bandToSVG, svgToPNG } from '../../src/io/exportImage.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

describe('bandToSVG', () => {
  it('produces a standalone SVG document', () => {
    const svg = bandToSVG(defaultPattern());
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('sizes the canvas to the band', () => {
    const pattern = defaultPattern();
    const svg = bandToSVG(pattern, { cell: 10 });
    expect(svg).toContain(`width="${pattern.cards.length * 10}"`);
    expect(svg).toContain(`height="${pattern.picks.length * 10}"`);
  });

  it('draws one shape per cell', () => {
    const pattern = defaultPattern();
    const svg = bandToSVG(pattern);
    const shapes = svg.match(/<rect|<path/g) ?? [];
    expect(shapes.length).toBeGreaterThanOrEqual(pattern.cards.length * pattern.picks.length);
  });

  it('embeds the palette colours', () => {
    const pattern = defaultPattern();
    const svg = bandToSVG(pattern);
    expect(svg).toContain(pattern.palette[1]!);
  });

  it('escapes the pattern name in the title', () => {
    const pattern = { ...defaultPattern(), meta: { name: 'a <b> & c' } };
    const svg = bandToSVG(pattern);
    expect(svg).toContain('a &lt;b&gt; &amp; c');
    expect(svg).not.toContain('<b>');
  });

  it('draws the lean each way round', () => {
    // The band is only readable because the stitches lean; a grid of flat
    // colour is a different (and wrong) picture. The default band is
    // threaded half S and half Z, so both leans must appear.
    const svg = bandToSVG(defaultPattern());
    expect(svg).toContain('data-lean="/"');
    expect(svg).toContain('data-lean="\\"');
  });

  it('is parseable XML, not just a string that looks like it', () => {
    const svg = bandToSVG({ ...defaultPattern(), meta: { name: 'a <b> & c' } });
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(parsed.querySelector('parsererror')).toBeNull();
    expect(parsed.querySelector('title')?.textContent).toBe('a <b> & c');
  });
});

describe('svgToPNG', () => {
  it('rejects a string that is not an SVG document', async () => {
    // Interface only: rasterising needs a real browser. What is worth
    // pinning here is that a failure surfaces as a rejection, so a caller
    // can report it, instead of a promise that never settles.
    await expect(svgToPNG('not an svg at all')).rejects.toThrow(/does not look like an SVG/i);
  });

  it('rejects when the image will not decode', async () => {
    vi.stubGlobal(
      'Image',
      class {
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    await expect(svgToPNG(bandToSVG(defaultPattern()))).rejects.toThrow(/could not be drawn/i);
    vi.unstubAllGlobals();
  });

  it('revokes the object URL even when it fails', async () => {
    // The blob is the whole band; leaking one per failed export would pin
    // them all in memory for the life of the page.
    const revoked = vi.spyOn(URL, 'revokeObjectURL');
    vi.stubGlobal(
      'Image',
      class {
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    await expect(svgToPNG(bandToSVG(defaultPattern()))).rejects.toThrow();
    expect(revoked).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    revoked.mockRestore();
  });
});
