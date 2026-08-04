import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { WeaveBar } from '../../src/weave/WeaveBar.js';
import { useStore } from '../../src/state/store.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';
import { savePosition } from '../../src/weave/position.js';

/**
 * Opening a document re-hydrates the loom position. Task 9 keyed that effect
 * on the pattern *name* alone, which was unreachable then because nothing
 * called `load()`; Task 11's file/share/restore paths call it constantly, so
 * two different bands that happen to share a name would have kept the first
 * one's position.
 */
describe('position hydration across loads', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.getState().reset();
  });

  it('re-hydrates when a different document with the same name is loaded', () => {
    savePosition('Chevron', 5);
    render(<WeaveBar />);
    expect(useStore.getState().currentPick).toBe(5);

    // A different band, same name. `load()` resets currentPick to 0; the
    // hydration effect must run again and restore this name's position.
    act(() => {
      useStore.getState().load({ ...defaultPattern(), picks: defaultPattern().picks.slice(0, 12) });
    });

    expect(useStore.getState().currentPick).toBe(5);
  });

  it('does not re-hydrate on an ordinary edit', () => {
    // The effect must not fight Back/Next: an edit makes a new frozen
    // pattern object every time, so keying hydration on the pattern itself
    // would drag the weaver back to the stored pick mid-band.
    savePosition('Chevron', 5);
    render(<WeaveBar />);
    act(() => useStore.getState().setCurrentPick(9));

    act(() => useStore.getState().apply((draft) => (draft.meta.name = 'Chevron'), 'rename'));

    expect(useStore.getState().currentPick).toBe(9);
  });
});
