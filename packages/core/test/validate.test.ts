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

  it('rejects a non-integer start rotation', () => {
    const pattern = valid();
    (pattern.cards[0] as { start: number }).start = 2.5;
    expect(validatePattern(pattern)).toContain('card 1: start must be 0-3, found 2.5');
  });

  it('rejects a non-integer colour index', () => {
    const pattern = valid();
    (pattern.cards[0]!.colors as number[])[3] = 1.5;
    expect(validatePattern(pattern))
      .toContain('card 1, hole D: colour 1.5 is not in the palette');
  });

  it('rejects NaN as a colour index', () => {
    const pattern = valid();
    (pattern.cards[0]!.colors as number[])[3] = NaN;
    expect(validatePattern(pattern))
      .toContain('card 1, hole D: colour NaN is not in the palette');
  });

  it('rejects a palette entry that is not a string', () => {
    const pattern = valid();
    (pattern.palette as unknown[])[0] = 123;
    expect(validatePattern(pattern))
      .toContain('palette entry 1 must be a string, found 123');
  });

  // Array.prototype.forEach skips holes entirely — it never calls back for
  // a missing index — so a sparse array sailed through every one of these
  // element checks: the loop body simply never ran for the hole. Each of
  // these four failed before validate.ts's loops were normalised with
  // Array.from (which turns a hole into an actual `undefined` element that
  // the existing type checks then reject).
  describe('sparse arrays', () => {
    it('rejects a sparse colours array', () => {
      const pattern = valid();
      delete (pattern.cards[0]!.colors as number[])[1];
      expect(validatePattern(pattern))
        .toContain('card 1, hole B: colour undefined is not in the palette');
    });

    it('rejects a sparse picks row', () => {
      const pattern = valid();
      delete (pattern.picks[0] as unknown[])[1];
      expect(validatePattern(pattern))
        .toContain('pick 1, card 2: turn must be 1 or -1, found undefined');
    });

    it('rejects a sparse cards array', () => {
      const pattern = valid();
      delete (pattern.cards as unknown[])[1];
      expect(validatePattern(pattern)).toContain('card 2 must be an object');
    });

    it('rejects a sparse palette', () => {
      const pattern = valid();
      delete (pattern.palette as unknown[])[1];
      expect(validatePattern(pattern))
        .toContain('palette entry 2 must be a string, found undefined');
    });
  });

  describe('meta', () => {
    it('rejects a pattern with no meta at all', () => {
      const pattern = valid() as Record<string, unknown>;
      delete pattern.meta;
      expect(validatePattern(pattern)).toContain('meta must be an object');
    });

    it('rejects a meta that is not an object', () => {
      expect(validatePattern({ ...valid(), meta: 'hello' }))
        .toContain('meta must be an object');
    });

    it('rejects a meta that is an array', () => {
      expect(validatePattern({ ...valid(), meta: [] }))
        .toContain('meta must be an object');
    });

    it('rejects a meta whose name is not a string', () => {
      expect(validatePattern({ ...valid(), meta: { name: 123 } }))
        .toContain('meta.name must be a string');
    });

    it('rejects a meta whose author is not a string, when present', () => {
      expect(validatePattern({ ...valid(), meta: { name: 'x', author: 123 } }))
        .toContain('meta.author must be a string');
    });

    it('rejects a meta whose notes is not a string, when present', () => {
      expect(validatePattern({ ...valid(), meta: { name: 'x', notes: 123 } }))
        .toContain('meta.notes must be a string');
    });

    it('accepts a meta with only name, and with name/author/notes all present', () => {
      expect(validatePattern({ ...valid(), meta: { name: 'x' } })).toEqual([]);
      expect(validatePattern({ ...valid(), meta: { name: 'x', author: 'a', notes: 'n' } }))
        .toEqual([]);
    });
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

    // A hostile toString is caught by JSON.stringify not needing to call it
    // for plain objects. A Proxy that throws on *any* property access is a
    // strictly harder case: it defeats JSON.stringify (which reads `toJSON`)
    // AND the fallback Object.prototype.toString (which reads
    // `Symbol.toStringTag`). Exercised on a field other than `version`, since
    // the exposure is at all five call sites, not just that one.
    it('for a hostile Proxy that throws on every property access', () => {
      const pattern = valid();
      const proxy = new Proxy(
        {},
        {
          get() {
            throw new Error('boom');
          },
        },
      );
      (pattern.cards[0] as { threading: unknown }).threading = proxy;
      expect(() => validatePattern(pattern)).not.toThrow();
      const problems = validatePattern(pattern);
      expect(problems.some((p) => p.includes('threading must be S or Z'))).toBe(true);
    });

    // JSON.stringify(value) is `undefined` (not the string "undefined") for
    // some inputs, e.g. an object with an explicit toJSON returning
    // undefined, or a bare function/symbol. describe() must not let that
    // undefined leak into the message as the literal text "undefined".
    it('for a value whose JSON.stringify is undefined', () => {
      const pattern: unknown = {
        ...valid(),
        version: { toJSON: () => undefined },
      };
      expect(() => validatePattern(pattern)).not.toThrow();
      const problems = validatePattern(pattern);
      const message = problems.find((p) => p.startsWith('unsupported version'));
      expect(message).toBeDefined();
      expect(message).not.toContain('undefined');
    });

    it('for a function or symbol as version', () => {
      const asFunction: unknown = { ...valid(), version: () => 1 };
      expect(() => validatePattern(asFunction)).not.toThrow();
      const functionProblems = validatePattern(asFunction);
      expect(functionProblems.some((p) => p.startsWith('unsupported version'))).toBe(true);

      const asSymbol: unknown = { ...valid(), version: Symbol('v') };
      expect(() => validatePattern(asSymbol)).not.toThrow();
      const symbolProblems = validatePattern(asSymbol);
      expect(symbolProblems.some((p) => p.startsWith('unsupported version'))).toBe(true);
    });

    // A revoked Proxy throws at the bare `Array.isArray` type predicate
    // itself (IsArray checks revocation before any trap runs), before
    // describe() is ever reached. No individual guard can catch this — only
    // the outer try/catch around the whole of validatePattern can, which is
    // exactly what the fallback below is for.
    it('for a revoked Proxy as cards', () => {
      const { proxy, revoke } = Proxy.revocable([], {});
      revoke();
      const pattern: unknown = { ...valid(), cards: proxy };
      expect(() => validatePattern(pattern)).not.toThrow();
      expect(validatePattern(pattern).length).toBeGreaterThan(0);
    });

    it('for a revoked Proxy as picks', () => {
      const { proxy, revoke } = Proxy.revocable([], {});
      revoke();
      const pattern: unknown = { ...valid(), picks: proxy };
      expect(() => validatePattern(pattern)).not.toThrow();
      expect(validatePattern(pattern).length).toBeGreaterThan(0);
    });

    it('for a revoked Proxy as the whole pattern value', () => {
      const { proxy, revoke } = Proxy.revocable({}, {});
      revoke();
      expect(() => validatePattern(proxy)).not.toThrow();
      expect(validatePattern(proxy).length).toBeGreaterThan(0);
    });

    // The outer try/catch must not be quietly swallowing a real failure in
    // the existing checks: a genuinely valid pattern must still take the
    // normal path all the way through and come back empty, not fall into
    // the catch and return the fallback problem.
    it('still returns [] for a genuinely valid pattern', () => {
      expect(validatePattern(valid())).toEqual([]);
    });
  });
});
