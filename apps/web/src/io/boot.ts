import { PatternError } from '@weavesmith/core';
import type { Pattern } from '@weavesmith/core';
import { decodePattern } from './share.js';
import { restore } from './storage.js';
import { defaultPattern } from '../state/defaultPattern.js';

export interface Booted {
  pattern: Pattern;
  /** What was wrong with the share link, if there was one and it failed. */
  problems: string[] | null;
}

const SHARE_PREFIX = '#p=';

/**
 * Which band the app opens with: a shared one from the hash, else the
 * autosave, else the default.
 *
 * A share link wins over the autosave deliberately — someone sent you their
 * band, and showing your own instead would look like the link was broken.
 * A *damaged* link does not cost you your work either: it reports the
 * problem and still falls back, because a blank screen tells the weaver
 * nothing about what to do next.
 */
export function bootPattern(hash: string, unreadable: string): Booted {
  const fallback = (): Pattern => restore() ?? defaultPattern();

  if (!hash.startsWith(SHARE_PREFIX)) return { pattern: fallback(), problems: null };

  try {
    return { pattern: decodePattern(hash.slice(SHARE_PREFIX.length)), problems: null };
  } catch (error) {
    const problems = error instanceof PatternError ? error.problems : [unreadable];
    return { pattern: fallback(), problems };
  }
}
