import { describe, expect, it } from 'vitest';
import { CATALOGUES, LOCALES } from '../../src/i18n/catalogues.js';
import { en } from '../../src/i18n/messages/en.js';

/**
 * One argument object carrying every field any interpolating key asks for, so
 * a single probe can invoke all of them. The values only have to make a
 * plausible sentence — what the checks below look at is the shape of the
 * output, not its content.
 */
const PROBE = {
  count: 2,
  index: 1,
  threading: 'S',
  card: 1,
  pick: 1,
  forward: true,
  hex: '#B4402C',
  hole: 'A',
  color: 'marzanna',
  display: '+2',
  turns: '+2 turns',
  after: 'after 2 picks',
  name: 'band.json',
  url: 'https://example.test/#p=abc',
  unreachable: '0 cells unreachable',
  unmet: '0 cells unmet',
};

/**
 * A catalogue value as words. Roughly half the catalogue is function-valued,
 * and the value-shape checks below used to skip every one of those — which is
 * how a key that renders a phrase with a word missing (`summary.twistUniform`
 * in Polish) got past them. The `as never` lands on the argument, never on the
 * value, exactly as `useT`'s `resolve` does it.
 */
const rendered = (value: string | ((a: never) => string)): string =>
  typeof value === 'function' ? value(PROBE as never) : value;

describe('message catalogues', () => {
  // Belt and braces behind `const pl: Messages`, which a future `as any`
  // could defeat. This test cannot be defeated that way.
  it('every locale has exactly the English key set', () => {
    const expected = Object.keys(en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(CATALOGUES[locale]).sort(), locale).toEqual(expected);
    }
  });

  it('no value renders empty', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(CATALOGUES[locale])) {
        expect(rendered(value).trim(), `${locale} ${key}`).not.toBe('');
      }
    }
  });

  // What a half-finished translation looks like: the key copied into the
  // value slot so it typechecks and reads as gibberish on screen.
  it('no value renders as its own key', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(CATALOGUES[locale])) {
        expect(rendered(value), `${locale} ${key}`).not.toBe(key);
      }
    }
  });

  // Guards the probe as much as the catalogue: a key that interpolates a field
  // `PROBE` does not carry renders the literal "undefined" into the middle of
  // a sentence, which is neither empty nor equal to its key and would sail
  // through both checks above.
  it('every interpolating key gets every argument it asks for', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(CATALOGUES[locale])) {
        expect(rendered(value), `${locale} ${key}`).not.toContain('undefined');
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

  // `summary.afterPicks` carries its own preposition, because "po" governs the
  // locative and the counted phrase has to be inflected for the slot it lands
  // in — a nominative "24 przeploty" dropped after "po" is wrong Polish. The
  // locative plural is one form for both `few` and `many` ("przeplotach"), so
  // this key only ever shows two: that is the language, not a lost case.
  it('puts picks in the locative the preposition takes', () => {
    expect(pl['summary.afterPicks']({ count: 1 })).toBe('po 1 przeplocie');
    expect(pl['summary.afterPicks']({ count: 2 })).toBe('po 2 przeplotach');
    expect(pl['summary.afterPicks']({ count: 24 })).toBe('po 24 przeplotach');
    expect(pl['summary.afterPicks']({ count: 25 })).toBe('po 25 przeplotach');
  });

  // Accumulated twist is the one counted thing here that can be negative or
  // zero. `Intl.PluralRules('pl').select(-3)` answers `other`, which would
  // give "−3 obrotów"; correct Polish is "−3 obroty", the same form as +3. So
  // the form is chosen on the magnitude while the sign stays in the display.
  it('inflects a signed turn count on its magnitude', () => {
    expect(pl['summary.turns']({ display: '+1', count: 1 })).toBe('+1 obrót');
    expect(pl['summary.turns']({ display: '+3', count: 3 })).toBe('+3 obroty');
    expect(pl['summary.turns']({ display: '+8', count: 8 })).toBe('+8 obrotów');
    expect(pl['summary.turns']({ display: '-1', count: -1 })).toBe('-1 obrót');
    expect(pl['summary.turns']({ display: '-3', count: -3 })).toBe('-3 obroty');
    expect(pl['summary.turns']({ display: '-8', count: -8 })).toBe('-8 obrotów');
    expect(pl['summary.turns']({ display: '0', count: 0 })).toBe('0 obrotów');
  });

  // Just the noun: the stepper renders the number in its own element, so a
  // counted phrase would print the count twice. 4 and 22 are `few`, 5 and 25
  // are `many` — and card counts run 4–40, so a fixed "tabliczek" is wrong for
  // about nine of the counts a weaver can reach.
  it('inflects the bare stepper noun for its neighbouring count', () => {
    expect(pl['stepper.cards']({ count: 4 })).toBe('tabliczki');
    expect(pl['stepper.cards']({ count: 5 })).toBe('tabliczek');
    expect(pl['stepper.cards']({ count: 22 })).toBe('tabliczki');
    expect(pl['stepper.cards']({ count: 25 })).toBe('tabliczek');
  });
});

describe('English plurals', () => {
  it('adds s past one', () => {
    expect(en['summary.cards']({ count: 1 })).toBe('1 card');
    expect(en['summary.cards']({ count: 3 })).toBe('3 cards');
  });

  // Same rule as Polish, for the same reason: −1 inflects like 1.
  it('inflects a signed turn count on its magnitude', () => {
    expect(en['summary.turns']({ display: '+1', count: 1 })).toBe('+1 turn');
    expect(en['summary.turns']({ display: '-1', count: -1 })).toBe('-1 turn');
    expect(en['summary.turns']({ display: '-3', count: -3 })).toBe('-3 turns');
    expect(en['summary.turns']({ display: '0', count: 0 })).toBe('0 turns');
  });

  it('keeps the bare stepper noun plural for every reachable count', () => {
    expect(en['stepper.cards']({ count: 4 })).toBe('cards');
    expect(en['stepper.cards']({ count: 40 })).toBe('cards');
  });
});
