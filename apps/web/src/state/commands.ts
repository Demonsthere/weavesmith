import { advance, holeAt, HOLE_LABELS, MAX_CARDS, MIN_CARDS, solveTurns } from '@weavesmith/core';
import type { Card, Hole, Pattern, Rotation, Threading, Turn } from '@weavesmith/core';
import { cellsIn, selectionRect } from './selection.js';
import type { Selection } from './selection.js';

export interface CommandResult {
  pattern: Pattern;
  /** Shown in the live region. Written for a person, not a log. */
  message: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function edit(pattern: Pattern, mutate: (draft: Pattern) => void): Pattern {
  const draft = structuredClone(pattern);
  mutate(draft);
  return draft;
}

/**
 * Run one of the commands above against a mutable draft (the kind handed to
 * the store's `apply`/`beginGesture`/`continueGesture` callbacks) and write
 * its result back into that draft. Every command here is pure — it clones
 * its `pattern` argument rather than touching it — so the only way to fold
 * a command's result into an in-progress draft is this merge; both the
 * pointer and keyboard bindings need exactly this shape, so it lives here
 * once instead of being copied at each call site.
 */
export function runCommand<Args extends unknown[]>(
  draft: Pattern,
  command: (pattern: Pattern, ...args: Args) => CommandResult,
  ...args: Args
): string {
  const result = command(draft, ...args);
  Object.assign(draft, result.pattern);
  // Object.assign copies keys; it cannot remove one. `target` is optional and
  // `clearTarget` drops it once nothing is painted, so without this an erase
  // gesture would leave the old painting behind in the draft — the command
  // would be correct and the binding still wrong.
  for (const key of Object.keys(draft)) {
    if (!(key in result.pattern)) delete (draft as unknown as Record<string, unknown>)[key];
  }
  return result.message;
}

export function toggleTurn(pattern: Pattern, selection: Selection): CommandResult {
  const cells = cellsIn(selectionRect(selection));
  const next = edit(pattern, (draft) => {
    for (const { pick, card } of cells) {
      draft.picks[pick]![card] = -draft.picks[pick]![card]! as Turn;
    }
  });
  return { pattern: next, message: `Flipped ${plural(cells.length, 'cell')}` };
}

export function setTurn(pattern: Pattern, selection: Selection, dir: Turn): CommandResult {
  const cells = cellsIn(selectionRect(selection));
  let changed = 0;
  const next = edit(pattern, (draft) => {
    for (const { pick, card } of cells) {
      if (draft.picks[pick]![card] !== dir) {
        draft.picks[pick]![card] = dir;
        changed++;
      }
    }
  });
  return {
    pattern: next,
    message: `Set ${plural(changed, 'cell')} to turn ${dir === 1 ? 'forward' : 'backward'}`,
  };
}

/** Rotation of a card immediately before a pick. */
function rotationBefore(pattern: Pattern, pick: number, card: number): Rotation {
  let rotation = pattern.cards[card]!.start;
  for (let t = 0; t < pick; t++) rotation = advance(rotation, pattern.picks[t]![card]!);
  return rotation;
}

/**
 * Show a specific hole. Only two of four are reachable from any rotation, so
 * this refuses per-cell and names what it refused.
 */
export function setHole(pattern: Pattern, selection: Selection, hole: Hole): CommandResult {
  const cells = cellsIn(selectionRect(selection));
  const refused: string[] = [];
  let applied = 0;

  const next = edit(pattern, (draft) => {
    for (const { pick, card } of cells) {
      const before = rotationBefore(draft, pick, card);
      const threading = draft.cards[card]!.threading;
      const hit = ([1, -1] as Turn[]).find(
        (turn) => holeAt(advance(before, turn), threading) === hole,
      );
      if (hit === undefined) {
        refused.push(`card ${card + 1} pick ${pick + 1}`);
      } else {
        draft.picks[pick]![card] = hit;
        applied++;
      }
    }
  });

  let message = `${plural(applied, 'cell')} set to hole ${HOLE_LABELS[hole]}`;
  if (refused.length > 0) {
    message += `; hole ${HOLE_LABELS[hole]} unreachable on ${refused.length}` +
      ` (${refused.slice(0, 3).join(', ')})`;
  }
  return { pattern: next, message };
}

export function setThreading(
  pattern: Pattern,
  selection: Selection,
  threading: Threading,
): CommandResult {
  const rect = selectionRect(selection);
  let changed = 0;
  const next = edit(pattern, (draft) => {
    for (let card = rect.c0; card <= rect.c1; card++) {
      if (draft.cards[card]!.threading !== threading) {
        draft.cards[card]!.threading = threading;
        changed++;
      }
    }
  });
  return { pattern: next, message: `${plural(changed, 'card')} set to ${threading} threading` };
}

/**
 * The index where a new card of this threading belongs: the S/Z boundary, so
 * each block stays contiguous and the border cards stay at the edges.
 */
function boundary(cards: Card[]): number {
  const firstZ = cards.findIndex((card) => card.threading === 'Z');
  if (firstZ === -1) return cards.length - 1;
  if (firstZ === 0) return 1;
  return firstZ;
}

export function addCard(
  pattern: Pattern,
  threading: Threading,
): { result: CommandResult; index: number } {
  if (pattern.cards.length >= MAX_CARDS) {
    return {
      result: { pattern, message: `A band takes at most ${MAX_CARDS} cards` },
      index: -1,
    };
  }
  const index = boundary(pattern.cards);
  const source = pattern.cards[Math.max(0, index - 1)]!;
  const next = edit(pattern, (draft) => {
    draft.cards.splice(index, 0, {
      colors: [...source.colors] as [number, number, number, number],
      threading,
      start: 0,
    });
    for (const row of draft.picks) row.splice(index, 0, 1);
    if (draft.target) for (const row of draft.target) row.splice(index, 0, null);
  });
  return {
    result: { pattern: next, message: `Card ${index + 1} added, threaded ${threading}` },
    index,
  };
}

/**
 * The index the stepper's `−` button should remove: just inside the S/Z
 * boundary (see `boundary` above), so a shrink undoes a grow symmetrically —
 * and never a border card (index 0 or the last index), per the design spec's
 * "Resizing the band". `boundary` only ever returns a value in
 * `[1, cards.length - 1]`, so the only edge case is when it lands exactly on
 * the trailing border (an all-S band, or a single Z card at the end): step
 * one short of it instead.
 */
export function removalIndex(cards: Card[]): number {
  const index = boundary(cards);
  return index === cards.length - 1 ? index - 1 : index;
}

export function removeCard(pattern: Pattern, index: number): CommandResult {
  if (pattern.cards.length <= MIN_CARDS) {
    return { pattern, message: `A band needs at least ${MIN_CARDS} cards` };
  }
  const next = edit(pattern, (draft) => {
    draft.cards.splice(index, 1);
    for (const row of draft.picks) row.splice(index, 1);
    if (draft.target) for (const row of draft.target) row.splice(index, 1);
  });
  return { pattern: next, message: `Card ${index + 1} removed` };
}

/**
 * Point a hole at a colour.
 *
 * This re-points the hole at a palette entry, adding one if the colour is new.
 * It never edits an existing entry in place — that would recolour every other
 * card using it.
 */
export function setHoleColor(
  pattern: Pattern,
  card: number,
  hole: Hole,
  hex: string,
): CommandResult {
  const next = edit(pattern, (draft) => {
    let index = draft.palette.indexOf(hex);
    if (index === -1) {
      draft.palette.push(hex);
      index = draft.palette.length - 1;
    }
    draft.cards[card]!.colors[hole] = index;
  });
  return {
    pattern: next,
    message: `Card ${card + 1} hole ${HOLE_LABELS[hole]} set to ${hex}`,
  };
}

/** A fully-null target of the pattern's dimensions. */
function emptyTarget(pattern: Pattern): (number | null)[][] {
  return pattern.picks.map(() => pattern.cards.map(() => null));
}

/**
 * Ask for a colour on every cell in the selection.
 *
 * The target is created on first use rather than carried empty: an all-null
 * grid and no grid mean the same thing, and only one of them belongs in a
 * saved file.
 */
export function paintTarget(
  pattern: Pattern,
  selection: Selection,
  color: number,
): CommandResult {
  const cells = cellsIn(selectionRect(selection));
  const next = edit(pattern, (draft) => {
    const target = draft.target ?? emptyTarget(draft);
    for (const { pick, card } of cells) target[pick]![card] = color;
    draft.target = target;
  });
  return { pattern: next, message: `Painted ${plural(cells.length, 'cell')}` };
}

/** Take the selection back to "any colour will do". */
export function clearTarget(pattern: Pattern, selection: Selection): CommandResult {
  const cells = cellsIn(selectionRect(selection));
  const next = edit(pattern, (draft) => {
    if (!draft.target) return;
    for (const { pick, card } of cells) draft.target[pick]![card] = null;
    if (draft.target.every((row) => row.every((color) => color === null))) {
      delete draft.target;
    }
  });
  return { pattern: next, message: `Cleared ${plural(cells.length, 'cell')}` };
}

/**
 * Solve the whole band for the painted target.
 *
 * Whole band, not "affected columns": unpainted cells are null, which costs
 * the solver nothing, and `previous` breaks ties toward the turns the weaver
 * already has — so untouched columns come back exactly as they went in.
 */
export function solveTarget(pattern: Pattern): CommandResult {
  const target = pattern.target;
  if (!target) return { pattern, message: 'Nothing painted yet' };

  const { picks, unreachable } = solveTurns(pattern.cards, target, {
    previous: pattern.picks,
  });
  const next = edit(pattern, (draft) => {
    draft.picks = picks;
  });

  const painted = target.reduce(
    (count, row) => count + row.filter((color) => color !== null).length,
    0,
  );
  let message = `Solved ${plural(painted - unreachable.length, 'cell')}`;
  if (unreachable.length > 0) {
    const named = unreachable
      .slice(0, 3)
      .map((cell) => `card ${cell.card + 1} pick ${cell.pick + 1}`)
      .join(', ');
    message += `; ${unreachable.length} unreachable (${named})`;
  }
  return { pattern: next, message };
}
