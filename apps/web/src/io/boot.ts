import { PatternError } from '@weavesmith/core';
import type { Pattern } from '@weavesmith/core';
import { decodePattern } from './share.js';
import { restore } from './storage.js';
import { defaultPattern } from '../state/defaultPattern.js';

export interface Booted {
  pattern: Pattern;
  /**
   * What core reported wrong with the share link, verbatim — `null` when
   * there was nothing to report, including when the failure was total (see
   * `unreadable`).
   */
  problems: string[] | null;
  /**
   * True when the link could not be decoded at all, rather than decoding far
   * enough for core to say what was wrong with it. This is our own fact, not
   * core's, and `bootPattern` is not a component and cannot resolve a
   * locale — it reports the fact and leaves the caller to render it through
   * its own catalogue, at render time, rather than baking a translated
   * sentence into this result (which would freeze it in whatever locale was
   * active before the boot effect's own `setLocale` call has run).
   */
  unreadable: boolean;
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
export function bootPattern(hash: string): Booted {
  const fallback = (): Pattern => restore() ?? defaultPattern();

  if (!hash.startsWith(SHARE_PREFIX)) {
    return { pattern: fallback(), problems: null, unreadable: false };
  }

  try {
    return {
      pattern: decodePattern(hash.slice(SHARE_PREFIX.length)),
      problems: null,
      unreadable: false,
    };
  } catch (error) {
    // decodePattern's own catch already converts every failure it can
    // produce into a PatternError, so this else arm guards a shape it
    // cannot currently throw — but `catch (error)` is typed `unknown`, and
    // bootPattern's contract has to be total for whatever it receives.
    if (error instanceof PatternError) {
      return { pattern: fallback(), problems: error.problems, unreadable: false };
    }
    return { pattern: fallback(), problems: null, unreadable: true };
  }
}
