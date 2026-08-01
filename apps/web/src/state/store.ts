import { create } from 'zustand';
import type { Pattern } from '@weavesmith/core';
import type { Selection } from './selection.js';
import { defaultPattern } from './defaultPattern.js';

export type Orientation = 'vertical' | 'horizontal';
export type RenderMode = 'woven' | 'dots';
export type ScreenMode = 'design' | 'weave';

const UNDO_LIMIT = 100;

const defaultSelection = (): Selection => ({
  focus: { pick: 0, card: 0 },
  anchor: { pick: 0, card: 0 },
});

// Recursively freezes an object graph (arrays included). Applied to every
// Pattern the moment the store takes ownership of it — the live `pattern`,
// and everything parked in `past`/`future` — so `apply` is not just the
// *intended* single write path but the only one that works: a stray
// `getState().pattern.picks[0][0] = x` throws (modules here are strict mode)
// instead of silently poisoning undo history. `structuredClone` returns a
// fresh, unfrozen clone of a frozen input, so `apply`'s clone-mutate-freeze
// cycle is unaffected by freezing its source.
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

const freezePattern = (pattern: Pattern): Pattern => deepFreeze(pattern);

interface HistoryEntry {
  pattern: Pattern;
  label: string;
}

interface StoreState {
  pattern: Pattern;
  selection: Selection;
  orientation: Orientation;
  render: RenderMode;
  mode: ScreenMode;
  currentPick: number;
  past: HistoryEntry[];
  future: HistoryEntry[];

  apply: (mutate: (draft: Pattern) => void, label: string) => void;
  // Continue a gesture that already recorded its own undo entry via `apply`
  // (a pointer drag: `apply` fires once on pointerdown to push the pre-drag
  // pattern, then every pointermove calls this instead). Replaces the live
  // pattern — deep-frozen exactly like `apply`'s result — but never touches
  // `past`/`future`, so a multi-cell drag still costs exactly one undo step
  // no matter how many times this runs mid-gesture.
  continueGesture: (mutate: (draft: Pattern) => void) => void;
  undo: () => string | undefined;
  redo: () => string | undefined;
  setSelection: (selection: Selection) => void;
  moveFocus: (dPick: number, dCard: number, extend: boolean) => void;
  setOrientation: (orientation: Orientation) => void;
  setRender: (render: RenderMode) => void;
  setMode: (mode: ScreenMode) => void;
  setCurrentPick: (pick: number) => void;
  load: (pattern: Pattern) => void;
  reset: () => void;
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(max, 0));

export const useStore = create<StoreState>((set, get) => ({
  pattern: freezePattern(defaultPattern()),
  selection: defaultSelection(),
  orientation: 'vertical',
  render: 'woven',
  mode: 'design',
  currentPick: 0,
  past: [],
  future: [],

  // The single write path. Everything that changes the pattern goes through
  // here, so undo never misses a change. Clones before mutating so the
  // pattern object already on the undo stack (and any reference a caller is
  // still holding) stays untouched, then freezes the result before it
  // becomes the live pattern.
  apply: (mutate, label) => {
    const { pattern, past } = get();
    const draft = structuredClone(pattern);
    mutate(draft);
    freezePattern(draft);
    set({
      pattern: draft,
      past: [...past, { pattern, label }].slice(-UNDO_LIMIT),
      future: [],
    });
  },

  continueGesture: (mutate) => {
    const { pattern } = get();
    const draft = structuredClone(pattern);
    mutate(draft);
    freezePattern(draft);
    set({ pattern: draft });
  },

  undo: () => {
    const { past, pattern, future } = get();
    const previous = past.at(-1);
    if (!previous) return undefined;
    set({
      pattern: previous.pattern,
      past: past.slice(0, -1),
      future: [{ pattern, label: previous.label }, ...future],
    });
    return previous.label;
  },

  redo: () => {
    const { future, pattern, past } = get();
    const next = future[0];
    if (!next) return undefined;
    set({
      pattern: next.pattern,
      past: [...past, { pattern, label: next.label }],
      future: future.slice(1),
    });
    return next.label;
  },

  setSelection: (selection) => set({ selection }),

  moveFocus: (dPick, dCard, extend) => {
    const { pattern, selection } = get();
    const focus = {
      pick: clamp(selection.focus.pick + dPick, pattern.picks.length - 1),
      card: clamp(selection.focus.card + dCard, pattern.cards.length - 1),
    };
    set({ selection: { focus, anchor: extend ? selection.anchor : focus } });
  },

  setOrientation: (orientation) => set({ orientation }),
  setRender: (render) => set({ render }),
  setMode: (mode) => set({ mode }),
  setCurrentPick: (pick) =>
    set({ currentPick: clamp(pick, get().pattern.picks.length - 1) }),

  // Importing a file replaces the pattern, but deliberately leaves display
  // preferences (orientation/render/mode) alone — those are UI state, not
  // part of the document being loaded. Clones before freezing so freezing
  // never reaches back into an object the caller (e.g. a file parser) still
  // holds a reference to.
  load: (pattern) =>
    set({
      pattern: freezePattern(structuredClone(pattern)),
      past: [],
      future: [],
      selection: defaultSelection(),
      currentPick: 0,
    }),

  // Full reset (used between tests, and available for a "start over" action).
  // Unlike load(), this also restores orientation/render/mode — load() is
  // "open a different document", reset() is "back to a blank slate".
  reset: () =>
    set({
      pattern: freezePattern(defaultPattern()),
      selection: defaultSelection(),
      orientation: 'vertical',
      render: 'woven',
      mode: 'design',
      currentPick: 0,
      past: [],
      future: [],
    }),
}));
