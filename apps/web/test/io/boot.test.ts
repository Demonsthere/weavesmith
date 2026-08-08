import { beforeEach, describe, expect, it } from 'vitest';
import { bootPattern } from '../../src/io/boot.js';
import { encodePattern } from '../../src/io/share.js';
import { autosave } from '../../src/io/storage.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

const named = (name: string) => ({ ...defaultPattern(), meta: { name } });

const UNREADABLE = 'this link could not be read';

describe('bootPattern', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to the default band on a cold start', () => {
    expect(bootPattern('', UNREADABLE)).toEqual({ pattern: defaultPattern(), problems: null });
  });

  it('restores the autosave when there is one', () => {
    autosave(named('Interrupted'));
    expect(bootPattern('', UNREADABLE).pattern.meta.name).toBe('Interrupted');
  });

  it('opens a shared pattern from the hash', () => {
    const shared = named('Shared');
    expect(bootPattern(`#p=${encodePattern(shared)}`, UNREADABLE).pattern).toEqual(shared);
  });

  it('prefers the share link over the autosave', () => {
    // Someone sent you a band; opening their link must show *their* band,
    // not whatever you happened to be working on last.
    autosave(named('Mine'));
    expect(
      bootPattern(`#p=${encodePattern(named('Theirs'))}`, UNREADABLE).pattern.meta.name,
    ).toBe('Theirs');
  });

  it('reports a damaged link and falls back rather than showing nothing', () => {
    autosave(named('Mine'));
    const booted = bootPattern('#p=not-a-real-hash', UNREADABLE);
    expect(booted.problems).not.toBeNull();
    expect(booted.pattern.meta.name).toBe('Mine');
  });

  it('ignores a hash that is not a share link', () => {
    expect(bootPattern('#/chart', UNREADABLE)).toEqual({
      pattern: defaultPattern(),
      problems: null,
    });
  });
});
