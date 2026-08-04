import { describe, expect, it } from 'vitest';
import { MAX_CELL, growthFactor } from '../../src/board/sizing.js';

describe('growthFactor', () => {
  it('never shrinks, however narrow the window', () => {
    // Shrinking is card-count's job, down to the spec's 28px floor, and past
    // that the board scrolls deliberately. A second, competing rule that
    // measured the window would undercut that floor.
    expect(growthFactor(320, 1000, 42)).toBe(1);
  });

  it('grows to use the room it is given', () => {
    // 1.25x, not 2x: at a 42px cell the 64px ceiling binds first, which is
    // the next test's job. This one is about the proportional part.
    expect(growthFactor(500, 400, 42)).toBeCloseTo(1.25, 5);
  });

  it('stops growing at the cell ceiling', () => {
    // A four-card band on a wide monitor must not become a handful of
    // enormous tiles — past a point it stops reading as a woven band.
    const factor = growthFactor(100_000, 400, 42);
    expect(factor * 42).toBeCloseTo(MAX_CELL, 5);
  });

  it('caps on the largest cell dimension, not the card axis alone', () => {
    // Cells are 42x34, and both dimensions scale together — so the ceiling
    // has to be measured against whichever is bigger, or the other one
    // sails past it.
    expect(growthFactor(100_000, 400, 34) * 34).toBeCloseTo(MAX_CELL, 5);
  });

  it('is 1 when the width cannot be measured', () => {
    // Before first layout, and in any environment without one, the board
    // must render exactly as it did before growth existed.
    for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(growthFactor(width, 400, 42)).toBe(1);
    }
  });

  it('is 1 when the band has no natural width to scale from', () => {
    expect(growthFactor(800, 0, 42)).toBe(1);
  });
});
