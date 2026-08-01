import { describe, expect, it } from 'vitest';
import { validatePattern } from '../src/index.js';
import { buildPattern, card } from './helpers/build.js';

const valid = () => buildPattern([card([0, 1, 2, 3]), card([0, 1, 2, 3]),
                                  card([0, 1, 2, 3]), card([0, 1, 2, 3])], 4);

describe('validatePattern', () => {
  it('accepts a well-formed pattern', () => {
    expect(validatePattern(valid())).toEqual([]);
  });

  it('rejects anything that is not an object', () => {
    expect(validatePattern(null)).toContain('pattern must be an object');
    expect(validatePattern('nope')).toContain('pattern must be an object');
  });

  it('rejects an unknown version', () => {
    expect(validatePattern({ ...valid(), version: 2 }))
      .toContain('unsupported version 2, expected 1');
  });

  it('rejects a band narrower than four cards', () => {
    const pattern = valid();
    pattern.cards = pattern.cards.slice(0, 3);
    pattern.picks = pattern.picks.map((row) => row.slice(0, 3));
    expect(validatePattern(pattern)).toContain('a band needs at least 4 cards, found 3');
  });

  it('rejects a band wider than forty cards', () => {
    const pattern = valid();
    pattern.cards = Array.from({ length: 41 }, () => card([0, 1, 2, 3]));
    pattern.picks = [Array.from({ length: 41 }, () => 1 as const)];
    expect(validatePattern(pattern)).toContain('a band takes at most 40 cards, found 41');
  });

  it('rejects a ragged pick matrix', () => {
    const pattern = valid();
    pattern.picks[1] = [1, 1];
    expect(validatePattern(pattern))
      .toContain('pick 2 has 2 turns but the band has 4 cards');
  });

  it('rejects a turn that is not 1 or -1', () => {
    const pattern = valid();
    (pattern.picks[0] as number[])[0] = 0;
    expect(validatePattern(pattern))
      .toContain('pick 1, card 1: turn must be 1 or -1, found 0');
  });

  it('rejects a colour index outside the palette', () => {
    const pattern = valid();
    pattern.cards[0]!.colors[2] = 99;
    expect(validatePattern(pattern))
      .toContain('card 1, hole C: colour 99 is not in the palette');
  });

  it('rejects a card without exactly four holes', () => {
    const pattern = valid();
    (pattern.cards[0] as { colors: number[] }).colors = [0, 1];
    expect(validatePattern(pattern)).toContain('card 1 must have 4 holes, found 2');
  });

  it('rejects an unknown threading direction', () => {
    const pattern = valid();
    (pattern.cards[0] as { threading: string }).threading = 'X';
    expect(validatePattern(pattern))
      .toContain('card 1: threading must be S or Z, found "X"');
  });

  it('rejects a start rotation outside 0-3', () => {
    const pattern = valid();
    (pattern.cards[0] as { start: number }).start = 7;
    expect(validatePattern(pattern)).toContain('card 1: start must be 0-3, found 7');
  });

  it('collects every problem rather than stopping at the first', () => {
    const pattern = valid();
    (pattern.cards[0] as { threading: string }).threading = 'X';
    (pattern.cards[1] as { start: number }).start = 9;
    expect(validatePattern(pattern)).toHaveLength(2);
  });

  // validatePattern's whole contract is "returns problems, never throws" —
  // including on values whose own toString is hostile. Guard the five spots
  // that render an unvalidated value into a message (version, colour,
  // threading, start, turn) against exactly that.
  describe('never throws, even when an offending value has a hostile toString', () => {
    class Throws {
      toString(): string {
        throw new Error('boom');
      }
    }

    it('for a bad version', () => {
      const pattern: unknown = { ...valid(), version: new Throws() };
      expect(() => validatePattern(pattern)).not.toThrow();
      const problems = validatePattern(pattern);
      expect(problems.some((p) => p.startsWith('unsupported version'))).toBe(true);
    });

    it('for a bad threading', () => {
      const pattern = valid();
      (pattern.cards[0] as { threading: unknown }).threading = new Throws();
      expect(() => validatePattern(pattern)).not.toThrow();
      const problems = validatePattern(pattern);
      expect(problems.some((p) => p.includes('threading must be S or Z'))).toBe(true);
    });

    it('for a bad turn', () => {
      const pattern = valid();
      (pattern.picks[0] as unknown[])[0] = new Throws();
      expect(() => validatePattern(pattern)).not.toThrow();
      const problems = validatePattern(pattern);
      expect(problems.some((p) => p.includes('turn must be 1 or -1'))).toBe(true);
    });
  });
});
