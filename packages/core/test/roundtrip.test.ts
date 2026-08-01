import { describe, expect, it } from 'vitest';
import { MIN_CARDS, simulate, solveTurns, targetOf } from '../src/index.js';
import type { Card, Pattern, Threading, Turn } from '../src/index.js';
import { PALETTE } from './helpers/build.js';

/** Deterministic PRNG so a failure is reproducible from its seed. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  // The generator is linear: with `state = seed`, the value after n steps is
  // an affine function of the seed, `seed * A^n + K_n (mod 2^32)`, for every
  // n, not just the first. Consecutive seeds only spread well when
  // `A^n mod 2^32` isn't close to a low-denominator fraction of the modulus.
  // n=1 (slope ~0.0004) is the bad one the review caught for cardCount. Three
  // discards moves cardCount to n=4 (fine, slope ~0.037) but lands pickCount
  // on n=5 — slope ~0.6665, so close to 2/3 that 200 seeds barely drift off
  // three fixed lanes. Verified empirically (see task-9-report.md): five
  // discards puts cardCount at n=6 and pickCount at n=7, both far enough from
  // any simple fraction to spread over their full ranges. Don't assume a
  // discard count fixes this — check the resulting distribution.
  next();
  next();
  next();
  next();
  next();
  return next;
}

function randomPattern(seed: number): Pattern {
  const random = rng(seed);
  const cardCount = 4 + Math.floor(random() * 16);
  const pickCount = 1 + Math.floor(random() * 40);

  const cards: Card[] = Array.from({ length: cardCount }, () => ({
    colors: [0, 1, 2, 3].map(() => Math.floor(random() * PALETTE.length)) as
      [number, number, number, number],
    threading: (random() < 0.5 ? 'S' : 'Z') as Threading,
    start: Math.floor(random() * 4) as 0 | 1 | 2 | 3,
  }));

  return {
    version: 1,
    meta: { name: `seed-${seed}` },
    palette: PALETTE,
    cards,
    picks: Array.from({ length: pickCount }, () =>
      cards.map(() => (random() < 0.5 ? 1 : -1) as Turn),
    ),
  };
}

describe('solve/simulate round trip', () => {
  const seeds = Array.from({ length: 200 }, (_, i) => i + 1);

  it.each(seeds)('reproduces the band for seed %i', (seed) => {
    const pattern = randomPattern(seed);
    const target = targetOf(simulate(pattern));

    const result = solveTurns(pattern.cards, target, { previous: pattern.picks });

    expect(result.unreachable).toEqual([]);
    expect(simulate({ ...pattern, picks: result.picks })).toEqual(simulate(pattern));
  });

  it('returns exactly the original turns when seeded with them', () => {
    const pattern = randomPattern(42);
    const target = targetOf(simulate(pattern));
    const result = solveTurns(pattern.cards, target, { previous: pattern.picks });
    expect(result.picks).toEqual(pattern.picks);
  });

  // The generator caught a real bug once already (see the comment on `rng`
  // above): a linear congruential generator can quietly stop varying one of
  // its outputs across consecutive seeds while everything downstream looks
  // fine. This test is the guard against that happening again, silently, to
  // either dimension the 200 seeds are supposed to cover.
  it('varies band width and length widely across the 200 seeds', () => {
    const cardCounts = new Set<number>();
    const pickCounts = new Set<number>();
    let sawDuplicateColorCard = false;

    for (const seed of seeds) {
      const pattern = randomPattern(seed);
      cardCounts.add(pattern.cards.length);
      pickCounts.add(pattern.picks.length);
      if (pattern.cards.some((c) => new Set(c.colors).size < c.colors.length)) {
        sawDuplicateColorCard = true;
      }
    }

    // cardCount = 4 + floor(random() * 16), so the true range is [4, 19].
    expect(Math.min(...cardCounts)).toBe(MIN_CARDS);
    expect(Math.max(...cardCounts)).toBeGreaterThanOrEqual(17);
    expect(cardCounts.size).toBeGreaterThan(8);

    // pickCount = 1 + floor(random() * 40), so the true range is [1, 40].
    expect(Math.max(...pickCounts)).toBeGreaterThanOrEqual(30);
    expect(pickCounts.size).toBeGreaterThan(15);

    // Duplicate-colour cards are the case `previous` exists to disambiguate;
    // if the generator stopped producing them, that motivating case would
    // go untested without anything failing to say so.
    expect(sawDuplicateColorCard).toBe(true);
  });
});
