import { useEffect } from 'react';
import { LOCALES } from './catalogues.js';
import type { Locale } from './catalogues.js';
import { useT } from './useT.js';
import { writeLocale } from '../io/preferences.js';
import { useStore } from '../state/store.js';

/** Each language named in its own language. 'PL' spoken aloud is not a
 *  language name, and a reader looking for their own language scans for the
 *  word they call it by. */
const NAME_KEY = { en: 'lang.en', pl: 'lang.pl' } as const;

/** Short codes in the visible chip: this sits in header chrome that is
 *  already crowded on a phone. The accessible name carries the full word. */
const CODE = { en: 'EN', pl: 'PL' } as const;

export function LanguageToggle() {
  const t = useT();
  const locale = useStore((state) => state.locale);
  const setLocale = useStore((state) => state.setLocale);

  // Screen-reader voice selection and hyphenation both key off this.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const choose = (next: Locale) => {
    setLocale(next);
    writeLocale(next);
  };

  return (
    <div className="segmented" role="group" aria-label={t('lang.group')}>
      {LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          lang={value}
          aria-label={t(NAME_KEY[value])}
          aria-pressed={locale === value}
          onClick={() => choose(value)}
        >
          {CODE[value]}
        </button>
      ))}
    </div>
  );
}
