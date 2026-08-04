import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../../src/board/Board.js';
import { MAX_CELL } from '../../src/board/sizing.js';
import { useStore } from '../../src/state/store.js';

/**
 * jsdom's stub ResizeObserver (test/setup.ts) never reports a size, because
 * there is no layout to report. This one hands the board a width the moment
 * it is observed, which is the only way to exercise growth under jsdom.
 */
function stubWidth(width: number) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback(
          [{ contentRect: { width } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

const cellWidth = () => screen.getByRole('grid').style.getPropertyValue('--cell-w');
const cellHeight = () => screen.getByRole('grid').style.getPropertyValue('--cell-h');

describe('cells growing into the available width', () => {
  beforeEach(() => useStore.getState().reset());
  afterEach(() => vi.unstubAllGlobals());

  it('grows the cells when the window has room to spare', () => {
    stubWidth(1200);
    render(<Board />);
    // The default band is 8 cards at a natural 42px, so a 1200px board has
    // room for far more — growth stops at the ceiling instead.
    expect(cellWidth()).toBe(`${MAX_CELL}px`);
  });

  it('keeps the cell proportions while growing', () => {
    // 42x34 is the board's cell; a band whose stitches change shape with the
    // window is a different picture, not a bigger one.
    stubWidth(1200);
    render(<Board />);
    const grown = { w: Number.parseInt(cellWidth(), 10), h: Number.parseInt(cellHeight(), 10) };
    expect(grown.w / grown.h).toBeCloseTo(42 / 34, 1);
  });

  it('leaves a board with no room to spare exactly as it was', () => {
    stubWidth(300);
    render(<Board />);
    expect(cellWidth()).toBe('42px');
    expect(cellHeight()).toBe('34px');
  });

  it('does not shrink below the card-count size, however narrow the window', () => {
    // Shrinking stays card-count's job down to the 28px floor, past which
    // the board scrolls on purpose. Measuring must not add a second rule
    // that undercuts it.
    stubWidth(80);
    render(<Board />);
    expect(cellWidth()).toBe('42px');
  });

  it('grows a 40-card band too, once it has the width for it', () => {
    const pattern = useStore.getState().pattern;
    useStore.getState().load({
      ...pattern,
      cards: Array.from({ length: 40 }, (_, i) => pattern.cards[i % pattern.cards.length]!),
      picks: pattern.picks.map((row) => Array.from({ length: 40 }, (_, i) => row[i % row.length]!)),
    });
    // 40 cards sit at the 28px tier: natural width is 40 + 40*28 = 1160.
    stubWidth(2320);
    render(<Board />);
    expect(Number.parseInt(cellWidth(), 10)).toBeGreaterThan(28);
  });
});
