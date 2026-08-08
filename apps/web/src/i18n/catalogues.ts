import { en } from './messages/en.js';
import type { Messages } from './messages/en.js';
import { pl } from './messages/pl.js';

export type Locale = 'en' | 'pl';

/** The only list of languages in the app. A third one is a file plus a line
 *  here — everything else is driven off `Locale` and typechecks itself. */
export const LOCALES: readonly Locale[] = ['en', 'pl'];

export const CATALOGUES: Record<Locale, Messages> = { en, pl };

export const DEFAULT_LOCALE: Locale = 'en';
