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

import { pl } from '../../src/i18n/messages/pl.js';

// Categories verified against Node's ICU: 1=one, 2..4=few, 0/5/11/21/25=many,
// 22/102=few. Three noun forms, and 0 takes the same form as 5.
describe('Polish plurals', () => {
  it('uses one/few/many for cells', () => {
    expect(pl['summary.cellsUnmet']({ count: 1 })).toBe('1 komórka niezgodna');
    expect(pl['summary.cellsUnmet']({ count: 3 })).toBe('3 komórki niezgodne');
    expect(pl['summary.cellsUnmet']({ count: 5 })).toBe('5 komórek niezgodnych');
    expect(pl['summary.cellsUnmet']({ count: 22 })).toBe('22 komórki niezgodne');
    expect(pl['summary.cellsUnmet']({ count: 0 })).toBe('0 komórek niezgodnych');
  });

  it('uses one/few/many for cards', () => {
    expect(pl['summary.cards']({ count: 1 })).toBe('1 tabliczka');
    expect(pl['summary.cards']({ count: 4 })).toBe('4 tabliczki');
    expect(pl['summary.cards']({ count: 12 })).toBe('12 tabliczek');
  });

  it('uses one/few/many for picks', () => {
    expect(pl['summary.picks']({ count: 1 })).toBe('1 przeplot');
    expect(pl['summary.picks']({ count: 2 })).toBe('2 przeploty');
    expect(pl['summary.picks']({ count: 24 })).toBe('24 przeploty');
    expect(pl['summary.picks']({ count: 25 })).toBe('25 przeplotów');
  });
});

describe('English plurals', () => {
  it('adds s past one', () => {
    expect(en['summary.cards']({ count: 1 })).toBe('1 card');
    expect(en['summary.cards']({ count: 3 })).toBe('3 cards');
  });
});
