import { advance, holeAt, leanOf } from './conventions.js';
import type { Cell, Pattern, Rotation } from './types.js';

/**
 * Weave the band. Total: every valid pattern produces a grid.
 *
 * Returns cells indexed [pick][card]. Each pick turns every card once, then
 * the weft locks whatever thread is now on the face.
 */
export function simulate(pattern: Pattern): Cell[][] {
  const rotations: Rotation[] = pattern.cards.map((c) => c.start);

  return pattern.picks.map((turnsForPick) => {
    return pattern.cards.map((card, index) => {
      const turn = turnsForPick[index]!;
      const rotation = advance(rotations[index]!, turn);
      rotations[index] = rotation;
      return {
        color: card.colors[holeAt(rotation, card.threading)]!,
        lean: leanOf(card.threading, turn),
      };
    });
  });
}
