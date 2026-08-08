import { LOCALES } from '../i18n/catalogues.js';
import type { Locale } from '../i18n/catalogues.js';
import type { Orientation } from '../state/store.js';

const ORIENTATION_KEY = 'weavesmith:orientation';
const LOCALE_KEY = 'weavesmith:locale';

const ORIENTATIONS: Orientation[] = ['vertical', 'horizontal'];

/**
 * Display preferences, kept apart from `io/storage.ts` on purpose: that file
 * persists the *document*, this one persists how you are looking at it. A
 * shared band should not carry the orientation of the machine that made it.
 *
 * Same best-effort contract as `storage.ts` — reads return `null` and writes
 * do nothing rather than throwing, because Safari's private mode and a full
 * quota both throw from `localStorage`, and neither is a reason to take down
 * a working session over a preference.
 */
export function readOrientation(): Orientation | null {
  try {
    const raw = localStorage.getItem(ORIENTATION_KEY);
    // Validated, not cast: a stored value is untrusted input (an older
    // build, another tab, a hand-edited devtools session), and anything
    // unrecognised must mean "no choice on record" so the automatic default
    // takes over — never a board rendered with an orientation the app has
    // no code for.
    return ORIENTATIONS.find((value) => value === raw) ?? null;
  } catch {
    return null;
  }
}

export function writeOrientation(orientation: Orientation): void {
  try {
    localStorage.setItem(ORIENTATION_KEY, orientation);
  } catch {
    // Best-effort: the choice still applies for this session.
  }
}

/** Forgets the override, handing the automatic choice back the decision. */
export function clearOrientation(): void {
  try {
    localStorage.removeItem(ORIENTATION_KEY);
  } catch {
    // Same best-effort contract as the writes above.
  }
}

/**
 * Which language the UI reads in. Same best-effort contract as orientation
 * above: reads return `null` and writes do nothing rather than throwing,
 * because Safari's private mode and a full quota both throw from
 * `localStorage`, and neither is a reason to take down a working session
 * over a preference.
 */
export function readLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(LOCALE_KEY);
    // Validated, not cast: a stored value is untrusted input (an older
    // build, another tab, a hand-edited devtools session), and anything
    // unrecognised must mean "no choice on record" so detection takes over
    // — never a render in a language the app has no strings for.
    return LOCALES.find((value) => value === raw) ?? null;
  } catch {
    return null;
  }
}

export function writeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // Best-effort: the choice still applies for this session.
  }
}

/** Forgets the override, handing the automatic choice back the decision. */
export function clearLocale(): void {
  try {
    localStorage.removeItem(LOCALE_KEY);
  } catch {
    // Same best-effort contract as the writes above.
  }
}
