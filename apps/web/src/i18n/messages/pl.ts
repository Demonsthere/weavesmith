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

/**
 * Which of the three forms a count takes, without the number in front of it —
 * for the places where the number is drawn separately (the card stepper) or
 * carries a sign (accumulated twist).
 *
 * Selected on the *magnitude*: `RULES.select(-3)` answers `other`, which would
 * give "−3 obrotów", while correct Polish is "−3 obroty" — a negative inflects
 * exactly like its positive counterpart.
 */
const form = (n: number, forms: Forms): string => {
  const category = RULES.select(Math.abs(n));
  // `other` only arises for fractions, which no count here can be — but it
  // is in the type of `select`, and `many` is the right form if one ever is.
  return category === 'one' ? forms.one : category === 'few' ? forms.few : forms.many;
};

const plural = (n: number, forms: Forms): string => `${n} ${form(n, forms)}`;

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
  // "po" governs the locative, so this is not the nominative "24 przeploty"
  // with a preposition in front of it: it is "po 24 przeplotach". The locative
  // plural is a single form, so `few` and `many` coincide here — that is the
  // language, not a missing case.
  'summary.afterPicks': (a: { count: number }) =>
    `po ${plural(a.count, { one: 'przeplocie', few: 'przeplotach', many: 'przeplotach' })}`,
  // Signed, so the form comes from `count` (via `form`'s magnitude rule) and
  // the sign from `display`. "+8 obrotów", "−3 obroty", "+1 obrót".
  'summary.turns': (a: { display: string; count: number }) =>
    `${a.display} ${form(a.count, { one: 'obrót', few: 'obroty', many: 'obrotów' })}`,
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
  'board.label': 'Plansza tkania',
  'stepper.group': 'Liczba tabliczek',
  // Same words as `editor.deleteCard`, on purpose. English needs "Remove a
  // card" vs "Delete card" because it has no case to lean on; Polish says the
  // plain thing once and lets context carry the rest — and the context is
  // never ambiguous, because the editor is a modal `<dialog>`, so while its
  // delete button exists this one is inert. Padding the label to
  // 'Usuń jedną tabliczkę' bought a distinction no user was missing.
  'stepper.remove': 'Usuń tabliczkę',
  // The noun beside the stepper's number. An invariant 'tabliczek' was wrong
  // for every `few` count the stepper can reach — 4, 22, 23, 24, 32… — which
  // is about nine of the 37 counts between MIN_CARDS and MAX_CARDS.
  'stepper.cards': (a: { count: number }) =>
    form(a.count, { one: 'tabliczka', few: 'tabliczki', many: 'tabliczek' }),
  'stepper.addS': 'Dodaj tabliczkę przewleczoną S',
  'stepper.addZ': 'Dodaj tabliczkę przewleczoną Z',
  'chip.label': (a: { index: number; threading: string }) =>
    `Tabliczka ${a.index}, przewleczona ${a.threading}, edytuj`,
  'cell.label': (a: { card: number; pick: number; forward: boolean }) =>
    `Tabliczka ${a.card}, przeplot ${a.pick}, obrót ${a.forward ? 'do przodu' : 'do tyłu'}`,
  'cell.wantedSolve': (a: { hex: string }) => `, oczekiwano ${a.hex} — naciśnij Rozwiąż`,
  'cell.wantedUnreachable': (a: { hex: string }) => `, oczekiwano ${a.hex} — nieosiągalne`,
  'wool.walnut': 'orzech',
  'wool.madder': 'marzanna',
  'wool.woad': 'urzet',
  'wool.weld': 'rezeda',
  'wool.undyed': 'niebarwiona',
  'editor.title': (a: { index: number }) => `Tabliczka ${a.index}`,
  'editor.subtitle': 'Przewleczenie i kolory otworów',
  'editor.threadingGroup': 'Kierunek przewleczenia',
  'editor.threadedS': 'Przewleczona S',
  'editor.threadedZ': 'Przewleczona Z',
  'editor.holes': 'Otwory',
  'editor.holeLabel': (a: { hole: string; hex: string }) => `Otwór ${a.hole}: ${a.hex}`,
  'editor.dyedWool': 'Barwiona wełna',
  'editor.inThisBand': 'W tej krajce',
  'editor.setHoleTo': (a: { color: string }) =>
    `Ustaw wybrany otwór na ${a.color}`,
  'editor.customColour': 'Własny kolor',
  'editor.customHint': 'Własny — dotyczy wybranego otworu',
  // Deliberately the same as `stepper.remove` — see the note there. Prefer the
  // plain form in Polish; only reach for a longer label when two of them are
  // reachable in the same breath, which these two are not.
  'editor.deleteCard': 'Usuń tabliczkę',
  'editor.done': 'Gotowe',
  'brush.group': 'Kolor pędzla',
  'brush.swatch': (a: { index: number; color: string }) => `Pędzel ${a.index}, ${a.color}`,
  'brush.erase': 'Pędzel wymazujący',
  'brush.solve': 'Rozwiąż',
  'weave.pick': 'Przeplot',
  'weave.turnsLabel': 'Kierunek obrotu każdej tabliczki w tym przeplocie',
  'weave.cardTurning': (a: { index: number; forward: boolean }) =>
    `Tabliczka ${a.index} obraca się ${a.forward ? 'do przodu' : 'do tyłu'}`,
  'weave.back': 'Wstecz',
  'weave.nextPick': 'Następny przeplot',
  'file.download': 'Pobierz',
  'file.open': 'Otwórz plik wzoru',
  'file.exportSVG': 'Eksportuj SVG',
  'file.exportPNG': 'Eksportuj PNG',
  'file.copyLink': 'Kopiuj link',
  'file.resetToDefault': 'Przywróć domyślną',
  'file.confirmResetGroup': 'Potwierdź przywrócenie',
  'file.discardAndReset': 'Odrzuć i zacznij od nowa',
  'file.cancel': 'Anuluj',
  'file.unreadable': 'nie udało się odczytać tego pliku',
  'file.unknownReason': 'nieznany powód',
  'file.pngFailed':
    'Nie udało się utworzyć PNG. Eksport SVG działa wszędzie i lepiej się drukuje:',
  'export.notAnSVG': 'To nie wygląda na dokument SVG.',
  // Not a literal rendering of the English: "kanwa" for the canvas element is
  // jargon a weaver has no reason to know, and naming the element buys nothing
  // — what matters is that this browser cannot do it, so try the SVG export.
  'export.noCanvas': 'Ta przeglądarka nie wspiera rysowania.',
  'export.tooSlow': 'Rysowanie krajki trwało za długo. Spróbuj eksportu SVG.',
  'export.noPNG': 'Ta przeglądarka nie potrafi zamienić krajki w PNG.',
  'export.notDrawable': 'Nie udało się narysować krajki jako obrazu.',
  'file.notAPattern': (a: { name: string }) => `${a.name} nie jest wzorem WeaveSmith:`,
  'file.backToDefault': 'Powrót do domyślnej krajki.',
  'file.cannotShare': 'Tej krajki nie można jeszcze udostępnić:',
  'file.tooLargeToShare':
    'Ta krajka jest za duża, aby zmieścić ją w linku. Użyj Pobierz i wyślij plik.',
  'file.noClipboard': 'Schowek jest tu niedostępny. Skopiuj ten link ręcznie:',
  'file.linkCopied': 'Link do udostępnienia skopiowany.',
  'name.label': 'Nazwa wzoru',
  'chart.print': 'Wydrukuj lub zapisz jako PDF',
  'chart.qrAlt': (a: { url: string }) => `Kod QR prowadzący do ${a.url}`,
  'chart.threading': 'Przewleczenie',
  'chart.hole': 'Otwór',
  'chart.turningChart': 'Tabela obrotów',
  'chart.pick': 'Przeplot',
  'chart.forward': 'Do przodu',
  'chart.backward': 'Do tyłu',
  'summary.heading': 'Podsumowanie',
  'summary.perCard': '(cztery na tabliczkę).',
  'summary.warpThreads': 'Nitki osnowy',
  'summary.twistHeading': 'Skumulowany skręt',
  // "ma" takes the accusative, which for these numerals is the very form
  // `summary.turns` produces ("ma +1 obrót", "ma +3 obroty", "ma +8
  // obrotów") — where the previous "kończy na …" would have needed a locative
  // ("na +8 obrotach") and so could not reuse the counted noun at all. The
  // sentence used to have no word for its own number: "kończy na +8 po …".
  'summary.twistUniform': (a: { turns: string; after: string }) =>
    `Każda tabliczka ma ${a.turns} ${a.after}.`,
  'summary.twistVaries': (a: { after: string }) =>
    `Tabliczki kończą z różnym skrętem ${a.after}:`,
  'summary.twistCard': (a: { index: number; turns: string }) =>
    `Tabliczka ${a.index}: ${a.turns}`,
  'summary.againstTarget': 'Wobec wzorca',
  'summary.targetLine': (a: { unreachable: string; unmet: string }) =>
    `${a.unreachable}, ${a.unmet}.`,
  'footer.source': 'Źródło na GitHubie',
  'footer.coffeeAlt': 'Postaw kawę dla demonsthere na buycoffee.to',
};
