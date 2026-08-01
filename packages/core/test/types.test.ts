import { describe, expect, it } from 'vitest';
import { HOLE_COUNT, HOLE_LABELS, MAX_CARDS, MIN_CARDS } from '../src/index.js';

describe('constants', () => {
  it('describes a tablet-weaving card', () => {
    expect(HOLE_COUNT).toBe(4);
    expect(HOLE_LABELS).toEqual(['A', 'B', 'C', 'D']);
  });

  it('bounds a band at 4 to 40 cards', () => {
    expect(MIN_CARDS).toBe(4);
    expect(MAX_CARDS).toBe(40);
  });
});
