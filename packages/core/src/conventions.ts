// Pinned by test/bands.test.ts against the Narrow Oseberg Band, transcribed from
// https://www.shelaghlewins.com/tablet_weaving/patterns_past.php (instruction
// sheet: https://www.shelaghlewins.com/tablet_weaving/Oseberg_narrow/Oseberg_narrow.pdf).
// These two functions define what the library believes tablet weaving is.

import type { Hole, Lean, Rotation, Threading, Turn } from './types.js';
import { HOLE_COUNT } from './types.js';

/**
 * Rotate a card one pick in the given direction.
 */
export function advance(rotation: Rotation, turn: Turn): Rotation {
  return ((rotation + turn + HOLE_COUNT) % HOLE_COUNT) as Rotation;
}

/**
 * Which hole's thread shows on the face of the band at a given rotation.
 *
 * An S-threaded card presents its holes in order as it turns forward; a
 * Z-threaded card is the mirror image and presents them in reverse. Rotation 0
 * shows hole A either way — that is the definition of the start position, not a
 * property of the weave.
 *
 * CONVENTION. Pinned by test/bands.test.ts against published bands. If a real
 * band disagrees, change this function, never the fixture.
 */
export function holeAt(rotation: Rotation, threading: Threading): Hole {
  if (threading === 'S') return rotation;
  return ((HOLE_COUNT - rotation) % HOLE_COUNT) as Hole;
}

/**
 * Which way the stitch leans.
 *
 * Threading direction and turn direction each flip the lean, so flipping both
 * leaves it unchanged.
 *
 * CONVENTION. Same rule as holeAt: fixtures win.
 */
export function leanOf(threading: Threading, turn: Turn): Lean {
  const forwardS = (threading === 'S') === (turn === 1);
  return forwardS ? '/' : '\\';
}
