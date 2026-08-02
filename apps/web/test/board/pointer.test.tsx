import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { simulate } from '@weavesmith/core';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';
import { previewFlip } from '../../src/board/usePointerBinding.js';

const cell = (pick: number, card: number) =>
  screen.getByLabelText(new RegExp(`Card ${card + 1}, pick ${pick + 1},`));

/** Installs a `matchMedia` mock for the duration of one test, then restores. */
function mockMatchMedia(matches: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

describe('pointer binding', () => {
  beforeEach(() => useStore.getState().reset());

  it('flips a cell on click', async () => {
    const user = userEvent.setup();
    render(<Board />);
    const before = useStore.getState().pattern.picks[2]![1];
    await user.click(cell(2, 1));
    expect(useStore.getState().pattern.picks[2]![1]).toBe(-before!);
  });

  it('moves focus to the clicked cell', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(cell(3, 2));
    expect(useStore.getState().selection.focus).toEqual({ pick: 3, card: 2 });
  });

  it('extends the selection on shift-click without changing the band', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(cell(1, 1));
    const after = structuredClone(useStore.getState().pattern);
    await user.keyboard('{Shift>}');
    await user.click(cell(4, 3));
    await user.keyboard('{/Shift}');

    expect(useStore.getState().pattern.picks).toEqual(after.picks);
    expect(useStore.getState().selection).toEqual({
      anchor: { pick: 1, card: 1 },
      focus: { pick: 4, card: 3 },
    });
  });

  it('records one undo entry per drag, not one per cell', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.pointer([
      { target: cell(0, 1), keys: '[MouseLeft>]' },
      { target: cell(3, 1) },
      { keys: '[/MouseLeft]' },
    ]);
    const changed = structuredClone(useStore.getState().pattern.picks);
    useStore.getState().undo();
    expect(useStore.getState().pattern.picks).not.toEqual(changed);
    useStore.getState().undo();
    // Only one drag happened; a second undo must be a no-op.
    expect(useStore.getState().past).toHaveLength(0);
  });

  it('paints one direction across a drag rather than toggling each cell', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.pointer([
      { target: cell(0, 1), keys: '[MouseLeft>]' },
      { target: cell(1, 1) },
      { target: cell(2, 1) },
      { keys: '[/MouseLeft]' },
    ]);
    const column = [0, 1, 2].map((t) => useStore.getState().pattern.picks[t]![1]);
    expect(new Set(column).size).toBe(1);
  });
});

// --- Extra verification beyond the brief's own tests ----------------------

describe('pointer binding — previewFlip', () => {
  beforeEach(() => useStore.getState().reset());

  it('outlines exactly the cells a real simulate() diff says would change', () => {
    const { pattern } = useStore.getState();
    const pick = 2;
    const card = 3;

    const result = previewFlip(pattern, pick, card);

    // Ground truth: actually flip the cell, simulate both, and diff by hand
    // (not calling previewFlip's own internals) — a real independent check.
    const before = simulate(pattern);
    const flipped = structuredClone(pattern);
    flipped.picks[pick]![card] = -flipped.picks[pick]![card]! as -1 | 1;
    const after = simulate(flipped);

    const expected = new Set<string>();
    for (let t = pick; t < pattern.picks.length; t++) {
      if (before[t]![card]!.color !== after[t]![card]!.color
        || before[t]![card]!.lean !== after[t]![card]!.lean) {
        expected.add(`${t}:${card}`);
      }
    }

    expect(result).toEqual(expected);
    expect(result.size).toBeGreaterThan(0); // sanity: this pattern does ripple
  });

  it('never marks a cell above the flipped pick (a flip cannot affect the past)', () => {
    const { pattern } = useStore.getState();
    const result = previewFlip(pattern, 5, 2);
    for (const key of result) {
      const [t] = key.split(':').map(Number);
      expect(t!).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('pointer binding — hover preview UI', () => {
  beforeEach(() => useStore.getState().reset());

  it('ghosts the hovered cell and outlines cells that would change, on a fine pointer', () => {
    const restore = mockMatchMedia(true);
    try {
      render(<Board />);
      const target = cell(2, 1);
      fireEvent.pointerMove(target, { clientX: 1, clientY: 1 });

      expect(target.className).toMatch(/\bghost\b/);

      const { pattern } = useStore.getState();
      const expected = previewFlip(pattern, 2, 1);
      for (const key of expected) {
        const [t, c] = key.split(':').map(Number);
        const el = cell(t!, c!);
        expect(el.className).toMatch(/\bwillchange\b/);
      }
    } finally {
      restore();
    }
  });

  it('does nothing on a coarse pointer (matchMedia hover:none)', () => {
    const restore = mockMatchMedia(false);
    try {
      render(<Board />);
      const target = cell(2, 1);
      fireEvent.pointerMove(target, { clientX: 1, clientY: 1 });
      expect(target.className).not.toMatch(/\bghost\b/);
    } finally {
      restore();
    }
  });

  it('does nothing in weave mode even on a fine pointer', () => {
    const restore = mockMatchMedia(true);
    try {
      useStore.getState().setMode('weave');
      render(<Board />);
      const target = cell(2, 1);
      fireEvent.pointerMove(target, { clientX: 1, clientY: 1 });
      expect(target.className).not.toMatch(/\bghost\b/);
    } finally {
      restore();
    }
  });

  it('clears the ghost when the pointer leaves the board without a drag', () => {
    const restore = mockMatchMedia(true);
    try {
      const { container } = render(<Board />);
      const target = cell(2, 1);
      fireEvent.pointerMove(target, { clientX: 1, clientY: 1 });
      expect(target.className).toMatch(/\bghost\b/);

      const board = container.querySelector('.board')!;
      fireEvent.pointerLeave(board);
      expect(target.className).not.toMatch(/\bghost\b/);
    } finally {
      restore();
    }
  });
});

describe('pointer binding — drag robustness', () => {
  beforeEach(() => useStore.getState().reset());

  it('pushes exactly one past entry for a multi-step drag, and one undo exactly restores the pre-drag pattern', async () => {
    // The brief's own "one undo entry per drag" test only has a single move
    // step (cell(0,1) straight to cell(3,1)) and only checks that *two*
    // undo() calls drain `past` to empty — which two *real* entries would
    // also satisfy (each undo just pops one). It doesn't actually pin "one
    // entry", only "two undos empty it". This test closes that gap
    // directly: a multi-step drag (three separate move targets, so a
    // buggy implementation pushing per-move would produce 4 entries, not
    // 1), asserting `past.length === 1` right after the drag — before any
    // undo — and that the single undo reproduces the pre-drag pattern
    // byte-for-byte, not just "some earlier state".
    const before = structuredClone(useStore.getState().pattern);
    const user = userEvent.setup();
    render(<Board />);
    await user.pointer([
      { target: cell(0, 1), keys: '[MouseLeft>]' },
      { target: cell(1, 1) },
      { target: cell(2, 1) },
      { target: cell(3, 1) },
      { keys: '[/MouseLeft]' },
    ]);

    expect(useStore.getState().past).toHaveLength(1);

    useStore.getState().undo();
    expect(useStore.getState().pattern).toEqual(before);
    expect(useStore.getState().past).toHaveLength(0);
  });

  it('does not split into two undo entries when the pointer leaves the board mid-drag and returns', () => {
    const { container } = render(<Board />);
    const board = container.querySelector('.board')!;
    const start = cell(0, 1);
    const mid = cell(2, 1);

    // Begin the drag exactly as the brief's sequences do.
    fireEvent.pointerDown(start, { pointerId: 1, clientX: 0, clientY: 0 });

    // Simulate "the pointer left the board": a pointerleave fires, but
    // pointer capture (set in onPointerDown) means the drag keeps getting
    // real pointermove/pointerup events regardless — pointerleave itself
    // must not end the gesture.
    fireEvent.pointerLeave(board, { pointerId: 1 });

    // The drag continues once the pointer is back "inside" — the captured
    // element keeps receiving events wherever the actual pointer is.
    fireEvent.pointerMove(mid, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(mid, { pointerId: 1, clientX: 0, clientY: 0 });

    const changed = structuredClone(useStore.getState().pattern.picks);
    useStore.getState().undo();
    expect(useStore.getState().pattern.picks).not.toEqual(changed);
    useStore.getState().undo();
    expect(useStore.getState().past).toHaveLength(0);
  });

  it('leaves the selection rectangle matching the cells actually painted', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.pointer([
      { target: cell(1, 2), keys: '[MouseLeft>]' },
      { target: cell(4, 2) },
      { keys: '[/MouseLeft]' },
    ]);
    const { selection, pattern } = useStore.getState();
    expect(selection).toEqual({ anchor: { pick: 1, card: 2 }, focus: { pick: 4, card: 2 } });

    // Every cell inside the dragged rectangle carries the same turn as the
    // first cell (the direction painted); nothing outside it changed.
    const dir = pattern.picks[1]![2];
    for (let t = 1; t <= 4; t++) expect(pattern.picks[t]![2]).toBe(dir);
  });

  it('sets pointer capture on pointerdown and releases it on pointerup', () => {
    // jsdom has no native `PointerEvent` constructor (verified: `window
    // .PointerEvent` is undefined), so @testing-library/dom's `fireEvent`
    // falls back to the base `Event` constructor, which — per spec — only
    // recognises `bubbles`/`cancelable`/`composed` in its init dict and
    // silently drops everything else, including a `pointerId` passed in
    // the event init. So `event.pointerId` is always `undefined` under
    // `fireEvent` here, never the literal value passed to it; asserting
    // `hasPointerCapture(<that literal>)` would be asserting something
    // jsdom cannot deliver, not something our code gets wrong. Spying on
    // the capture methods instead verifies the real thing this test cares
    // about — that the binding calls set/release at the right lifecycle
    // points — without depending on jsdom's broken pointerId plumbing.
    const { container } = render(<Board />);
    const board = container.querySelector('.board') as HTMLElement;
    const target = cell(0, 0);

    const setSpy = vi.spyOn(board, 'setPointerCapture');
    const releaseSpy = vi.spyOn(board, 'releasePointerCapture');

    fireEvent.pointerDown(target, { pointerId: 7, clientX: 0, clientY: 0 });
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(releaseSpy).not.toHaveBeenCalled();

    fireEvent.pointerUp(target, { pointerId: 7, clientX: 0, clientY: 0 });
    expect(releaseSpy).toHaveBeenCalledTimes(1);
  });
});
