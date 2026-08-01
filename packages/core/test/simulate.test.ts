import { describe, expect, it } from 'vitest';
import { simulate } from '../src/index.js';
import { buildPattern, card, CREAM, MADDER, WALNUT, WELD, WOAD } from './helpers/build.js';

describe('simulate', () => {
  it('returns a grid of picks by cards', () => {
    const pattern = buildPattern([card([0, 1, 2, 3]), card([0, 1, 2, 3])], 5);
    const grid = simulate(pattern);
    expect(grid).toHaveLength(5);
    expect(grid[0]).toHaveLength(2);
  });

  it('cycles an S card through its holes B, C, D, A when turning forward', () => {
    // start = 0, so the first pick advances to rotation 1 = hole B.
    const pattern = buildPattern([card([WALNUT, MADDER, WOAD, WELD], 'S')], 4);
    const colors = simulate(pattern).map((row) => row[0]!.color);
    expect(colors).toEqual([MADDER, WOAD, WELD, WALNUT]);
  });

  it('cycles a Z card through its holes in the opposite order', () => {
    const pattern = buildPattern([card([WALNUT, MADDER, WOAD, WELD], 'Z')], 4);
    const colors = simulate(pattern).map((row) => row[0]!.color);
    expect(colors).toEqual([WELD, WOAD, MADDER, WALNUT]);
  });

  it('returns to the starting thread every four picks', () => {
    const pattern = buildPattern([card([WALNUT, MADDER, WOAD, WELD])], 8);
    const colors = simulate(pattern).map((row) => row[0]!.color);
    expect(colors.slice(0, 4)).toEqual(colors.slice(4, 8));
  });

  it('leans every stitch the same way when every card turns forward with one threading', () => {
    const pattern = buildPattern([card([0, 1, 2, 3], 'S'), card([0, 1, 2, 3], 'S')], 3);
    const leans = simulate(pattern).flatMap((row) => row.map((c) => c.lean));
    expect(new Set(leans).size).toBe(1);
  });

  it('mirrors the lean between an S card and a Z card on the same pick', () => {
    const pattern = buildPattern([card([0, 1, 2, 3], 'S'), card([0, 1, 2, 3], 'Z')], 1);
    const [row] = simulate(pattern);
    expect(row![0]!.lean).not.toBe(row![1]!.lean);
  });

  it('holds a card still on the band when its turns alternate', () => {
    const pattern = buildPattern([card([WALNUT, MADDER, WOAD, WELD])], 4);
    pattern.picks = [[1], [-1], [1], [-1]];
    const colors = simulate(pattern).map((row) => row[0]!.color);
    // forward to B, back to A, forward to B, back to A
    expect(colors).toEqual([MADDER, WALNUT, MADDER, WALNUT]);
  });

  it('does not mutate the pattern it is given', () => {
    const pattern = buildPattern([card([0, 1, 2, 3])], 3);
    const before = JSON.stringify(pattern);
    simulate(pattern);
    expect(JSON.stringify(pattern)).toBe(before);
  });

  it('respects a non-zero start rotation', () => {
    const pattern = buildPattern([card([WALNUT, MADDER, WOAD, WELD])], 1);
    pattern.cards[0]!.start = 3;
    expect(simulate(pattern)[0]![0]!.color).toBe(WALNUT);
  });
});
