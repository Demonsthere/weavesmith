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
  'board.label': 'Weaving board',
  'stepper.group': 'Number of cards',
  'stepper.remove': 'Remove a card',
  'stepper.cards': 'cards',
  'stepper.addS': 'Add an S-threaded card',
  'stepper.addZ': 'Add a Z-threaded card',
  'chip.label': (a: { index: number; threading: string }) =>
    `Card ${a.index}, threaded ${a.threading}, edit`,
  'cell.label': (a: { card: number; pick: number; forward: boolean }) =>
    `Card ${a.card}, pick ${a.pick}, turning ${a.forward ? 'forward' : 'backward'}`,
  'cell.wantedSolve': (a: { hex: string }) => `, wanted ${a.hex} — press Solve`,
  'cell.wantedUnreachable': (a: { hex: string }) => `, wanted ${a.hex} — unreachable`,
  'wool.walnut': 'walnut',
  'wool.madder': 'madder',
  'wool.woad': 'woad',
  'wool.weld': 'weld',
  'wool.undyed': 'undyed',
  'editor.title': (a: { index: number }) => `Card ${a.index}`,
  'editor.subtitle': 'Threading and hole colours',
  'editor.threadingGroup': 'Threading direction',
  'editor.threadedS': 'S threaded',
  'editor.threadedZ': 'Z threaded',
  'editor.holes': 'Holes',
  'editor.holeLabel': (a: { hole: string; hex: string }) => `Hole ${a.hole}: ${a.hex}`,
  'editor.dyedWool': 'Dyed wool',
  'editor.inThisBand': 'In this band',
  'editor.setHoleTo': (a: { color: string }) => `Set the selected hole to ${a.color}`,
  'editor.customColour': 'Custom colour',
  'editor.customHint': 'Custom — applies to the selected hole',
  'editor.deleteCard': 'Delete card',
  'editor.done': 'Done',
  'brush.group': 'Brush colour',
  'brush.swatch': (a: { index: number; color: string }) => `Brush ${a.index}, ${a.color}`,
  'brush.erase': 'Erase brush',
  'brush.solve': 'Solve',
  'weave.pick': 'Pick',
  'weave.turnsLabel': 'Turn direction per card for this pick',
  'weave.cardTurning': (a: { index: number; forward: boolean }) =>
    `Card ${a.index} turning ${a.forward ? 'forward' : 'backward'}`,
  'weave.back': 'Back',
  'weave.nextPick': 'Next pick',
  'file.download': 'Download',
  'file.open': 'Open a pattern file',
  'file.exportSVG': 'Export SVG',
  'file.exportPNG': 'Export PNG',
  'file.copyLink': 'Copy link',
  'file.resetToDefault': 'Reset to default',
  'file.confirmResetGroup': 'Confirm reset',
  'file.discardAndReset': 'Discard and reset',
  'file.cancel': 'Cancel',
  'file.unreadable': 'this file could not be read',
  'file.unknownReason': 'unknown reason',
  'file.pngFailed':
    'The PNG could not be made. The SVG export works everywhere and prints better:',
  'file.notAPattern': (a: { name: string }) => `${a.name} is not a WeaveSmith pattern:`,
  'file.backToDefault': 'Back to the default band.',
  'file.cannotShare': 'This band cannot be shared yet:',
  'file.tooLargeToShare':
    'This band is too large to put in a link. Use Download and send the file instead.',
  'file.noClipboard': 'The clipboard is not available here. Copy this link by hand:',
  'file.linkCopied': 'Share link copied.',
  'name.label': 'Pattern name',
};

export type Messages = typeof en;
export type MessageKey = keyof Messages;
