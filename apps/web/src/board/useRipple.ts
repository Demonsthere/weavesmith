import { useEffect, useRef, useState } from 'react';
import type { Cell } from '@weavesmith/core';

/** How long one cell's pulse lasts — `@keyframes pulse` in board.css. */
export const RIPPLE_MS = 260;

/**
 * Per-cell delay down a column, so the pulse reads as travelling rather than
 * flashing all at once. Ported from the mockup (`board.html:769`).
 */
export const STAGGER_MS = 22;

const EMPTY: ReadonlyMap<string, number> = new Map();

/**
 * The cells that actually changed between two simulated bands, mapped to the
 * delay their pulse should start after.
 *
 * Diffing the woven band rather than the turns is what makes this honest:
 * editing a cell offsets every rotation below it in that column, but a card
 * carrying the same colour in opposite holes shows the same thread either
 * way. Those cells did not change, so they do not pulse. The delay counts
 * from each column's own first change, because each column is an independent
 * ripple — cards do not interact in threaded-in weaving.
 *
 * A change of band *shape* (a card added or removed) returns nothing: every
 * column after the insertion renumbers, so a cell-by-cell diff would claim a
 * ripple that never happened.
 */
export function rippleCells(before: Cell[][], after: Cell[][]): ReadonlyMap<string, number> {
  if (before.length !== after.length) return EMPTY;

  const changed = new Map<string, number>();
  const firstChange = new Map<number, number>();

  for (let pick = 0; pick < after.length; pick++) {
    const was = before[pick]!;
    const now = after[pick]!;
    if (was.length !== now.length) return EMPTY;

    for (let card = 0; card < now.length; card++) {
      if (was[card]!.color === now[card]!.color && was[card]!.lean === now[card]!.lean) continue;
      if (!firstChange.has(card)) firstChange.set(card, pick);
      changed.set(`${pick}:${card}`, (pick - firstChange.get(card)!) * STAGGER_MS);
    }
  }

  return changed;
}

/**
 * Marks the cells an edit just changed, for as long as their pulse runs.
 *
 * Driven by the band itself rather than by the bindings: pointer, keyboard
 * and the card editor all end up producing a new pattern, so diffing the
 * simulated band catches every one of them — including undo and redo —
 * without any of them having to remember to announce a ripple. That is the
 * "one editing model, three bindings" rule holding by construction rather
 * than by a parity test.
 *
 * `documentId` suppresses the pulse when the *document* changed (a load or a
 * reset). Opening a different band is not an edit rippling down the one on
 * screen; without this, every cell that happened to differ would pulse at
 * once, which reads as noise rather than as cause and effect.
 */
export function useRipple(band: Cell[][], documentId: number): ReadonlyMap<string, number> {
  const [ripple, setRipple] = useState<ReadonlyMap<string, number>>(EMPTY);
  const previousBand = useRef(band);
  const previousDocument = useRef(documentId);

  useEffect(() => {
    const before = previousBand.current;
    const sameDocument = previousDocument.current === documentId;
    previousBand.current = band;
    previousDocument.current = documentId;

    const cells = sameDocument && before !== band ? rippleCells(before, band) : EMPTY;

    // Unconditional, including on the paths that start no new ripple: this
    // effect's cleanup has already cancelled the previous ripple's timer,
    // so anything left marked would stay marked forever — and a class that
    // never comes off stops the *next* edit animating those cells, because
    // CSS only restarts an animation when the class was absent in between.
    // `EMPTY` is a module constant, so clearing an already-clear ripple is
    // a no-op rather than a render.
    setRipple(cells);
    if (cells.size === 0) return;

    // One timer for the whole ripple, cleared when the last cell's pulse
    // ends. Iterated rather than `Math.max(...cells.values())`: cards cap
    // at 40 but picks do not, so a long imported band can put more cells in
    // here than a spread can take arguments.
    let last = 0;
    for (const delay of cells.values()) last = Math.max(last, delay);
    const timer = setTimeout(() => setRipple(EMPTY), RIPPLE_MS + last);
    return () => clearTimeout(timer);
  }, [band, documentId]);

  return ripple;
}
