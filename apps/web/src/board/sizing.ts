/**
 * How wide a cell is allowed to grow. The board's natural cell is 42px on
 * the card axis; without a ceiling a four-card sampler on a wide monitor
 * would render as a handful of enormous tiles, which stops reading as a
 * woven band.
 */
export const MAX_CELL = 64;

/**
 * How much to scale the board's natural cell size so the band uses the room
 * it has been given.
 *
 * Never returns less than 1. Shrinking is already decided by card count
 * (`cardAxisSize`) down to the spec's 28px floor, and past that the board
 * scrolls on purpose — measuring the window must not start shrinking cells
 * below that floor by a second, competing rule.
 *
 * Returns 1 when the available width is unknown (0 before first layout, or
 * in an environment with no layout at all), so an unmeasured board renders
 * exactly as it did before any of this existed.
 */
export function growthFactor(
  availableWidth: number,
  naturalWidth: number,
  largestCell: number,
): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1;
  if (!Number.isFinite(naturalWidth) || naturalWidth <= 0) return 1;
  if (!Number.isFinite(largestCell) || largestCell <= 0) return 1;
  const cap = MAX_CELL / largestCell;
  return Math.max(1, Math.min(availableWidth / naturalWidth, cap));
}
