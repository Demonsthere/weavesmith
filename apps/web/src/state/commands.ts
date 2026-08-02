import { advance, holeAt, HOLE_LABELS, MAX_CARDS, MIN_CARDS } from '@weavesmith/core';
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
  });
  return {
    result: { pattern: next, message: `Card ${index + 1} added, threaded ${threading}` },
    index,
  };
}

export function removeCard(pattern: Pattern, index: number): CommandResult {
  if (pattern.cards.length <= MIN_CARDS) {
    return { pattern, message: `A band needs at least ${MIN_CARDS} cards` };
  }
  const next = edit(pattern, (draft) => {
    draft.cards.splice(index, 1);
    for (const row of draft.picks) row.splice(index, 1);
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
