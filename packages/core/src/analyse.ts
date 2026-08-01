import { HOLE_COUNT } from './types.js';
import type { Pattern } from './types.js';

/**
 * Accumulated turns per card. A card at +40 has forty twists of warp above the
 * weaving line and will need unwinding.
 */
export function netTwist(pattern: Pattern): number[] {
  return pattern.cards.map((_, cardIndex) =>
    pattern.picks.reduce((sum, turnsForPick) => sum + turnsForPick[cardIndex]!, 0),
  );
}

export interface ThreadCounts {
  /** Warp threads needed of each palette colour. */
  perColor: Record<number, number>;
  cards: number;
  warpEnds: number;
}

/** What to measure out before warping the loom. */
export function threadCounts(pattern: Pattern): ThreadCounts {
  const perColor: Record<number, number> = {};
  for (const card of pattern.cards) {
    for (const color of card.colors) {
      perColor[color] = (perColor[color] ?? 0) + 1;
    }
  }
  return {
    perColor,
    cards: pattern.cards.length,
    warpEnds: pattern.cards.length * HOLE_COUNT,
  };
}
