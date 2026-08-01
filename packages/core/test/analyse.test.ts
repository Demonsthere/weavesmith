import { describe, expect, it } from 'vitest';
import { gcPalette, netTwist, threadCounts } from '../src/index.js';
import { buildPattern, card, CREAM, MADDER, WALNUT } from './helpers/build.js';
import type { Turn } from '../src/index.js';

describe('netTwist', () => {
  it('counts accumulated turns per card', () => {
    const pattern = buildPattern([card([0, 1, 2, 3]), card([0, 1, 2, 3])], 6);
    pattern.picks = pattern.picks.map(() => [1, -1] as Turn[]);
    expect(netTwist(pattern)).toEqual([6, -6]);
  });

  it('returns zero for a card that turns back as often as forward', () => {
    const pattern = buildPattern([card([0, 1, 2, 3])], 4);
    pattern.picks = [[1], [1], [-1], [-1]];
    expect(netTwist(pattern)).toEqual([0]);
  });

  it('returns a zero per card for a band with no picks', () => {
    const pattern = buildPattern([card([0, 1, 2, 3]), card([0, 1, 2, 3])], 0);
    expect(netTwist(pattern)).toEqual([0, 0]);
  });
});

describe('threadCounts', () => {
  it('counts warp threads by colour across every card', () => {
    const pattern = buildPattern(
      [card([WALNUT, WALNUT, MADDER, MADDER]), card([CREAM, CREAM, CREAM, CREAM])],
      1,
    );
    const counts = threadCounts(pattern);
    expect(counts.perColor[WALNUT]).toBe(2);
    expect(counts.perColor[MADDER]).toBe(2);
    expect(counts.perColor[CREAM]).toBe(4);
    expect(counts.cards).toBe(2);
    expect(counts.warpEnds).toBe(8);
  });

  it('omits colours the band does not use', () => {
    const pattern = buildPattern([card([WALNUT, WALNUT, WALNUT, WALNUT])], 1);
    expect(threadCounts(pattern).perColor).toEqual({ [WALNUT]: 4 });
  });
});

describe('gcPalette', () => {
  it('drops unused colours and renumbers the cards', () => {
    const pattern = buildPattern([card([1, 1, 3, 3])], 2);
    // palette has 5 entries; only indices 1 and 3 are used
    const cleaned = gcPalette(pattern);
    expect(cleaned.palette).toEqual(['#B4402C', '#D8A62B']);
    expect(cleaned.cards[0]!.colors).toEqual([0, 0, 1, 1]);
  });

  it('leaves a pattern that uses everything untouched', () => {
    const pattern = buildPattern([card([0, 1, 2, 3])], 1);
    pattern.palette = pattern.palette.slice(0, 4);
    expect(gcPalette(pattern)).toEqual(pattern);
  });

  it('does not mutate the pattern it is given', () => {
    const pattern = buildPattern([card([1, 1, 3, 3])], 1);
    const before = JSON.stringify(pattern);
    gcPalette(pattern);
    expect(JSON.stringify(pattern)).toBe(before);
  });
});
