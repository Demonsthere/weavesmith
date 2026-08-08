import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootPattern } from '../../src/io/boot.js';
import * as share from '../../src/io/share.js';
import { encodePattern } from '../../src/io/share.js';
import { autosave } from '../../src/io/storage.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

const named = (name: string) => ({ ...defaultPattern(), meta: { name } });

describe('bootPattern', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('falls back to the default band on a cold start', () => {
    expect(bootPattern('')).toEqual({
      pattern: defaultPattern(),
      problems: null,
      unreadable: false,
    });
  });

  it('restores the autosave when there is one', () => {
    autosave(named('Interrupted'));
    expect(bootPattern('').pattern.meta.name).toBe('Interrupted');
  });

  it('opens a shared pattern from the hash', () => {
    const shared = named('Shared');
    expect(bootPattern(`#p=${encodePattern(shared)}`).pattern).toEqual(shared);
  });

  it('prefers the share link over the autosave', () => {
    // Someone sent you a band; opening their link must show *their* band,
    // not whatever you happened to be working on last.
    autosave(named('Mine'));
    expect(bootPattern(`#p=${encodePattern(named('Theirs'))}`).pattern.meta.name).toBe('Theirs');
  });

  it('reports a damaged link and falls back rather than showing nothing', () => {
    // decodePattern wraps this input in a PatternError of its own (it is
    // not valid deflate/base64 at all), so this exercises the "core-shaped
    // problems" arm, not `unreadable` — see the dedicated test below for
    // that arm.
    autosave(named('Mine'));
    const booted = bootPattern('#p=not-a-real-hash');
    expect(booted.problems).not.toBeNull();
    expect(booted.unreadable).toBe(false);
    expect(booted.pattern.meta.name).toBe('Mine');
  });

  it('ignores a hash that is not a share link', () => {
    expect(bootPattern('#/chart')).toEqual({
      pattern: defaultPattern(),
      problems: null,
      unreadable: false,
    });
  });

  it('marks a share link unreadable, rather than reporting a core problem list, when decoding throws something other than a PatternError', () => {
    // decodePattern's own try/catch already converts every failure it can
    // produce into a PatternError, so no real hash reaches this arm today —
    // but `catch (error)` is typed `unknown`, and bootPattern's contract has
    // to be total for whatever it receives, not just what decodePattern
    // currently throws.
    vi.spyOn(share, 'decodePattern').mockImplementation(() => {
      throw new Error('not a PatternError');
    });
    autosave(named('Mine'));
    const booted = bootPattern('#p=anything');
    expect(booted).toEqual({ pattern: named('Mine'), problems: null, unreadable: true });
  });
});
