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
export const pl: Messages = {
  'app.nav.screens': 'Ekrany',
  'app.nav.board': 'Plansza',
  'app.nav.chart': 'Schemat',
  'lang.group': 'Język',
  'lang.en': 'English',
  'lang.pl': 'Polski',
};
