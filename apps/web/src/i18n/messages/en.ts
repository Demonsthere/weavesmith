/**
 * The English catalogue, and the source of truth for what strings exist.
 *
 * Flat, dotted keys rather than nesting: `MessageKey` is then a plain union
 * of string literals, so `t('app.nav.bord')` is a compile error. Nesting
 * would buy the grouping the dots already give, at the cost of a recursive
 * key type.
 *
 * Deliberately NOT `as const`. Under `as const` the value type of
 * 'app.nav.board' is the literal 'Board', and `const pl: Messages` would
 * then demand the Polish value be the string "Board" too. A plain
 * declaration widens each value to `string`, which is what the annotation
 * needs, while `keyof` keeps the keys literal.
 */

/** English has two forms, and `n === 1` is the whole rule. */
const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

export const en = {
  'app.nav.screens': 'Screens',
  'app.nav.board': 'Board',
  'app.nav.chart': 'Chart',
  'lang.group': 'Language',
  'lang.en': 'English',
  'lang.pl': 'Polski',
  'mode.design': 'Design',
  'mode.paint': 'Paint',
  'mode.weave': 'Weave',
  'mode.group': 'Screen mode',
  'orientation.group': 'Orientation',
  'orientation.vertical': '↓ Band',
  'orientation.verticalName': 'Vertical band',
  'orientation.horizontal': '→ Band',
  'orientation.horizontalName': 'Horizontal band',
  'render.group': 'Render mode',
  'render.woven': 'Woven',
  'render.dots': 'Dots',
  'boot.shareFailed': 'That share link could not be opened:',
  'boot.unreadable': 'this link could not be read',
  'summary.cards': (a: { count: number }) => plural(a.count, 'card', 'cards'),
  'summary.warpEnds': (a: { count: number }) => plural(a.count, 'warp end', 'warp ends'),
  'summary.ends': (a: { count: number }) => plural(a.count, 'end', 'ends'),
  'summary.picks': (a: { count: number }) => plural(a.count, 'pick', 'picks'),
  'summary.turns': (a: { count: number }) => plural(a.count, 'turn', 'turns'),
  'summary.cellsUnreachable': (a: { count: number }) =>
    `${plural(a.count, 'cell', 'cells')} unreachable`,
  'summary.cellsUnmet': (a: { count: number }) => `${plural(a.count, 'cell', 'cells')} unmet`,
};

export type Messages = typeof en;
export type MessageKey = keyof Messages;
