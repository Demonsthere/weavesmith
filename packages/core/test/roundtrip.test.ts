import { describe, expect, it } from 'vitest';
import { simulate, solveTurns } from '../src/index.js';
import type { Card, Pattern, Threading, Turn } from '../src/index.js';
import { PALETTE } from './helpers/build.js';

/** Deterministic PRNG so a failure is reproducible from its seed. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
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
    const target = simulate(pattern).map((row) => row.map((cell) => cell.color));

    const result = solveTurns(pattern.cards, target, { previous: pattern.picks });

    expect(result.unreachable).toEqual([]);
    expect(simulate({ ...pattern, picks: result.picks })).toEqual(simulate(pattern));
  });

  it('returns exactly the original turns when seeded with them', () => {
    const pattern = randomPattern(42);
    const target = simulate(pattern).map((row) => row.map((cell) => cell.color));
    const result = solveTurns(pattern.cards, target, { previous: pattern.picks });
    expect(result.picks).toEqual(pattern.picks);
  });
});
