import type { Messages } from './en.js';

/**
 * The Polish catalogue. The `Messages` annotation is the whole correctness
 * story: a missing key is TS2741, an extra key TS2353, and an interpolating
 * key with the wrong argument shape TS2322. There is no runtime fallback to
 * English, because there is no way to get here with a key missing.
 *
 * Language names stay in their own language ('Polski', not 'Polish') — that
 * is what a reader looking for their own language scans for.
 */

/**
 * Polish needs three forms, and the boundaries are not intuitive: 1 is
 * `one`, 2–4 is `few`, 5–21 is `many` — and then 22 is `few` again, while 25
 * is `many`. Zero takes the `many` form ("0 komórek"). `Intl.PluralRules`
 * carries all of that; a hand-rolled `n < 5` would be wrong from 22 onwards.
 *
 * Categories confirmed against this Node's ICU rather than assumed.
 */
const RULES = new Intl.PluralRules('pl');

interface Forms {
  one: string;
  few: string;
  many: string;
}

const plural = (n: number, forms: Forms): string => {
  const category = RULES.select(n);
  // `other` only arises for fractions, which no count here can be — but it
  // is in the type of `select`, and `many` is the right form if one ever is.
  const form = category === 'one' ? forms.one : category === 'few' ? forms.few : forms.many;
  return `${n} ${form}`;
};

export const pl: Messages = {
  'app.nav.screens': 'Ekrany',
  'app.nav.board': 'Plansza',
  'app.nav.chart': 'Schemat',
  'lang.group': 'Język',
  'lang.en': 'English',
  'lang.pl': 'Polski',
  'mode.design': 'Projekt',
  'mode.paint': 'Malowanie',
  'mode.weave': 'Tkanie',
  'mode.group': 'Tryb ekranu',
  'orientation.group': 'Orientacja',
  'orientation.vertical': '↓ Krajka',
  'orientation.verticalName': 'Krajka pionowa',
  'orientation.horizontal': '→ Krajka',
  'orientation.horizontalName': 'Krajka pozioma',
  'render.group': 'Sposób rysowania',
  'render.woven': 'Tkanina',
  'render.dots': 'Kropki',
  'boot.shareFailed': 'Nie udało się otworzyć tego linku:',
  'boot.unreadable': 'nie udało się odczytać tego linku',
  'summary.cards': (a: { count: number }) =>
    plural(a.count, { one: 'tabliczka', few: 'tabliczki', many: 'tabliczek' }),
  'summary.warpEnds': (a: { count: number }) =>
    plural(a.count, { one: 'nitka osnowy', few: 'nitki osnowy', many: 'nitek osnowy' }),
  'summary.ends': (a: { count: number }) =>
    plural(a.count, { one: 'nitka', few: 'nitki', many: 'nitek' }),
  'summary.picks': (a: { count: number }) =>
    plural(a.count, { one: 'przeplot', few: 'przeploty', many: 'przeplotów' }),
  'summary.turns': (a: { count: number }) =>
    plural(a.count, { one: 'obrót', few: 'obroty', many: 'obrotów' }),
  // The adjective agrees with the noun, so it cannot be appended outside the
  // plural call the way English appends "unreachable".
  'summary.cellsUnreachable': (a: { count: number }) =>
    plural(a.count, {
      one: 'komórka nieosiągalna',
      few: 'komórki nieosiągalne',
      many: 'komórek nieosiągalnych',
    }),
  'summary.cellsUnmet': (a: { count: number }) =>
    plural(a.count, {
      one: 'komórka niezgodna',
      few: 'komórki niezgodne',
      many: 'komórek niezgodnych',
    }),
};
