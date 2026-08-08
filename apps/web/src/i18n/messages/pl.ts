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
  'board.label': 'Plansza tkania',
  'stepper.group': 'Liczba tabliczek',
  'stepper.remove': 'Usuń tabliczkę',
  'stepper.cards': 'tabliczek',
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
  'summary.twistUniform': (a: { turns: string; picks: string }) =>
    `Każda tabliczka kończy na ${a.turns} po ${a.picks}.`,
  'summary.twistVaries': (a: { picks: string }) =>
    `Tabliczki kończą z różnym skrętem po ${a.picks}:`,
  'summary.twistCard': (a: { index: number; turns: string }) =>
    `Tabliczka ${a.index}: ${a.turns}`,
  'summary.againstTarget': 'Wobec wzorca',
  'summary.targetLine': (a: { unreachable: string; unmet: string }) =>
    `${a.unreachable}, ${a.unmet}.`,
  'footer.source': 'Źródło na GitHubie',
  'footer.coffeeAlt': 'Postaw kawę dla demonsthere na buycoffee.to',
};
