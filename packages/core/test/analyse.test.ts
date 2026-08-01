import { describe, expect, it } from 'vitest';
import { gcPalette, netTwist, PatternError, threadCounts, validatePattern } from '../src/index.js';
import { buildPattern, card, CREAM, MADDER, WALNUT } from './helpers/build.js';
import type { Pattern, Turn } from '../src/index.js';

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

  it('does not alias the input pattern\'s nested arrays', () => {
    const pattern = buildPattern([card([1, 1, 3, 3])], 1);
    const cleaned = gcPalette(pattern);

    // JSON.stringify equality cannot catch shared references: if `cleaned`
    // reused the input's arrays, mutating them here would corrupt `pattern`
    // too. Assert the objects are genuinely new, then prove it by mutating
    // the result and checking the input is untouched.
    //
    // gcPalette only rebuilds `cards[i].colors` and `palette` directly, so
    // asserting non-identity on just those two would pass even if `picks`
    // and `meta` were still the same references as the input (they are
    // spread in via `...pattern`, not rebuilt) — that aliasing is exactly
    // what let a web-app undo snapshot silently share history with the live
    // pattern. Check every nested reference, not only the two gc rebuilds.
    expect(cleaned.cards[0]!.colors).not.toBe(pattern.cards[0]!.colors);
    expect(cleaned.palette).not.toBe(pattern.palette);
    expect(cleaned.picks).not.toBe(pattern.picks);
    expect(cleaned.picks[0]).not.toBe(pattern.picks[0]);
    expect(cleaned.meta).not.toBe(pattern.meta);

    cleaned.cards[0]!.colors[0] = 99;
    cleaned.palette[0] = '#000000';
    cleaned.picks[0]![0] = -1;
    cleaned.meta.name = 'renamed';
    expect(pattern.cards[0]!.colors[0]).toBe(1);
    expect(pattern.palette[0]).toBe('#4B3826');
    expect(pattern.picks[0]![0]).toBe(1);
    expect(pattern.meta.name).toBe('test');
  });

  it('refuses to launder a pattern with an out-of-range colour index', () => {
    // A card colour that points past the palette is already invalid; gc
    // must not turn it into a clean-looking file with a missing colour.
    const pattern = buildPattern([card([0, 0, 0, 5])], 1);
    pattern.palette = ['#a', '#b'];
    expect(validatePattern(pattern))
      .toContain('card 1, hole D: colour 5 is not in the palette');
    expect(() => gcPalette(pattern)).toThrow(PatternError);
  });

  it('refuses a pattern with a non-string palette entry', () => {
    const pattern = buildPattern([card([0, 1, 2, 3])], 1);
    // Clone before mutating: `pattern.palette` is the shared PALETTE array
    // from the test helper, and mutating it in place would corrupt every
    // other test in this file that calls buildPattern() afterward.
    pattern.palette = [...pattern.palette];
    (pattern.palette as unknown[])[0] = null;
    expect(() => gcPalette(pattern)).toThrow(PatternError);
  });

  describe('always produces a pattern that still validates clean', () => {
    // MIN_CARDS is 4, so every shape here needs at least four cards for
    // `validatePattern(pattern)` to be [] in the first place — this property
    // is only meaningful starting from a genuinely valid pattern.
    const shapes: [string, Pattern][] = [
      [
        'sparse colour use',
        buildPattern(
          [card([1, 1, 3, 3]), card([1, 1, 3, 3]), card([1, 1, 3, 3]), card([1, 1, 3, 3])],
          2,
        ),
      ],
      [
        'every colour used already',
        buildPattern(
          [card([0, 1, 2, 3]), card([0, 1, 2, 3]), card([0, 1, 2, 3]), card([0, 1, 2, 3])],
          4,
        ),
      ],
      [
        'a single colour used by every hole',
        buildPattern(
          [card([4, 4, 4, 4]), card([4, 4, 4, 4]), card([4, 4, 4, 4]), card([4, 4, 4, 4])],
          1,
        ),
      ],
      [
        'meta with author and notes present',
        (() => {
          const pattern = buildPattern(
            [card([0, 1, 2, 3]), card([0, 1, 2, 3]), card([0, 1, 2, 3]), card([0, 1, 2, 3])],
            3,
          );
          pattern.meta = { name: 'x', author: 'a', notes: 'n' };
          return pattern;
        })(),
      ],
      [
        'no picks at all',
        buildPattern(
          [card([0, 1, 2, 3]), card([0, 1, 2, 3]), card([0, 1, 2, 3]), card([0, 1, 2, 3])],
          0,
        ),
      ],
    ];

    it.each(shapes)('%s', (_label, pattern) => {
      expect(validatePattern(pattern)).toEqual([]);
      const cleaned = gcPalette(pattern);
      expect(validatePattern(cleaned)).toEqual([]);
    });
  });
});
