import type { Card, Pattern, Threading, Turn } from '@weavesmith/core';

export const WOOL = ['#4B3826', '#B4402C', '#2F5F8F', '#D8A62B', '#EADCC0'];
const WALNUT = 0, MADDER = 1, WOAD = 2, WELD = 3, CREAM = 4;

const card = (colors: [number, number, number, number], threading: Threading): Card => ({
  colors,
  threading,
  start: 0,
});

export function defaultPattern(): Pattern {
  const cards: Card[] = [
    card([WALNUT, WALNUT, WALNUT, WALNUT], 'S'),
    card([CREAM, CREAM, MADDER, MADDER], 'S'),
    card([CREAM, CREAM, MADDER, MADDER], 'S'),
    card([CREAM, WELD, WOAD, MADDER], 'S'),
    card([CREAM, WELD, WOAD, MADDER], 'Z'),
    card([CREAM, CREAM, MADDER, MADDER], 'Z'),
    card([CREAM, CREAM, MADDER, MADDER], 'Z'),
    card([WALNUT, WALNUT, WALNUT, WALNUT], 'Z'),
  ];
  return {
    version: 1,
    meta: { name: 'Chevron' },
    palette: WOOL,
    cards,
    picks: Array.from({ length: 24 }, () => cards.map(() => 1 as Turn)),
  };
}
