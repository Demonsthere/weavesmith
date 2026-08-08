import { describe, expect, it } from 'vitest';
import { CATALOGUES, LOCALES } from '../../src/i18n/catalogues.js';
import { en } from '../../src/i18n/messages/en.js';

describe('message catalogues', () => {
  // Belt and braces behind `const pl: Messages`, which a future `as any`
  // could defeat. This test cannot be defeated that way.
  it('every locale has exactly the English key set', () => {
    const expected = Object.keys(en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(CATALOGUES[locale]).sort(), locale).toEqual(expected);
    }
  });

  it('no value is empty', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(CATALOGUES[locale])) {
        if (typeof value === 'string') expect(value.trim(), `${locale} ${key}`).not.toBe('');
      }
    }
  });

  // What a half-finished translation looks like: the key copied into the
  // value slot so it typechecks and reads as gibberish on screen.
  it('no value is its own key', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(CATALOGUES[locale])) {
        expect(value, `${locale} ${key}`).not.toBe(key);
      }
    }
  });
});
