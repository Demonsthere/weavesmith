import type { Card } from '@weavesmith/core';

export type ColorScheme = 'threading' | 'index';

/** Teal and orchid: deliberately outside any plausible wool palette. */
const SZ_HUES = { S: 172, Z: 292 } as const;

/**
 * A card's identity colour, used on its chrome only — string, chip, rail,
 * weave-bar arrow. Never on a note face, where colour means thread.
 *
 * The threading scheme spends hue on information and survives a 40-card band.
 * The index scheme is prettier below about twelve cards and unusable above
 * twenty-four; it is kept as an option, not a default.
 */
export function identityColor(
  card: Card,
  index: number,
  count: number,
  scheme: ColorScheme,
): string {
  if (scheme === 'threading') {
    return `hsl(${SZ_HUES[card.threading]} 58% 60%)`;
  }
  const hue = Math.round((index / Math.max(count, 1)) * 330);
  return `hsl(${hue} 72% 60%)`;
}

/** Every fifth card, echoing the fret inlays on the pick axis. */
export function isLandmark(index: number): boolean {
  return (index + 1) % 5 === 0;
}
