import { DEFAULT_LOCALE, LOCALES } from './catalogues.js';
import type { Locale } from './catalogues.js';

/**
 * Picks a language from a browser preference list.
 *
 * A pure function over an array rather than a reader of `navigator`, so it
 * is testable without stubbing a global — and so the caller decides whether
 * the list comes from `navigator.languages`, a single `navigator.language`,
 * or a test.
 *
 * Matches on the primary subtag: a weaver whose browser says `pl-PL` wants
 * Polish, and there is no regional Polish catalogue to distinguish.
 */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split('-')[0];
    const match = LOCALES.find((locale) => locale === primary);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
