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

interface StoreState {
  pattern: Pattern;
  selection: Selection;
  orientation: Orientation;
  render: RenderMode;
  mode: ScreenMode;
  currentPick: number;
  past: Pattern[];
  future: Pattern[];

  apply: (mutate: (draft: Pattern) => void, label: string) => void;
  undo: () => void;
  redo: () => void;
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
  pattern: defaultPattern(),
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
  // still holding) stays untouched.
  apply: (mutate) => {
    const { pattern, past } = get();
    const draft = structuredClone(pattern);
    mutate(draft);
    set({
      pattern: draft,
      past: [...past, pattern].slice(-UNDO_LIMIT),
      future: [],
    });
  },

  undo: () => {
    const { past, pattern, future } = get();
    const previous = past.at(-1);
    if (!previous) return;
    set({ pattern: previous, past: past.slice(0, -1), future: [pattern, ...future] });
  },

  redo: () => {
    const { future, pattern, past } = get();
    const next = future[0];
    if (!next) return;
    set({ pattern: next, past: [...past, pattern], future: future.slice(1) });
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
  // part of the document being loaded.
  load: (pattern) =>
    set({
      pattern,
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
      pattern: defaultPattern(),
      selection: defaultSelection(),
      orientation: 'vertical',
      render: 'woven',
      mode: 'design',
      currentPick: 0,
      past: [],
      future: [],
    }),
}));
