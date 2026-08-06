import { beforeEach, describe, expect, it } from 'vitest';
import { cellsIn, selectionRect } from '../../src/state/selection.js';
import { useStore } from '../../src/state/store.js';

describe('selectionRect', () => {
  it('normalises a selection dragged upward and leftward', () => {
    const rect = selectionRect({ focus: { pick: 2, card: 1 }, anchor: { pick: 7, card: 5 } });
    expect(rect).toEqual({ t0: 2, t1: 7, c0: 1, c1: 5 });
  });

  it('is a single cell when focus and anchor coincide', () => {
    const rect = selectionRect({ focus: { pick: 3, card: 3 }, anchor: { pick: 3, card: 3 } });
    expect(cellsIn(rect)).toEqual([{ pick: 3, card: 3 }]);
  });

  it('enumerates every cell in the rectangle', () => {
    const rect = selectionRect({ focus: { pick: 0, card: 0 }, anchor: { pick: 1, card: 1 } });
    expect(cellsIn(rect)).toHaveLength(4);
  });
});

describe('store', () => {
  beforeEach(() => useStore.getState().reset());

  it('starts with a valid default band', () => {
    const { pattern } = useStore.getState();
    expect(pattern.cards.length).toBeGreaterThanOrEqual(4);
    expect(pattern.picks[0]).toHaveLength(pattern.cards.length);
  });

  it('applies a mutation and records it for undo', () => {
    const before = useStore.getState().pattern.picks[0]![0];
    useStore.getState().apply((draft) => {
      draft.picks[0]![0] = (before === 1 ? -1 : 1);
    }, 'flip');
    expect(useStore.getState().pattern.picks[0]![0]).not.toBe(before);

    useStore.getState().undo();
    expect(useStore.getState().pattern.picks[0]![0]).toBe(before);
  });

  it('redoes what it undid', () => {
    useStore.getState().apply((draft) => { draft.meta.name = 'changed'; }, 'rename');
    useStore.getState().undo();
    useStore.getState().redo();
    expect(useStore.getState().pattern.meta.name).toBe('changed');
  });

  it('drops the redo stack once a new change is applied', () => {
    useStore.getState().apply((draft) => { draft.meta.name = 'first'; }, 'a');
    useStore.getState().undo();
    useStore.getState().apply((draft) => { draft.meta.name = 'second'; }, 'b');
    useStore.getState().redo();
    expect(useStore.getState().pattern.meta.name).toBe('second');
  });

  it('never mutates the previous pattern object', () => {
    const before = useStore.getState().pattern;
    useStore.getState().apply((draft) => { draft.meta.name = 'new'; }, 'rename');
    expect(before.meta.name).not.toBe('new');
  });

  it('clamps focus within the band', () => {
    useStore.getState().moveFocus(999, 999, false);
    const { pattern, selection } = useStore.getState();
    expect(selection.focus.pick).toBe(pattern.picks.length - 1);
    expect(selection.focus.card).toBe(pattern.cards.length - 1);
  });

  it('collapses the anchor onto the focus when not extending', () => {
    useStore.getState().moveFocus(2, 1, false);
    const { selection } = useStore.getState();
    expect(selection.anchor).toEqual(selection.focus);
  });

  it('leaves the anchor put when extending', () => {
    const start = useStore.getState().selection.anchor;
    useStore.getState().moveFocus(2, 1, true);
    expect(useStore.getState().selection.anchor).toEqual(start);
  });

  it('does not let a later apply reach back into an earlier snapshot (picks and colors)', () => {
    // This is the shape of the gcPalette bug: a shallow clone leaves nested
    // arrays (picks rows, card colors) aliased between the snapshot pushed to
    // history and the live draft, so a later in-place edit rewrites history.
    const snapshot = useStore.getState().pattern;
    const originalPick00 = snapshot.picks[0]![0];
    const originalColor0 = snapshot.cards[0]!.colors[0];

    useStore.getState().apply((draft) => {
      draft.picks[0]![0] = (originalPick00 === 1 ? -1 : 1);
      draft.cards[0]!.colors[0] = originalColor0 + 1;
    }, 'mutate nested');

    expect(snapshot.picks[0]![0]).toBe(originalPick00);
    expect(snapshot.cards[0]!.colors[0]).toBe(originalColor0);
  });

  it('does not let a later apply reach back into an object already on the undo stack', () => {
    useStore.getState().apply((draft) => { draft.cards[0]!.colors[0] = 1; }, 'first');
    const onUndoStack = useStore.getState().pattern; // will be pushed to `past` by the next apply

    useStore.getState().apply((draft) => { draft.cards[0]!.colors[0] = 2; }, 'second');

    // The object captured above is now sitting in `past`; a later mutation of
    // the new live draft must not have reached back into it.
    expect(onUndoStack.cards[0]!.colors[0]).toBe(1);

    useStore.getState().undo();
    expect(useStore.getState().pattern.cards[0]!.colors[0]).toBe(1);
  });

  it('clamps focus after the band shrinks', () => {
    useStore.getState().moveFocus(999, 999, false);
    const before = useStore.getState().selection.focus;
    expect(before.card).toBeGreaterThan(0);

    const narrow = { ...useStore.getState().pattern };
    narrow.cards = narrow.cards.slice(0, 4);
    narrow.picks = narrow.picks.map((pick) => pick.slice(0, 4));
    useStore.getState().load(narrow);

    // load() resets the selection to the origin, which is itself in range,
    // but moveFocus must clamp against the *new*, narrower pattern rather
    // than remembering the old band size.
    useStore.getState().moveFocus(999, 999, false);
    const { pattern, selection } = useStore.getState();
    expect(selection.focus.card).toBe(pattern.cards.length - 1);
    expect(selection.focus.card).toBeLessThan(before.card);
  });

  it('bounds the undo stack at 100 entries, dropping the oldest first', () => {
    for (let i = 0; i < 105; i++) {
      useStore.getState().apply((draft) => { draft.meta.name = `n${i}`; }, `step ${i}`);
    }
    const { past } = useStore.getState() as unknown as {
      past: { pattern: { meta: { name: string } }; label: string }[];
    };
    expect(past).toHaveLength(100);
    // The oldest surviving entry should be from step 5 (n4), not step 0.
    expect(past[0]!.pattern.meta.name).toBe('n4');
    expect(past.at(-1)!.pattern.meta.name).toBe('n103');
  });

  it('round-trips the label through undo and redo', () => {
    useStore.getState().apply(() => {}, 'flip card 3');
    const undoneLabel = useStore.getState().undo();
    expect(undoneLabel).toBe('flip card 3');
    const redoneLabel = useStore.getState().redo();
    expect(redoneLabel).toBe('flip card 3');
  });

  it('returns undefined from undo/redo when there is nothing to move through', () => {
    expect(useStore.getState().undo()).toBeUndefined();
    expect(useStore.getState().redo()).toBeUndefined();
  });

  it('clears both undo and redo history on load', () => {
    useStore.getState().apply((draft) => { draft.meta.name = 'before-load'; }, 'a');
    useStore.getState().undo();

    useStore.getState().load({
      ...useStore.getState().pattern,
      meta: { name: 'Imported' },
    });

    useStore.getState().undo();
    expect(useStore.getState().pattern.meta.name).toBe('Imported');
    useStore.getState().redo();
    expect(useStore.getState().pattern.meta.name).toBe('Imported');
  });

  it('throws when a nested part of getState().pattern is mutated directly', () => {
    const pattern = useStore.getState().pattern;
    expect(() => { (pattern.meta as { name: string }).name = 'sneaky'; }).toThrow(TypeError);
    expect(() => { pattern.picks[0]![0] = -1; }).toThrow(TypeError);
    expect(() => { pattern.picks.push([...pattern.picks[0]!]); }).toThrow(TypeError);
    expect(() => { pattern.cards[0]!.colors[0] = 999; }).toThrow(TypeError);
    expect(() => { (pattern.cards as unknown[]).push(pattern.cards[0]); }).toThrow(TypeError);
    expect(() => { (pattern.palette as string[]).push('#000000'); }).toThrow(TypeError);
    // Nothing actually changed.
    expect(pattern.meta.name).not.toBe('sneaky');
    expect(pattern.picks[0]![0]).not.toBe(-1);
  });

  it('keeps undo history correct even after a rejected direct mutation', () => {
    // This reproduces the exact bypass the store must defend against: get a
    // reference to the live pattern and try to write through it instead of
    // going through apply(). The write must throw (previous test) and, just
    // as importantly, must leave apply/undo/redo working correctly afterward.
    const before = useStore.getState().pattern.picks[0]![0];
    const stolen = useStore.getState().pattern;
    expect(() => { stolen.picks[0]![0] = (before === 1 ? -1 : 1); }).toThrow(TypeError);

    useStore.getState().apply((draft) => {
      draft.picks[0]![0] = (before === 1 ? -1 : 1);
    }, 'flip');
    expect(useStore.getState().pattern.picks[0]![0]).not.toBe(before);

    useStore.getState().undo();
    expect(useStore.getState().pattern.picks[0]![0]).toBe(before);
  });

  it("freezes the pattern apply() itself produces, not just reset()'s", () => {
    // The two tests above both capture `pattern` right after beforeEach's
    // reset(), before calling apply() — so they only prove reset() froze it.
    // This exercises apply()'s own freeze call by reading the pattern *after*
    // an apply and attempting direct writes on it.
    const before = useStore.getState().pattern.meta.name;
    useStore.getState().apply((draft) => { draft.meta.name = 'post-apply'; }, 'rename');
    const pattern = useStore.getState().pattern;
    expect(pattern.meta.name).toBe('post-apply');

    // A nested array element (frozen by the array recursion branch).
    expect(() => { pattern.picks[0]![0] = -1; }).toThrow(TypeError);
    // A nested object property (frozen by the object recursion branch).
    expect(() => {
      pattern.cards[0]!.threading = pattern.cards[0]!.threading === 'S' ? 'Z' : 'S';
    }).toThrow(TypeError);
    expect(pattern.picks[0]![0]).not.toBe(-1);

    // apply/undo still work correctly afterward, and undo's returned label
    // matches the change it reverted.
    const label = useStore.getState().undo();
    expect(label).toBe('rename');
    expect(useStore.getState().pattern.meta.name).toBe(before);
  });

  it('reset() restores orientation, render mode, screen mode and current pick too', () => {
    useStore.getState().setOrientation('horizontal');
    useStore.getState().setRender('dots');
    useStore.getState().setMode('weave');
    useStore.getState().setCurrentPick(5);
    useStore.getState().apply((draft) => { draft.meta.name = 'dirty'; }, 'dirty');

    useStore.getState().reset();
    const state = useStore.getState();
    expect(state.orientation).toBe('vertical');
    expect(state.render).toBe('woven');
    expect(state.mode).toBe('design');
    expect(state.currentPick).toBe(0);
    expect(state.pattern.meta.name).toBe('Chevron');
    expect(state.orientationPinned).toBe(false);
  });

  it('starts with the first palette entry as the brush', () => {
    expect(useStore.getState().brush).toBe(0);
  });

  it('sets the brush, including the erase brush', () => {
    useStore.getState().setBrush(3);
    expect(useStore.getState().brush).toBe(3);
    useStore.getState().setBrush(null);
    expect(useStore.getState().brush).toBeNull();
  });

  it('takes paint as a screen mode', () => {
    useStore.getState().setMode('paint');
    expect(useStore.getState().mode).toBe('paint');
  });

  it('restores the brush and the mode on reset', () => {
    useStore.getState().setBrush(null);
    useStore.getState().setMode('paint');
    useStore.getState().reset();
    expect(useStore.getState().brush).toBe(0);
    expect(useStore.getState().mode).toBe('design');
  });

  // The two orientation setters differ only in authority: `setOrientation` is
  // the weaver choosing, `suggestOrientation` is the viewport suggesting, and a
  // suggestion must never overrule a choice.
  describe('orientation', () => {
    it('follows suggestOrientation while nothing has been chosen', () => {
      useStore.getState().suggestOrientation('horizontal');
      expect(useStore.getState().orientation).toBe('horizontal');
      expect(useStore.getState().orientationPinned).toBe(false);
    });

    it('pins on setOrientation, so suggestOrientation stops applying', () => {
      useStore.getState().setOrientation('vertical');
      expect(useStore.getState().orientationPinned).toBe(true);

      useStore.getState().suggestOrientation('horizontal');
      expect(useStore.getState().orientation).toBe('vertical');
    });

    // reset() cannot read a viewport, so it falls back to the last thing the
    // viewport asked for — which is why the suggestion is remembered rather
    // than only applied.
    it('falls back to the viewport last suggestion on reset, not to vertical', () => {
      useStore.getState().suggestOrientation('horizontal');
      useStore.getState().setOrientation('vertical');

      useStore.getState().reset();

      expect(useStore.getState().orientation).toBe('horizontal');
      expect(useStore.getState().orientationPinned).toBe(false);
    });

    // A window being dragged fires `resize` continuously, and every one of
    // those calls the same suggestion. Board subscribes to the whole store, so
    // a `set` per event is a re-render of the largest grid on screen per
    // event; a repeat suggestion has to be free.
    it('does not notify subscribers when the suggestion is unchanged', () => {
      useStore.getState().suggestOrientation('horizontal');

      let notifications = 0;
      const unsubscribe = useStore.subscribe(() => { notifications += 1; });
      useStore.getState().suggestOrientation('horizontal');
      useStore.getState().suggestOrientation('horizontal');
      expect(notifications).toBe(0);

      useStore.getState().suggestOrientation('vertical');
      expect(notifications).toBe(1);
      unsubscribe();
    });

    it('still records a repeat suggestion that the pin is hiding', () => {
      useStore.getState().setOrientation('vertical');
      useStore.getState().suggestOrientation('horizontal');

      // The pin kept the board vertical, so the second, identical suggestion
      // changes nothing — but dropping the pin must still land on horizontal.
      useStore.getState().suggestOrientation('horizontal');
      useStore.getState().reset();

      expect(useStore.getState().orientation).toBe('horizontal');
    });

    it('pins even when the choice matches what is already showing', () => {
      useStore.getState().suggestOrientation('horizontal');
      useStore.getState().setOrientation('horizontal');

      useStore.getState().suggestOrientation('vertical');
      expect(useStore.getState().orientation).toBe('horizontal');
    });
  });
});

describe('gesture token API (beginGesture / continueGesture)', () => {
  beforeEach(() => useStore.getState().reset());

  it('throws when continueGesture is called with no gesture ever begun', () => {
    // A caller who reaches for `continueGesture` directly (skipping
    // `beginGesture`) has no way to produce a token in the first place —
    // `GestureToken` is a `symbol`, so `undefined` is the closest a caller
    // could pass without TypeScript already refusing to compile. Either
    // way, the store must not silently accept it.
    expect(() => {
      useStore.getState().continueGesture(undefined as never, () => {});
    }).toThrow();
  });

  it('throws when continueGesture is called with a stale token from a finished gesture', () => {
    const token = useStore.getState().beginGesture((draft) => {
      draft.meta.name = 'first';
    }, 'first');

    // A later, unrelated `apply` ends the gesture (this is what a normal
    // pointerup + some other edit looks like, or — the scenario the
    // reviewer flagged — a careless reuse of an old token after the drag
    // that produced it is long over).
    useStore.getState().apply((draft) => { draft.meta.name = 'second'; }, 'second');

    expect(() => {
      useStore.getState().continueGesture(token, (draft) => { draft.meta.name = 'stale'; });
    }).toThrow();

    // And the throw must not have mutated anything.
    expect(useStore.getState().pattern.meta.name).toBe('second');
  });

  it('throws when continueGesture is called with a stale token after undo/load/reset', () => {
    const afterUndo = useStore.getState().beginGesture((d) => { d.meta.name = 'a'; }, 'a');
    useStore.getState().undo();
    expect(() => useStore.getState().continueGesture(afterUndo, () => {})).toThrow();

    const afterLoad = useStore.getState().beginGesture((d) => { d.meta.name = 'c'; }, 'c');
    useStore.getState().load(useStore.getState().pattern);
    expect(() => useStore.getState().continueGesture(afterLoad, () => {})).toThrow();

    const afterReset = useStore.getState().beginGesture((d) => { d.meta.name = 'd'; }, 'd');
    useStore.getState().reset();
    expect(() => useStore.getState().continueGesture(afterReset, () => {})).toThrow();
  });

  it('a stale token stays stale even across a later, unrelated undo/redo cycle', () => {
    // `redo()` also clears `openGesture` defensively (for symmetry with
    // `undo`/`apply`/`load`/`reset`), but there is no reachable sequence
    // through the public API where a real `redo()` fires *while* a gesture
    // is still open: both `beginGesture` and `apply` reset `future` to `[]`
    // the moment they run, so by the time anything could populate `future`
    // again (only `undo()` does), any gesture open before that point has
    // already been invalidated by that same `undo()`. What *is* reachable,
    // and the guarantee that actually matters, is this: once a gesture's
    // token has gone stale, no amount of unrelated later undo/redo activity
    // ever makes it valid again.
    const staleToken = useStore.getState().beginGesture((d) => { d.meta.name = 'gesture'; }, 'gesture');
    useStore.getState().apply((d) => { d.meta.name = 'unrelated'; }, 'unrelated'); // ends the gesture

    useStore.getState().undo();
    useStore.getState().redo();

    expect(() => useStore.getState().continueGesture(staleToken, () => {})).toThrow();
  });

  it('a normal gesture (begin + several continues) still produces exactly one history entry and undoes completely', () => {
    const before = structuredClone(useStore.getState().pattern);

    const token = useStore.getState().beginGesture((draft) => {
      draft.picks[0]![0] = -draft.picks[0]![0]! as -1 | 1;
    }, 'paint');
    useStore.getState().continueGesture(token, (draft) => {
      draft.picks[1]![0] = -draft.picks[1]![0]! as -1 | 1;
    });
    useStore.getState().continueGesture(token, (draft) => {
      draft.picks[2]![0] = -draft.picks[2]![0]! as -1 | 1;
    });

    expect(useStore.getState().past).toHaveLength(1);
    expect(useStore.getState().pattern).not.toEqual(before);

    const label = useStore.getState().undo();
    expect(label).toBe('paint');
    expect(useStore.getState().pattern).toEqual(before);
    expect(useStore.getState().past).toHaveLength(0);
  });

  it('keeps the freeze contract through a gesture: getState().pattern and past[i].pattern are both frozen', () => {
    const token = useStore.getState().beginGesture((draft) => {
      draft.picks[0]![0] = -draft.picks[0]![0]! as -1 | 1;
    }, 'paint');
    useStore.getState().continueGesture(token, (draft) => {
      draft.picks[1]![0] = -draft.picks[1]![0]! as -1 | 1;
    });

    const live = useStore.getState().pattern;
    expect(() => { (live.picks[1] as (-1 | 1)[])[0] = 1; }).toThrow(TypeError);
    expect(() => { (live.cards[0] as { threading: string }).threading = 'Z'; }).toThrow(TypeError);

    const entry = useStore.getState().past[0]!;
    expect(() => { (entry.pattern.picks[0] as (-1 | 1)[])[0] = 1; }).toThrow(TypeError);
  });
});
