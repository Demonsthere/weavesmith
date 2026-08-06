import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { simulate } from '@weavesmith/core';
import type { Pattern, Turn } from '@weavesmith/core';
import { clearTarget, paintTarget, runCommand, setTurn } from '../state/commands.js';
import { useStore } from '../state/store.js';
import type { GestureToken } from '../state/store.js';
import type { CellRef, Selection } from '../state/selection.js';

/** Which cells below this one would change if its turn flipped. */
export function previewFlip(pattern: Pattern, pick: number, card: number): Set<string> {
  const before = simulate(pattern);
  const hypothetical = structuredClone(pattern);
  hypothetical.picks[pick]![card] = -hypothetical.picks[pick]![card]! as Turn;
  const after = simulate(hypothetical);

  const changed = new Set<string>();
  for (let t = pick; t < pattern.picks.length; t++) {
    const a = before[t]![card]!;
    const b = after[t]![card]!;
    if (a.color !== b.color || a.lean !== b.lean) changed.add(`${t}:${card}`);
  }
  return changed;
}

const EMPTY_PREVIEW: Set<string> = new Set();

function cellFromElement(el: Element | null): CellRef | null {
  const cell = el?.closest('.cell') ?? null;
  if (!cell) return null;
  const pick = Number(cell.getAttribute('data-pick'));
  const card = Number(cell.getAttribute('data-card'));
  if (Number.isNaN(pick) || Number.isNaN(card)) return null;
  return { pick, card };
}

/**
 * Resolve the cell under the pointer during a move. Once a pointer is
 * captured (which the drag below relies on, so it survives the pointer
 * leaving the board), the browser retargets `event.target` to the
 * capturing element for every subsequent event — so the *only* reliable
 * way to find the cell actually under the pointer is a hit test via
 * `elementFromPoint`. jsdom does not implement `elementFromPoint` (it has
 * no layout engine to hit-test with), so this falls back to `event.target`
 * — which is exactly what @testing-library/user-event sets per simulated
 * step, making the fallback correct there too, not just non-throwing.
 */
function cellUnderPointer(e: { clientX: number; clientY: number; target: EventTarget | null }): CellRef | null {
  const hit = typeof document.elementFromPoint === 'function'
    ? document.elementFromPoint(e.clientX, e.clientY)
    : null;
  const el = (hit ?? e.target) as Element | null;
  return cellFromElement(el);
}

function canHover(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export interface PointerHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

export interface PointerBinding {
  handlers: PointerHandlers;
  preview: Set<string>;
  hover: CellRef | null;
}

// The gesture in progress, or null. `kind` says which command the drag is
// repeating: a turn drag carries the direction taken from the first cell,
// a paint drag carries the brush the stroke started with — so changing the
// brush mid-drag cannot split a stroke into two colours.
type Gesture =
  | { kind: 'turn'; dir: Turn; token: GestureToken }
  | { kind: 'paint'; brush: number | null; token: GestureToken };

/**
 * Translates pointer events into calls on Task 3's command set and Task 2's
 * store. Contains no editing logic of its own: every mutation is computed
 * by `setTurn`, this hook only decides *which* selection to hand it and
 * *when* to record history.
 */
export function usePointerBinding(): PointerBinding {
  const [hover, setHover] = useState<CellRef | null>(null);
  const [preview, setPreview] = useState<Set<string>>(EMPTY_PREVIEW);
  // What the current drag is repeating, or null when not dragging. A ref,
  // not state: it drives no render, only the logic below. The token is what
  // makes every `continueGesture` call during this drag provably belong to
  // the entry `beginGesture` pushed — the store throws if it doesn't.
  const gestureRef = useRef<Gesture | null>(null);

  const clearHover = useCallback(() => {
    setHover(null);
    setPreview(EMPTY_PREVIEW);
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const target = cellFromElement(e.target as Element);
    if (!target) return;

    const { pattern, selection, setSelection, beginGesture } = useStore.getState();

    if (e.shiftKey) {
      // Extend the selection only — this is a read, not an edit, so it
      // never touches the pattern or undo history.
      setSelection({ anchor: selection.anchor, focus: target });
      return;
    }

    clearHover();

    const { mode, brush } = useStore.getState();

    const singleCell: Selection = { anchor: target, focus: target };
    setSelection(singleCell);

    if (mode === 'paint') {
      const token = beginGesture((draft) => {
        if (brush === null) runCommand(draft, clearTarget, singleCell);
        else runCommand(draft, paintTarget, singleCell, brush);
      }, brush === null ? 'Clear target' : 'Paint target');
      gestureRef.current = { kind: 'paint', brush, token };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const current = pattern.picks[target.pick]![target.card]!;
    const dir = -current as Turn;

    // One undo entry for the whole gesture: this is the only entry-pushing
    // call in the drag. Every subsequent pointermove uses `continueGesture`
    // with the token this returns, which updates the live pattern without
    // pushing another entry.
    const token = beginGesture((draft) => {
      runCommand(draft, setTurn, singleCell, dir);
    }, `Set turn ${dir === 1 ? 'forward' : 'backward'}`);
    gestureRef.current = { kind: 'turn', dir, token };

    e.currentTarget.setPointerCapture(e.pointerId);
  }, [clearHover]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;

    if (gesture !== null) {
      const target = cellUnderPointer(e);
      if (!target) return;
      const { selection, continueGesture, setSelection } = useStore.getState();
      if (target.pick === selection.focus.pick && target.card === selection.focus.card) return;

      const grown: Selection = { anchor: selection.anchor, focus: target };
      // Idempotent: re-painting cells already at `dir` (including ones
      // visited earlier in the same drag) changes nothing, so dragging
      // back and forth over already-painted cells costs nothing.
      continueGesture(gesture.token, (draft) => {
        if (gesture.kind === 'paint') {
          if (gesture.brush === null) runCommand(draft, clearTarget, grown);
          else runCommand(draft, paintTarget, grown, gesture.brush);
        } else {
          runCommand(draft, setTurn, grown, gesture.dir);
        }
      });
      setSelection(grown);
      return;
    }

    // Hover previews the *ripple*, which only Design mode can cause: a
    // target does not ripple, and Weave mode is not editing at all.
    if (!canHover() || useStore.getState().mode !== 'design') return;

    const target = cellUnderPointer(e);
    if (!target) {
      clearHover();
      return;
    }
    if (hover && hover.pick === target.pick && hover.card === target.card) return;

    setHover(target);
    setPreview(previewFlip(useStore.getState().pattern, target.pick, target.card));
  }, [clearHover, hover]);

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (gestureRef.current === null) return;
    gestureRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  // Leaving the board only ever clears a *hover* preview. An active drag is
  // deliberately left alone here — pointer capture (set in onPointerDown)
  // keeps delivering pointermove/pointerup to the board regardless of
  // where the pointer physically is, so the gesture survives leaving and
  // re-entering the board without splitting into two undo entries.
  const onPointerLeave = useCallback((_e: ReactPointerEvent<HTMLDivElement>) => {
    if (gestureRef.current === null && hover) clearHover();
  }, [hover, clearHover]);

  const handlers = useMemo<PointerHandlers>(() => ({
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onPointerLeave,
  }), [onPointerDown, onPointerMove, endDrag, onPointerLeave]);

  return { handlers, preview, hover };
}
