import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLocale,
  clearOrientation,
  readLocale,
  readOrientation,
  writeLocale,
  writeOrientation,
} from '../../src/io/preferences.js';

describe('preferences', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing has been chosen', () => {
    expect(readOrientation()).toBeNull();
  });

  it('round-trips a chosen orientation', () => {
    writeOrientation('horizontal');
    expect(readOrientation()).toBe('horizontal');
    writeOrientation('vertical');
    expect(readOrientation()).toBe('vertical');
  });

  // A stored value is untrusted input: it can be from an older build, another
  // tab's bug, or a hand-edited devtools session. Anything unrecognised means
  // "no choice on record", which puts the automatic default back in charge —
  // never a board rendered with an orientation the app has no code for.
  it('ignores a value that is not an orientation', () => {
    localStorage.setItem('weavesmith:orientation', 'sideways');
    expect(readOrientation()).toBeNull();
  });

  it('forgets the override on clear', () => {
    writeOrientation('horizontal');
    clearOrientation();
    expect(readOrientation()).toBeNull();
  });
});

describe('locale preference', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a locale', () => {
    writeLocale('pl');
    expect(readLocale()).toBe('pl');
  });

  it('reads null when nothing is stored', () => {
    expect(readLocale()).toBeNull();
  });

  // Validated, not cast: a stored value is untrusted input (an older build,
  // another tab, a hand-edited devtools session). Anything unrecognised must
  // mean "no choice on record" so detection takes over — never a render in a
  // language with no strings.
  it('treats an unrecognised stored value as no choice', () => {
    localStorage.setItem('weavesmith:locale', 'klingon');
    expect(readLocale()).toBeNull();
  });

  it('clears the override', () => {
    writeLocale('pl');
    clearLocale();
    expect(readLocale()).toBeNull();
  });
});
