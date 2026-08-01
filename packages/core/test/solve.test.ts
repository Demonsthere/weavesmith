import { describe, expect, it } from 'vitest';
import { simulate, solveTurns } from '../src/index.js';
import type { Pattern, TargetGrid, Turn } from '../src/index.js';
import { buildPattern, card, MADDER, WALNUT, WELD, WOAD } from './helpers/build.js';

function targetFrom(pattern: Pattern): TargetGrid {
  return simulate(pattern).map((row) => row.map((cell) => cell.color));
}

describe('solveTurns', () => {
  it('reproduces any band that simulation produced', () => {
    const pattern = buildPattern(
      [card([WALNUT, MADDER, WOAD, WELD], 'S'), card([WALNUT, MADDER, WOAD, WELD], 'Z')],
      12,
    );
    pattern.picks = pattern.picks.map((row, t) =>
      row.map((_, c) => ((t + c) % 3 === 0 ? -1 : 1) as Turn),
    );

    const target = targetFrom(pattern);
    const result = solveTurns(pattern.cards, target);

    expect(result.unreachable).toEqual([]);
    expect(simulate({ ...pattern, picks: result.picks })).toEqual(simulate(pattern));
  });

  it('reports the cells it cannot reach instead of approximating', () => {
    // A card holding only two colours can never show a third.
    const cards = [card([WALNUT, WALNUT, MADDER, MADDER], 'S')];
    const target: TargetGrid = [[WOAD], [WALNUT]];

    const result = solveTurns(cards, target);

    expect(result.unreachable).toEqual([{ card: 0, pick: 0, wanted: WOAD }]);
    expect(result.picks).toHaveLength(2);
  });

  it('treats null as "any colour will do"', () => {
    const cards = [card([WALNUT, MADDER, WOAD, WELD], 'S')];
    const result = solveTurns(cards, [[null], [null], [null]]);
    expect(result.unreachable).toEqual([]);
    expect(result.picks).toHaveLength(3);
  });

  it('solves each card independently', () => {
    // Card 1 is satisfiable, card 0 is not. Card 1 must still be solved.
    const cards = [
      card([WALNUT, WALNUT, WALNUT, WALNUT], 'S'),
      card([WALNUT, MADDER, WOAD, WELD], 'S'),
    ];
    const target: TargetGrid = [[MADDER, MADDER]];

    const result = solveTurns(cards, target);

    expect(result.unreachable).toEqual([{ card: 0, pick: 0, wanted: MADDER }]);
    const band = simulate({
      ...buildPattern(cards, 1),
      picks: result.picks,
    });
    expect(band[0]![1]!.color).toBe(MADDER);
  });

  it('honours each card\'s start rotation', () => {
    const cards = [{ ...card([WALNUT, MADDER, WOAD, WELD], 'S'), start: 2 as const }];
    const result = solveTurns(cards, [[WELD]]);
    expect(result.unreachable).toEqual([]);
    expect(result.picks[0]![0]).toBe(1); // rotation 2 -> 3 -> hole D
  });

  it('returns a rectangular pick matrix', () => {
    const cards = [card([0, 1, 2, 3]), card([0, 1, 2, 3]), card([0, 1, 2, 3])];
    const result = solveTurns(cards, [[null, null, null], [null, null, null]]);
    for (const row of result.picks) expect(row).toHaveLength(3);
  });
});
