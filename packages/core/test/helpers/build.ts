import type { Card, Pattern, Threading, Turn } from '../../src/index.js';

export const PALETTE = ['#4B3826', '#B4402C', '#2F5F8F', '#D8A62B', '#EADCC0'];
export const WALNUT = 0, MADDER = 1, WOAD = 2, WELD = 3, CREAM = 4;

export function card(
  colors: [number, number, number, number],
  threading: Threading = 'S',
): Card {
  return { colors, threading, start: 0 };
}

/** A band of `cards`, `picks` picks long, every card turning forward. */
export function buildPattern(cards: Card[], picks: number): Pattern {
  return {
    version: 1,
    meta: { name: 'test' },
    palette: [...PALETTE],
    cards,
    picks: Array.from({ length: picks }, () =>
      cards.map(() => 1 as Turn),
    ),
  };
}
