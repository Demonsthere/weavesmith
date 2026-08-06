import { beforeEach, describe, expect, it } from 'vitest';
import { decodePattern, encodePattern } from '../../src/io/share.js';
import { autosave, restore, clearAutosave } from '../../src/io/storage.js';
import { useStore } from '../../src/state/store.js';

describe('target persistence', () => {
  beforeEach(() => {
    useStore.getState().reset();
    clearAutosave();
  });

  it('survives a share-link round trip', () => {
    const { apply } = useStore.getState();
    apply((draft) => {
      draft.target = draft.picks.map(() => draft.cards.map(() => null));
      draft.target[0]![0] = 1;
    }, 'test');
    const { pattern } = useStore.getState();

    const back = decodePattern(encodePattern(pattern));

    expect(back.target).toBeDefined();
    // gcPalette may renumber, so compare the colour, not the index.
    const wanted = back.palette[back.target![0]![0]!];
    expect(wanted).toBe(pattern.palette[1]);
  });

  it('survives autosave and restore', () => {
    const { apply } = useStore.getState();
    apply((draft) => {
      draft.target = draft.picks.map(() => draft.cards.map(() => null));
      draft.target[1]![2] = 0;
    }, 'test');

    autosave(useStore.getState().pattern);

    expect(restore()!.target![1]![2]).toBe(0);
  });
});
