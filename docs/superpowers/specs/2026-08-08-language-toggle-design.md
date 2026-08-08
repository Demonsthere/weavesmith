# A language toggle — English and Polish

Design, 2026-08-08.

## Why

The app is a gift for a Polish weaver, and every word in it is English. GTT is
English-only too, and unmaintained, so it will never be anything else — which
makes the local language the one upgrade over it that costs no weaving
knowledge to appreciate.

Polish first because that is who the app is for. Second because tablet weaving
has a Polish word — **krajki** — that nothing on the internet currently answers
with a working design tool. The repo's own directory is named `krajki`; the
README carries none of it, so a Polish weaver searching in Polish does not find
this project. A Polish section in the README and a bilingual meta description
fix that without touching the app's identity.

Two languages, structured so a third is one file. No claim that Polish is the
last one — only that guessing at the third now would design for a user who has
not asked yet.

## Scope

In: a two-way EN/PL toggle in the header; every static string a user reads in
the app, `aria-label`s included; a Polish section appended to the existing
README; bilingual meta description in `index.html` and the PWA manifest.

Out, by decision (recorded as gaps below, not silently dropped): the dynamic
command messages in `state/commands.ts` that feed the visible live region.

Out, structurally: share-link error details, which originate in
`@weavesmith/core`.

Out, deliberately: the `WeaveSmith` wordmark and the manifest `name`/
`short_name`. Those are the identity, not copy. No Polish keywords in the
visible `h1` — the fretboard framing is worth more than a search term.

## Model

### The catalogue

```
apps/web/src/i18n/messages/en.ts   the source of truth
apps/web/src/i18n/messages/pl.ts   export const pl: typeof en = { ... }
apps/web/src/i18n/locale.ts        Locale, CATALOGUES, detectLocale
apps/web/src/i18n/useT.ts          useT() -> t
```

`en.ts` exports a flat object with dotted keys. Values are `string`, or a
function for the ones that interpolate:

```ts
export const en = {
  'app.nav.screens': 'Screens',
  'app.nav.board': 'Board',
  'board.card.chip': (a: { index: number }) => `Card ${a.index}`,
};

export type Messages = typeof en;
export type MessageKey = keyof Messages;
```

**No `as const`.** It is the obvious thing to reach for and it breaks this
design: under `as const` the value type of `'app.nav.board'` is the literal
`'Board'`, so `const pl: Messages` would demand the Polish value be the string
`Board` too. Plain object declaration widens each string value to `string`,
which is what the annotation needs, while `keyof` keeps the keys literal.

Flat and dotted rather than nested, because `MessageKey` is then a plain union
of string literals and `t('bord.nav')` is a compile error. Nesting buys
grouping that the dots already give and costs a recursive key type.

`pl.ts` is typed `typeof en` and nothing else. That single annotation is the
whole correctness story for translations:

- a **missing** key fails typecheck,
- an **extra** key fails typecheck,
- an interpolating key whose function takes the **wrong arguments** fails
  typecheck.

Checked against this repo's TypeScript before writing this spec, not assumed:
missing key is `TS2741`, extra key is `TS2353`, mismatched interpolation
signature is `TS2322`. Contextual typing also means `pl.ts` writes
`(a) => \`Tabliczka ${a.index}\`` without re-annotating the argument.

No runtime fallback to English, no `key not found` placeholder shipping to a
user, no lint rule to maintain. `pnpm typecheck` is the gate. This is why the
catalogue is hand-rolled: a JSON-file library would typecheck none of it, and
would put ~40kB into a PWA whose promise is opening at a loom with no network.

`useT()` returns `t`, overloaded so that a plain-string key takes no second
argument and a function key requires its arguments. Reading the current locale
through the hook is what re-renders components on a switch.

### Locale state

`locale: Locale` and `setLocale` go on the zustand store in `state/store.ts`,
beside `orientation`, `mode` and `render`. It is the same kind of state: how you
are looking at the band, not what the band is.

Persistence follows `io/preferences.ts` exactly — `readLocale` / `writeLocale` /
`clearLocale` on key `weavesmith:locale`, values **validated against the
`Locale` list rather than cast**, every access wrapped so a private-mode or
quota throw is a missing preference and not a dead session. The reasoning in
that file's header comment already covers why: a stored value is untrusted
input, and anything unrecognised must mean "no choice on record".

The locale is **not** part of `Pattern` and **not** in the share link. A band
shared with a friend must not arrive in the language of the machine that made
it, for the same reason it must not arrive in that machine's orientation.

### Detection

```ts
detectLocale(preferred: readonly string[]): Locale
```

First entry in `navigator.languages` whose primary subtag (`pl` from `pl-PL`)
names a catalogue wins; otherwise `en`. Pure function over an array so it is
testable without touching `navigator`.

Resolution order on boot: stored override, then detection, then `en`. A stored
value that no longer names a real catalogue is treated as absent, so detection
decides — never a render in a language with no strings.

## The toggle

A third `.segmented` group in the header, after the Board/Chart nav. No new CSS;
`aria-pressed` and the existing group styling already carry the state.

Visible text is `EN` / `PL` — short, because it sits in chrome that is already
crowded on a phone. Each button gets:

- `aria-label` with the language's **own** name, `English` and `Polski`, since
  "PL" spoken aloud is not a language name;
- `lang="en"` / `lang="pl"` on the button, so a screen reader pronounces
  `Polski` with Polish phonemes instead of reading it as English.

An effect syncs `document.documentElement.lang` when the locale changes.
`index.html` hardcodes `lang="en"` today, which after this change would be a
lie in Polish mode — and it drives screen-reader voice selection and
hyphenation, so it is not cosmetic.

## String coverage

Translated: the header and nav; all three control groups in `App.tsx`;
`CardStepper`, `CardChip`, `Cell` (aria), `CardEditor`, `BrushStrip`,
`WeaveBar`, `FileMenu`, `PatternName`, `Chart`, `Summary`, `Footer`; the
print-sheet labels; and the sentence that introduces a share-link failure.

One refactor this forces. `App.tsx` holds `SCREEN_MODES`, `ORIENTATIONS`,
`RENDER_MODES` and `SCREENS` as module-scope constants with literal `label`
strings. A module-scope constant cannot read a hook, so `label` becomes a
message *key* and `t()` resolves it at render. Any other module-scope literal
moves the same way. The arrays keep their shape and order — they encode the
mockup's ordering, which is not a translation concern.

### Known gaps in v1

Two areas stay visible English in an otherwise Polish app. Recorded here so a
later reader does not mistake this feature for finished — and scoped honestly,
because the first of them reaches further than the one file it is named after.

**The live region, and everything else that announces an edit.**
`state/commands.ts` builds its messages by string concatenation — `Flipped
${plural(cells.length, 'cell')}`, `hole C unreachable on 3` — and `LiveRegion`
renders them into a `<p className="live">` that has no CSS rule anywhere, so it
is ordinary visible text under the board, not a screen-reader-only region. Out
of scope for v1 by decision.

`commands.ts` is not the whole of it, though, and the gap is wider than a first
reading of this paragraph suggests. Two other sources feed the same announcement
path and are equally English:

- `board/useKeyboardBinding.ts` composes its own strings around an undo label —
  `'Undo: …'`, `'Redo: …'`, `'Nothing to undo'` — none of which come from
  `commands.ts`.
- Every `apply(…, label)` call site passes an English undo label, and those
  labels are what the two above interpolate. They are written in components that
  are otherwise fully translated (`Add S-threaded card` in `CardStepper.tsx`,
  and so on), which is exactly why they are easy to miss: the component reads as
  done.

So closing this gap is not one file. It means: keys with count arguments; a
locale-aware plural helper, because `plural()` at `commands.ts:12` appends `s`
and Polish needs three forms (1 komórka, 2–4 komórki, 5+ komórek, and 22 komórki
again); a decision about what an undo label *is* — a translated string, or a
fact resolved at render like `ReportMessage`, which is the pattern the rest of
this feature settled on and the only one that survives a language switch with
history on the stack; and re-pinning `state/commands.test.ts` plus the keyboard
binding's tests. `Intl.PluralRules('pl')` gives `one/few/many/other` and is in
every target browser, so the helper itself is the short part.

**Share-link error details.** `boot.ts:34` surfaces `PatternError.problems`,
English sentences built inside `@weavesmith/core`. Core is zero-dependency and
language-free on purpose; translating those means core emitting stable codes
that the app maps to copy. That is a change to the durable asset for the sake
of the app, and it needs its own design. The wrapper sentence around the list
is translated; the list items are not.

## Testing

TDD per the working agreements: failing test first, confirmed failing for the
expected reason, then the implementation.

The load-bearing test decision is in `test/setup.ts`, which pins the store to
`locale: 'en'` before each test. Roughly 256 assertions across 43 web test
files query English text and labels. Pinning the default keeps every one of
them meaningful and untouched; without it this feature is a 43-file rewrite
that would bury its own diff.

New tests:

- **Catalogue.** Both catalogues have identical key sets (belt and braces
  behind the `typeof en` annotation, which a future `as any` could defeat); no
  value is empty; no value is its own key, which is what a half-finished
  translation looks like.
- **Detection.** `['pl-PL', 'en']` → `pl`; `['de']` → `en`; `[]` → `en`; a
  stored value naming no catalogue → detection decides.
- **Toggle.** Clicking `PL` switches a known label; `documentElement.lang`
  becomes `pl`; the choice reaches `localStorage`; a fresh mount restores it.
- **Polish render.** One smoke test over `App` with `locale: 'pl'`, asserting
  the nav and one control group read Polish — the test that would fail if a
  component hardcoded a string past the catalogue.

## README

The README stays one file. A language line at the top:

```
**English** · [Polski](#polski)
```

A `## Polski` section at the bottom, condensed rather than a full mirror: what
it is, who it is for, how to run it (linking up to Development rather than
duplicating command blocks, so there is one place to fix a command), and where
it came from.

**[WICI's Polish tablet weaving guide](https://wici.org.pl/2020/04/tkactwo-tabliczkowe-przewodnik-cz-3-darmowe-materialy-do-nauki/)**
is pulled out and emphasized in that section as the guide the project grew
from. It is already credited in the English half; in the Polish half it is the
most useful link on the page for the reader who has just arrived.

`krajki` appears where it belongs — it is the actual Polish word and the name of
the working directory — not sprinkled.

## Discoverability

`index.html`'s meta description and the manifest `description` in
`vite.config.ts` become bilingual, so the deployed Pages site is findable on
`krajki` independently of GitHub. `name` and `short_name` stay `WeaveSmith`.

Repository topics are the strongest single lever and cannot be set from git:

```bash
gh repo edit Demonsthere/weavesmith \
  --add-topic krajki \
  --add-topic tablet-weaving \
  --add-topic tabletweaving \
  --add-topic weaving \
  --add-topic pwa
```

Jakub's to run, or to ask for — it changes repository metadata, which is
outward-facing and not part of the code change.
