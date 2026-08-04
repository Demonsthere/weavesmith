import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTOSAVE_DELAY,
  autosave,
  autosaveSoon,
  listSaves,
  open,
  restore,
  save,
} from '../../src/io/storage.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(restore()).toBeNull();
  });

  it('round-trips the autosave', () => {
    const pattern = defaultPattern();
    autosave(pattern);
    expect(restore()).toEqual(pattern);
  });

  it('ignores a corrupted autosave rather than crashing on load', () => {
    localStorage.setItem('weavesmith:autosave', '{ broken');
    expect(restore()).toBeNull();
  });

  it('lists named saves', () => {
    save('Snartemo', defaultPattern());
    save('Birka', defaultPattern());
    expect(listSaves().sort()).toEqual(['Birka', 'Snartemo']);
  });

  it('opens a named save', () => {
    const pattern = defaultPattern();
    save('Chevron', pattern);
    expect(open('Chevron')).toEqual(pattern);
  });

  it('opens nothing for a name that was never saved', () => {
    expect(open('Nonesuch')).toBeNull();
  });

  it('survives storage that refuses to write', () => {
    // Safari private mode and a full quota both throw from setItem. Failing
    // to persist must not take down the running app.
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => autosave(defaultPattern())).not.toThrow();
    setItem.mockRestore();
  });
});

describe('autosaveSoon', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('does not write until the delay has passed', () => {
    autosaveSoon(defaultPattern());
    expect(restore()).toBeNull();
    vi.advanceTimersByTime(AUTOSAVE_DELAY);
    expect(restore()).toEqual(defaultPattern());
  });

  it('collapses a burst of calls into one write', () => {
    // A pointer drag calls this on every move; the point of the debounce is
    // that the whole drag costs one serialise, not one per pointermove.
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    for (let i = 0; i < 20; i += 1) autosaveSoon(defaultPattern());
    vi.advanceTimersByTime(AUTOSAVE_DELAY);
    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });

  it('writes the last pattern it was given, not the first', () => {
    const first = defaultPattern();
    const last = { ...defaultPattern(), meta: { name: 'Later' } };
    autosaveSoon(first);
    autosaveSoon(last);
    vi.advanceTimersByTime(AUTOSAVE_DELAY);
    expect(restore()?.meta.name).toBe('Later');
  });
});
