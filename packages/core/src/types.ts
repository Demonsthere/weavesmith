/** Threading direction: which way the warp passes through the card. */
export type Threading = 'S' | 'Z';

/** Turn direction for one card on one pick. */
export type Turn = 1 | -1;

/** Rotation position of a card, 0-3. */
export type Rotation = 0 | 1 | 2 | 3;

/** Hole index, 0-3, corresponding to labels A-D. */
export type Hole = 0 | 1 | 2 | 3;

/** Which way a stitch leans on the face of the band. */
export type Lean = '/' | '\\';

export interface Card {
  /** Palette indices for holes A, B, C, D in that order. */
  colors: [number, number, number, number];
  threading: Threading;
  /** Rotation before the first pick. */
  start: Rotation;
}

export interface PatternMeta {
  name: string;
  author?: string;
  notes?: string;
}

/** Desired colour per cell, [pick][card]. null means "any colour will do". */
export type TargetGrid = (number | null)[][];

export interface Pattern {
  version: 1;
  meta: PatternMeta;
  /** Hex colours, e.g. "#B4402C". Cards hold indices into this list. */
  palette: string[];
  cards: Card[];
  /** picks[pick][card] — must be rectangular. */
  picks: Turn[][];
  /**
   * What the weaver asked for, when they have painted anything — a palette
   * index per cell, or null for "any colour will do". Same dimensions as
   * `picks`. Absent, not empty, when nothing is painted: an all-null grid
   * and no grid mean the same thing, and only one of them should ever be
   * written to a file.
   */
  target?: TargetGrid;
}

/** One woven cell: the thread showing, and the way it leans. */
export interface Cell {
  color: number;
  lean: Lean;
}

export const HOLE_COUNT = 4;
export const HOLE_LABELS = ['A', 'B', 'C', 'D'] as const;
export const MIN_CARDS = 4;
export const MAX_CARDS = 40;
