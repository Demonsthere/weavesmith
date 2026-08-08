# Language Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app an English/Polish toggle covering every static string a user reads, and append a Polish section to the README.

**Architecture:** A hand-rolled typed message catalogue in `apps/web/src/i18n/`. `en.ts` is the source of truth; `pl.ts` is annotated `Messages` (`typeof en`) so a missing key, an extra key, or a mismatched interpolation signature fails `pnpm typecheck`. Locale is UI state on the zustand store beside `orientation`, persisted through `io/preferences.ts`, absent from the pattern and the share link. Components read strings through a `useT()` hook.

**Tech Stack:** TypeScript, React 19, zustand 5, Vite 8, vitest + @testing-library/react. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-08-language-toggle-design.md`

## Global Constraints

- **TDD, always.** Write the failing test, run it, confirm it fails for the expected reason, then implement. Never edit a test to make code pass.
- **No new dependencies.** `apps/web` gains nothing in `package.json`.
- **`packages/core` is not touched by this feature.** Core is language-free; it stays that way.
- **`const pl: Messages` is the only translation safety mechanism.** Never `as any`, never a runtime fallback to English, never a `key not found` placeholder.
- **No `as const` on a catalogue object.** It types values as string *literals*, which would force Polish values to equal the English ones. Verified: this is real.
- **The locale never enters `Pattern`, `toJSON`, or the share link.** Same reason orientation does not — see `io/preferences.ts` header comment.
- **Identity colour never touches a note face** (standing repo rule, unchanged here).
- Every task ends with a passing `pnpm --filter @weavesmith/web test` and a commit.
- Commits: Conventional Commits, `why` in the body when it is not obvious.

### Out of scope — do not translate

- `apps/web/src/state/commands.ts` messages and the `LiveRegion` they feed. Decided; recorded as a known gap in the spec.
- `PatternError.problems` list items surfaced by `FileMenu` and `boot.ts`. They come from core. **The app's own fallback strings next to them (`'this file could not be read'`, `'this link could not be read'`) are ours and ARE translated.**
- The `WeaveSmith` wordmark, and manifest `name`/`short_name`.

### Polish terminology (authoritative for this plan)

Domain terms, anchored to the vocabulary of [WICI's Polish guide](https://wici.org.pl/2020/04/tkactwo-tabliczkowe-przewodnik-cz-3-darmowe-materialy-do-nauki/) (`tkactwo tabliczkowe`, `tabliczki`). Use these exact words; do not re-invent per file.

| English | Polish |
|---|---|
| tablet weaving | tkactwo tabliczkowe |
| card / tablet | tabliczka |
| band | krajka |
| pick | przeplot |
| warp | osnowa |
| warp end | nitka osnowy |
| hole | otwór |
| threading | przewleczenie |
| S-threaded | przewleczona S |
| turn forward / backward | obrót do przodu / do tyłu |
| accumulated twist | skumulowany skręt |
| cell | komórka |
| target (painted) | wzorzec |
| brush | pędzel |
| board | plansza |
| turning chart | tabela obrotów |
| walnut / madder / woad / weld / undyed | orzech / marzanna / urzet / rezeda / niebarwiona |

**Jakub should sanity-check this table with a Polish weaver before Task 12 ships.** It is the one part of this plan that no test can validate — the code will be correct and the words may still be wrong. Flag it at review, do not silently assume it.

### Polish plural categories (verified empirically, do not re-derive)

`new Intl.PluralRules('pl').select(n)`:

| n | category |
|---|---|
| 0 | many |
| 1 | one |
| 2, 3, 4 | few |
| 5, 11, 21, 25, 101 | many |
| 22, 102 | few |

So Polish needs three noun forms: `one` (1 komórka), `few` (2 komórki), `many` (5 komórek, and 0 komórek).

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `apps/web/src/i18n/messages/en.ts` | English catalogue — the source of truth, and `Messages`/`MessageKey` types |
| `apps/web/src/i18n/messages/pl.ts` | Polish catalogue, typed `Messages` |
| `apps/web/src/i18n/catalogues.ts` | `Locale`, `LOCALES`, `CATALOGUES` — the only file that knows how many languages exist |
| `apps/web/src/i18n/detect.ts` | `detectLocale(preferred)` — pure, no `navigator` access |
| `apps/web/src/i18n/useT.ts` | `useT()` — subscribes to locale, returns typed `t` |
| `apps/web/src/i18n/LanguageToggle.tsx` | The EN/PL control, and the `documentElement.lang` sync |
| `apps/web/test/i18n/catalogue.test.ts` | Key-set parity, no empty values, no key-as-value |
| `apps/web/test/i18n/detect.test.ts` | Detection and fallback |
| `apps/web/test/i18n/toggle.test.tsx` | Switching, `lang` attribute, persistence, restore |
| `apps/web/test/i18n/polish.test.tsx` | One render of `App` in Polish |

**Modified:** `state/store.ts` (locale state), `io/preferences.ts` (persistence), `test/setup.ts` (pin `en`), `App.tsx`, `board/{Board,CardStepper,CardChip,Cell}.tsx`, `editor/{CardEditor,palette}.ts(x)`, `paint/BrushStrip.tsx`, `weave/WeaveBar.tsx`, `io/{FileMenu,PatternName}.tsx`, `io/boot.ts`, `chart/{Chart,Summary}.tsx`, `index.html`, `vite.config.ts`, `README.md`.

---

### Task 1: The catalogue and its type contract

**Files:**
- Create: `apps/web/src/i18n/messages/en.ts`, `apps/web/src/i18n/messages/pl.ts`, `apps/web/src/i18n/catalogues.ts`
- Test: `apps/web/test/i18n/catalogue.test.ts`

**Interfaces:**
- Produces: `Messages` (= `typeof en`), `MessageKey` (= `keyof Messages`), `Locale` (= `'en' | 'pl'`), `LOCALES: readonly Locale[]`, `CATALOGUES: Record<Locale, Messages>`.

This task ships only the keys for the app header (Task 6 and later add their own). It exists to lock the type contract before any component depends on it.

- [ ] **Step 1: Write the failing test**

`apps/web/test/i18n/catalogue.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @weavesmith/web test i18n/catalogue`
Expected: FAIL — cannot resolve `../../src/i18n/catalogues.js`.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/i18n/messages/en.ts`:

```ts
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
export const en = {
  'app.nav.screens': 'Screens',
  'app.nav.board': 'Board',
  'app.nav.chart': 'Chart',
  'lang.group': 'Language',
  'lang.en': 'English',
  'lang.pl': 'Polski',
};

export type Messages = typeof en;
export type MessageKey = keyof Messages;
```

`apps/web/src/i18n/messages/pl.ts`:

```ts
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
```

`apps/web/src/i18n/catalogues.ts`:

```ts
import { en } from './messages/en.js';
import type { Messages } from './messages/en.js';
import { pl } from './messages/pl.js';

export type Locale = 'en' | 'pl';

/** The only list of languages in the app. A third one is a file plus a line
 *  here — everything else is driven off `Locale` and typechecks itself. */
export const LOCALES: readonly Locale[] = ['en', 'pl'];

export const CATALOGUES: Record<Locale, Messages> = { en, pl };

export const DEFAULT_LOCALE: Locale = 'en';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @weavesmith/web test i18n/catalogue` → PASS (3 tests)
Run: `pnpm --filter @weavesmith/web typecheck` → clean

- [ ] **Step 5: Prove the type contract actually bites**

Temporarily delete the `'lang.pl'` line from `pl.ts`, run `pnpm --filter @weavesmith/web typecheck`, and confirm `TS2741`. Then add a key `'nope': 'x'` to `pl.ts` only and confirm `TS2353`. Restore the file. This is a manual check, not a committed test — the point is to see the mechanism fail before trusting it.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/i18n apps/web/test/i18n
git commit -m "feat(web): add a typed message catalogue for en and pl"
```

---

### Task 2: Locale detection

**Files:**
- Create: `apps/web/src/i18n/detect.ts`
- Test: `apps/web/test/i18n/detect.test.ts`

**Interfaces:**
- Consumes: `Locale`, `LOCALES`, `DEFAULT_LOCALE` from Task 1.
- Produces: `detectLocale(preferred: readonly string[]): Locale`.

- [ ] **Step 1: Write the failing test**

`apps/web/test/i18n/detect.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectLocale } from '../../src/i18n/detect.js';

describe('detectLocale', () => {
  it('matches on the primary subtag, so pl-PL is Polish', () => {
    expect(detectLocale(['pl-PL', 'en-GB'])).toBe('pl');
  });

  it('takes the first supported entry, not the first entry', () => {
    expect(detectLocale(['de-DE', 'pl'])).toBe('pl');
  });

  it('falls back to English when nothing is supported', () => {
    expect(detectLocale(['de', 'fr'])).toBe('en');
  });

  it('falls back to English on an empty list', () => {
    expect(detectLocale([])).toBe('en');
  });

  it('is case-insensitive', () => {
    expect(detectLocale(['PL'])).toBe('pl');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @weavesmith/web test i18n/detect`
Expected: FAIL — cannot resolve `detect.js`.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/i18n/detect.ts`:

```ts
import { DEFAULT_LOCALE, LOCALES } from './catalogues.js';
import type { Locale } from './catalogues.js';

/**
 * Picks a language from a browser preference list.
 *
 * A pure function over an array rather than a reader of `navigator`, so it
 * is testable without stubbing a global — and so the caller decides whether
 * the list comes from `navigator.languages`, a single `navigator.language`,
 * or a test.
 *
 * Matches on the primary subtag: a weaver whose browser says `pl-PL` wants
 * Polish, and there is no regional Polish catalogue to distinguish.
 */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split('-')[0];
    const match = LOCALES.find((locale) => locale === primary);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @weavesmith/web test i18n/detect` → PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/i18n/detect.ts apps/web/test/i18n/detect.test.ts
git commit -m "feat(web): detect a locale from browser language preferences"
```

---

### Task 3: Locale on the store, persisted

**Files:**
- Modify: `apps/web/src/state/store.ts`, `apps/web/src/io/preferences.ts`, `apps/web/test/setup.ts`
- Test: `apps/web/test/io/preferences.test.ts` (extend), `apps/web/test/state/store.test.ts` (extend)

**Interfaces:**
- Consumes: `Locale`, `LOCALES`, `DEFAULT_LOCALE`, `detectLocale`.
- Produces: store fields `locale: Locale` and `setLocale(locale: Locale): void`; `readLocale(): Locale | null`, `writeLocale(locale: Locale): void`, `clearLocale(): void`.

The `setup.ts` change in Step 5 is load-bearing: ~256 assertions across 43 web test files query English text. Pinning `en` per test keeps all of them meaningful.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/test/io/preferences.test.ts`:

```ts
import { clearLocale, readLocale, writeLocale } from '../../src/io/preferences.js';

describe('locale preference', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a locale', () => {
    writeLocale('pl');
    expect(readLocale()).toBe('pl');
  });

  it('reads null when nothing is stored', () => {
    expect(readLocale()).toBeNull();
  });

  // Validated, not cast: a stored value is untrusted input (an older build,
  // another tab, a hand-edited devtools session). Anything unrecognised must
  // mean "no choice on record" so detection takes over — never a render in a
  // language with no strings.
  it('treats an unrecognised stored value as no choice', () => {
    localStorage.setItem('weavesmith:locale', 'klingon');
    expect(readLocale()).toBeNull();
  });

  it('clears the override', () => {
    writeLocale('pl');
    clearLocale();
    expect(readLocale()).toBeNull();
  });
});
```

Append to `apps/web/test/state/store.test.ts`:

```ts
describe('locale', () => {
  it('defaults to en', () => {
    expect(useStore.getState().locale).toBe('en');
  });

  it('setLocale changes it', () => {
    useStore.getState().setLocale('pl');
    expect(useStore.getState().locale).toBe('pl');
    useStore.getState().setLocale('en');
  });

  // Display state, not document state. A band shared with a friend must not
  // arrive in the language of the machine that made it.
  it('is not part of the pattern', () => {
    useStore.getState().setLocale('pl');
    expect(JSON.stringify(useStore.getState().pattern)).not.toContain('pl');
    useStore.getState().setLocale('en');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @weavesmith/web test preferences store`
Expected: FAIL — `readLocale` is not exported; `locale` is undefined on the store.

- [ ] **Step 3: Implement the persistence**

In `apps/web/src/io/preferences.ts`, alongside the orientation functions (same best-effort contract — reads return `null`, writes do nothing rather than throwing, because Safari private mode and a full quota both throw):

```ts
import { LOCALES } from '../i18n/catalogues.js';
import type { Locale } from '../i18n/catalogues.js';

const LOCALE_KEY = 'weavesmith:locale';

export function readLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(LOCALE_KEY);
    return LOCALES.find((value) => value === raw) ?? null;
  } catch {
    return null;
  }
}

export function writeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // Best-effort: the choice still applies for this session.
  }
}

export function clearLocale(): void {
  try {
    localStorage.removeItem(LOCALE_KEY);
  } catch {
    // Same best-effort contract as the writes above.
  }
}
```

- [ ] **Step 4: Implement the store field**

In `apps/web/src/state/store.ts`, add to `StoreState` beside `orientation`:

```ts
  // Which language the UI reads in. Display state like `orientation` and
  // `render`: how you are looking at the band, not what the band is. The
  // initial value is the plain default — `App` resolves the stored override
  // and browser detection in an effect, for the same reason the pattern is
  // booted there: the store is a module singleton shared by every test, and
  // reading `localStorage` at module-eval time would make importing it a
  // side effect.
  locale: Locale;
```

and to the creator, beside `setOrientation`:

```ts
  locale: DEFAULT_LOCALE,
  setLocale: (locale: Locale) => set({ locale }),
```

Import `Locale` and `DEFAULT_LOCALE` from `../i18n/catalogues.js`. Do **not** add `locale` to `reset`'s document-state handling — it is not document state, and `reset` must not change the language.

- [ ] **Step 5: Pin the locale in the test setup**

In `apps/web/test/setup.ts`, next to the existing `afterEach(cleanup)`:

```ts
import { beforeEach } from 'vitest';
import { useStore } from '../src/state/store.js';

// Every existing web test queries English labels — around 256 assertions
// across 43 files. Pinning the locale per test keeps all of them meaningful
// and independent of a previous test's toggle, and keeps this feature from
// becoming a 43-file rewrite that would bury its own diff. Tests that want
// Polish set it themselves.
beforeEach(() => {
  useStore.getState().setLocale('en');
});
```

- [ ] **Step 6: Run the whole web suite**

Run: `pnpm --filter @weavesmith/web test`
Expected: PASS, including the new locale tests. Nothing else should have changed behaviour.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/state/store.ts apps/web/src/io/preferences.ts apps/web/test
git commit -m "feat(web): keep the chosen locale on the store and in preferences"
```

---

### Task 4: `useT`, the toggle, and `documentElement.lang`

**Files:**
- Create: `apps/web/src/i18n/useT.ts`, `apps/web/src/i18n/LanguageToggle.tsx`
- Modify: `apps/web/src/App.tsx` (mount the toggle, resolve the boot locale)
- Test: `apps/web/test/i18n/toggle.test.tsx`

**Interfaces:**
- Consumes: `CATALOGUES`, `Messages`, `MessageKey`, `detectLocale`, `readLocale`/`writeLocale`, store `locale`/`setLocale`.
- Produces: `useT(): <K extends MessageKey>(key: K, ...args: Args<K>) => string`; `<LanguageToggle />`.

The `t` typing below is verified against this repo's TypeScript: it rejects a missing argument object, an argument object on a plain-string key, and an unknown key, while returning `string` for valid calls.

- [ ] **Step 1: Write the failing test**

`apps/web/test/i18n/toggle.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App.js';
import { useStore } from '../../src/state/store.js';

describe('language toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.getState().setLocale('en');
    document.documentElement.lang = 'en';
  });

  it('switches the UI to Polish', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(screen.getByRole('link', { name: 'Plansza' })).toBeInTheDocument();
  });

  // Drives screen-reader voice selection and hyphenation. index.html
  // hardcodes lang="en", which would be a lie in Polish mode.
  it('updates the document language', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(document.documentElement.lang).toBe('pl');
  });

  it('marks the active language pressed', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(screen.getByRole('button', { name: 'Polski' })).toHaveAttribute(
      'aria-pressed', 'true',
    );
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed', 'false',
    );
  });

  // "PL" spoken aloud is not a language name, and a screen reader should
  // pronounce "Polski" with Polish phonemes rather than read it as English.
  it('names each language in its own language, and tags it', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Polski' })).toHaveAttribute('lang', 'pl');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('lang', 'en');
  });

  it('persists the choice', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(localStorage.getItem('weavesmith:locale')).toBe('pl');
  });

  it('restores a stored choice on a fresh mount', () => {
    localStorage.setItem('weavesmith:locale', 'pl');
    render(<App />);
    expect(screen.getByRole('link', { name: 'Plansza' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @weavesmith/web test i18n/toggle`
Expected: FAIL — no button named `Polski`.

- [ ] **Step 3: Implement `useT`**

`apps/web/src/i18n/useT.ts`:

```ts
import { CATALOGUES } from './catalogues.js';
import type { Messages, MessageKey } from './messages/en.js';
import { useStore } from '../state/store.js';

/**
 * The arguments a key takes: exactly one object for an interpolating key,
 * and none at all for a plain string. This is what makes `t('app.nav.board',
 * {x: 1})` and a forgotten argument object both compile errors rather than
 * runtime surprises.
 */
type Args<K extends MessageKey> = Messages[K] extends (a: infer A) => string ? [A] : [];

/**
 * Reads strings in the current locale. Subscribing to `locale` through the
 * store is also what re-renders a component when the language changes —
 * there is no separate context or event to wire up.
 */
export function useT() {
  const locale = useStore((state) => state.locale);
  const catalogue = CATALOGUES[locale];

  return <K extends MessageKey>(key: K, ...args: Args<K>): string => {
    const value = catalogue[key];
    return typeof value === 'function' ? value(args[0] as never) : value;
  };
}
```

- [ ] **Step 4: Implement the toggle**

`apps/web/src/i18n/LanguageToggle.tsx`:

```tsx
import { useEffect } from 'react';
import { LOCALES } from './catalogues.js';
import type { Locale } from './catalogues.js';
import { useT } from './useT.js';
import { writeLocale } from '../io/preferences.js';
import { useStore } from '../state/store.js';

/** Each language named in its own language. 'PL' spoken aloud is not a
 *  language name, and a reader looking for their own language scans for the
 *  word they call it by. */
const NAME_KEY = { en: 'lang.en', pl: 'lang.pl' } as const;

/** Short codes in the visible chip: this sits in header chrome that is
 *  already crowded on a phone. The accessible name carries the full word. */
const CODE = { en: 'EN', pl: 'PL' } as const;

export function LanguageToggle() {
  const t = useT();
  const locale = useStore((state) => state.locale);
  const setLocale = useStore((state) => state.setLocale);

  // Screen-reader voice selection and hyphenation both key off this.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const choose = (next: Locale) => {
    setLocale(next);
    writeLocale(next);
  };

  return (
    <div className="segmented" role="group" aria-label={t('lang.group')}>
      {LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          lang={value}
          aria-label={t(NAME_KEY[value])}
          aria-pressed={locale === value}
          onClick={() => choose(value)}
        >
          {CODE[value]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Mount it and resolve the boot locale**

In `apps/web/src/App.tsx`: import `LanguageToggle` and `useT`, render `<LanguageToggle />` inside `<header>` immediately after the `screen-nav` `<nav>`, and replace the two hardcoded nav strings with `t('app.nav.screens')` / the per-screen keys (`SCREENS` entries carry a `key: MessageKey` instead of a `label: string`).

Resolve the locale in the existing boot effect, beside the pattern boot, so `localStorage` and `navigator` are still read in an effect rather than at module scope:

```ts
    // Stored override first, then the browser's own preference, then
    // English. A stored value naming no catalogue reads as null (validated
    // in preferences.ts), so detection decides rather than the app
    // rendering in a language it has no strings for.
    const stored = readLocale();
    useStore.getState().setLocale(stored ?? detectLocale(navigator.languages));
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @weavesmith/web test i18n/toggle` → PASS (6 tests)
Run: `pnpm --filter @weavesmith/web test` → whole suite PASS
Run: `pnpm --filter @weavesmith/web typecheck` → clean

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/i18n apps/web/src/App.tsx apps/web/test/i18n
git commit -m "feat(web): add an EN/PL toggle to the header

Each button is named in its own language and carries a matching `lang`,
so a screen reader pronounces \"Polski\" with Polish phonemes instead of
reading it as English. The effect syncs documentElement.lang, which
index.html hardcodes to en and which drives voice selection and
hyphenation."
```

---

### Task 5: Counted nouns

**Files:**
- Modify: `apps/web/src/i18n/messages/en.ts`, `apps/web/src/i18n/messages/pl.ts`
- Test: `apps/web/test/i18n/catalogue.test.ts` (extend)

**Interfaces:**
- Produces: a `plural` helper local to each catalogue file, and the counted-noun keys `summary.cards`, `summary.warpEnds`, `summary.ends`, `summary.picks`, `summary.turns`, `summary.cellsUnreachable`, `summary.cellsUnmet` — all `(a: { count: number }) => string`.

Needed by Task 10, not by the live region (still out of scope). `chart/Summary.tsx:7` has its own English-only `plural()`, and the printed chart says "3 cards", "48 warp ends", "24 picks" — Polish needs three forms for each.

Each catalogue expresses its own plural rule in its own file. There is no shared generic pluraliser: English needs two forms and Polish three, the rule *is* the language, and a shared abstraction would only be a lookup table with a locale argument threaded through it.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/test/i18n/catalogue.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @weavesmith/web test i18n/catalogue`
Expected: FAIL — `pl['summary.cellsUnmet']` is not a function.

- [ ] **Step 3: Implement the English forms**

In `apps/web/src/i18n/messages/en.ts`, above the catalogue:

```ts
/** English has two forms, and `n === 1` is the whole rule. */
const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;
```

and in the catalogue:

```ts
  'summary.cards': (a: { count: number }) => plural(a.count, 'card', 'cards'),
  'summary.warpEnds': (a: { count: number }) => plural(a.count, 'warp end', 'warp ends'),
  'summary.ends': (a: { count: number }) => plural(a.count, 'end', 'ends'),
  'summary.picks': (a: { count: number }) => plural(a.count, 'pick', 'picks'),
  'summary.turns': (a: { count: number }) => plural(a.count, 'turn', 'turns'),
  'summary.cellsUnreachable': (a: { count: number }) =>
    `${plural(a.count, 'cell', 'cells')} unreachable`,
  'summary.cellsUnmet': (a: { count: number }) => `${plural(a.count, 'cell', 'cells')} unmet`,
```

- [ ] **Step 4: Implement the Polish forms**

In `apps/web/src/i18n/messages/pl.ts`, above the catalogue:

```ts
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
```

and in the catalogue:

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @weavesmith/web test i18n/catalogue` → PASS
Run: `pnpm --filter @weavesmith/web typecheck` → clean

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/i18n/messages apps/web/test/i18n/catalogue.test.ts
git commit -m "feat(web): give counted nouns Polish plural forms

Polish takes three forms and the boundaries are not intuitive: 2-4 is
`few`, 5-21 is `many`, and then 22 is `few` again. Intl.PluralRules
carries that; a hand-rolled n < 5 would be wrong from 22 on. The
adjective agrees with the noun, so \"unreachable\" cannot be appended
outside the plural call the way English appends it."
```

---

### Task 6: The app chrome

**Files:**
- Modify: `apps/web/src/App.tsx`, `apps/web/src/i18n/messages/{en,pl}.ts`
- Test: `apps/web/test/app/screenMode.test.tsx`, `renderMode.test.tsx`, `orientation.test.tsx` must keep passing untouched.

**Interfaces:**
- Consumes: `useT`, `MessageKey`.
- Produces: nothing new; establishes the module-scope-constant pattern the next three tasks follow.

`App.tsx:18-45` holds `SCREEN_MODES`, `ORIENTATIONS`, `RENDER_MODES` and `SCREENS` at module scope with literal `label` strings. A module-scope constant cannot call a hook, so each `label`/`name` becomes a `MessageKey` and `t()` resolves it at render. Array order is unchanged — it encodes the mockup's ordering, which is not a translation concern.

- [ ] **Step 1: Add the keys**

`en.ts`:

```ts
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
```

`pl.ts` — the glyphs stay, the words change:

```ts
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
```

- [ ] **Step 2: Write the failing test**

Add to `apps/web/test/i18n/toggle.test.tsx`:

```tsx
  it('translates the control groups', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(screen.getByRole('group', { name: 'Orientacja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Krajka pionowa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tkanie' })).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @weavesmith/web test i18n/toggle`
Expected: FAIL — no group named `Orientacja`.

- [ ] **Step 4: Convert the constants to keys**

Change each module-scope array so its text fields are `MessageKey`s, e.g.:

```ts
const SCREEN_MODES: { value: ScreenMode; key: MessageKey }[] = [
  { value: 'design', key: 'mode.design' },
  { value: 'paint', key: 'mode.paint' },
  { value: 'weave', key: 'mode.weave' },
];

const ORIENTATIONS: { value: Orientation; key: MessageKey; nameKey: MessageKey }[] = [
  { value: 'vertical', key: 'orientation.vertical', nameKey: 'orientation.verticalName' },
  { value: 'horizontal', key: 'orientation.horizontal', nameKey: 'orientation.horizontalName' },
];
```

Call `const t = useT()` in `App` and `BoardScreen`, and resolve at the render site: `aria-label={t(nameKey)}`, `{t(key)}`, `aria-label={t('orientation.group')}`. Also translate the boot alert sentence (`t('boot.shareFailed')`) and, in `io/boot.ts`, leave the *core* problems verbatim while routing the app's own `'this link could not be read'` fallback through the catalogue. `boot.ts` is not a component, so it takes the resolved string from its caller in `App` rather than calling a hook:

```ts
// boot.ts keeps its signature; App passes the fallback in.
export function bootPattern(hash: string, unreadable: string): Booted
```

Update `apps/web/test/io/boot.test.ts` call sites to pass `'this link could not be read'`, preserving their existing assertions.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @weavesmith/web test` → whole suite PASS (the app tests still query English because `setup.ts` pins `en`)
Run: `pnpm --filter @weavesmith/web typecheck` → clean

- [ ] **Step 6: Commit**

```bash
git add apps/web/src apps/web/test
git commit -m "feat(web): translate the app chrome and control groups"
```

---

### Task 7: The board

**Files:**
- Modify: `apps/web/src/board/{Board,CardStepper,CardChip,Cell}.tsx`, `apps/web/src/i18n/messages/{en,pl}.ts`
- Test: `apps/web/test/i18n/toggle.test.tsx` (extend)

**Interfaces:**
- Consumes: `useT`.
- Produces: nothing new.

`Cell` and `CardChip` are rendered once per cell and per card, so both take `t` as a prop from `Board` rather than calling `useT()` themselves — one store subscription for the board instead of hundreds. `Cell`'s props already carry everything else it renders; this matches that shape.

- [ ] **Step 1: Add the keys**

`en.ts`:

```ts
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
```

`pl.ts`:

```ts
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
```

Note the S/Z letters are not translated: they are the threading's name in every language.

- [ ] **Step 2: Write the failing test**

Add to `apps/web/test/i18n/toggle.test.tsx`:

```tsx
  it('translates the board and its cells', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(screen.getByRole('grid', { name: 'Plansza tkania' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Liczba tabliczek' })).toBeInTheDocument();
    // The default band ("Chevron", state/defaultPattern.ts) is 8 cards x 24
    // picks with every turn forward, so this cell is deterministic.
    expect(
      screen.getByRole('gridcell', { name: 'Tabliczka 1, przeplot 1, obrót do przodu' }),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @weavesmith/web test i18n/toggle`
Expected: FAIL — no grid named `Plansza tkania`.

- [ ] **Step 4: Implement**

- `Board.tsx`: `const t = useT()`; `aria-label={t('board.label')}`; pass `t` down to `CardChip` and `Cell`.
- `CardStepper.tsx`: `const t = useT()`; replace the group label, both button `aria-label`s, and the `<small>cards</small>` text. Leave the `apply(..., 'Add S-threaded card')` history labels alone — they are internal, never rendered.
- `CardChip.tsx`: add `t: ReturnType<typeof useT>` to `Props`; `aria-label={t('chip.label', { index: index + 1, threading: card.threading })}`.
- `Cell.tsx`: add `t` to `Props`; build the label from `t('cell.label', ...)` plus the `wanted` suffix from `t('cell.wantedSolve' | 'cell.wantedUnreachable', { hex })`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @weavesmith/web test` → whole suite PASS
Run: `pnpm --filter @weavesmith/web typecheck` → clean

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/board apps/web/src/i18n apps/web/test
git commit -m "feat(web): translate the board, stepper, chips and cells

Cell and CardChip take `t` as a prop rather than calling useT: they render
once per cell and per card, and one board-level store subscription beats
hundreds of identical ones."
```

---

### Task 8: Editor, brush and weave bar

**Files:**
- Modify: `apps/web/src/editor/{CardEditor.tsx,palette.ts}`, `apps/web/src/paint/BrushStrip.tsx`, `apps/web/src/weave/WeaveBar.tsx`, `apps/web/src/i18n/messages/{en,pl}.ts`
- Test: `apps/web/test/i18n/toggle.test.tsx` (extend)

**Interfaces:**
- Consumes: `useT`, `MessageKey`.
- Produces: `WOOL_NAME_KEYS: Record<string, MessageKey>` in `editor/palette.ts`, replacing `WOOL_NAMES`.

`WOOL_NAMES` maps hex → English name and is read by three files (`CardEditor.describeColor`, `BrushStrip.colorName`, `Chart`/`Summary.colorName`). It becomes hex → `MessageKey`, and each caller resolves through `t`. The dye names are copy, not data: a Polish weaver buys *marzanna*, not *madder*.

- [ ] **Step 1: Add the keys**

`en.ts`:

```ts
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
```

`pl.ts`:

```ts
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
```

Hole letters A–D come from core's `HOLE_LABELS` and are not translated — they are the holes' names, like S and Z.

- [ ] **Step 2: Write the failing test**

Add to `apps/web/test/i18n/toggle.test.tsx`:

```tsx
  it('translates the card editor, including the dye names', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    await userEvent.click(screen.getByRole('button', { name: /^Tabliczka 1, przewleczona/ }));
    expect(screen.getByRole('button', { name: 'Gotowe' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ustaw wybrany otwór na marzanna #B4402C' }),
    ).toBeInTheDocument();
  });

  it('translates the weave bar', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tkanie' }));
    expect(screen.getByRole('button', { name: 'Następny przeplot' })).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @weavesmith/web test i18n/toggle`
Expected: FAIL — no button named `Gotowe`.

- [ ] **Step 4: Implement**

`editor/palette.ts` — replace `WOOL_NAMES` (keep `WOOL_PRESETS` exactly as it is):

```ts
import type { MessageKey } from '../i18n/messages/en.js';

/** Hex → the name's message key. The dye names are copy, not data: a Polish
 *  weaver buys marzanna, not madder. */
export const WOOL_NAME_KEYS: Record<string, MessageKey> = {
  '#4B3826': 'wool.walnut',
  '#B4402C': 'wool.madder',
  '#2F5F8F': 'wool.woad',
  '#D8A62B': 'wool.weld',
  '#EADCC0': 'wool.undyed',
};
```

Then in each consumer, the local helper resolves through `t` (identical shape in all three; `describeColor` keeps appending the hex so a screen-reader user still hears "marzanna #B4402C" rather than a bare code):

```ts
const t = useT();
const colorName = (hex: string): string => {
  const key = WOOL_NAME_KEYS[hex];
  return key ? t(key) : hex;
};
```

Replace every remaining literal in `CardEditor`, `BrushStrip` and `WeaveBar` with its key. Leave `BrushStrip`'s `report` state alone — it holds a `commands.ts` message, which is out of scope.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @weavesmith/web test` → whole suite PASS
Run: `pnpm --filter @weavesmith/web typecheck` → clean

- [ ] **Step 6: Commit**

```bash
git add apps/web/src apps/web/test
git commit -m "feat(web): translate the card editor, brush strip and weave bar

WOOL_NAMES becomes hex -> message key: the dye names are copy, not data.
A Polish weaver buys marzanna, not madder."
```

---

### Task 9: File menu and pattern name

**Files:**
- Modify: `apps/web/src/io/{FileMenu,PatternName}.tsx`, `apps/web/src/i18n/messages/{en,pl}.ts`
- Test: `apps/web/test/i18n/toggle.test.tsx` (extend)

**Interfaces:**
- Consumes: `useT`.
- Produces: nothing new.

The `report.problems` **list items** stay verbatim — `FileMenu`'s own docstring says why, and they come from core. `problemsOf`'s app-authored fallback `'this file could not be read'` is ours and is translated. So is every `report.message` sentence, which the app writes itself.

- [ ] **Step 1: Add the keys**

`en.ts`:

```ts
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
```

`pl.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing test**

Add to `apps/web/test/i18n/toggle.test.tsx`:

```tsx
  it('translates the file menu', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(screen.getByRole('button', { name: 'Pobierz' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nazwa wzoru')).toBeInTheDocument();
  });

  it('translates a report sentence but not core problems', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    await userEvent.click(screen.getByRole('button', { name: 'Przywróć domyślną' }));
    await userEvent.click(screen.getByRole('button', { name: 'Odrzuć i zacznij od nowa' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Powrót do domyślnej krajki.');
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @weavesmith/web test i18n/toggle`
Expected: FAIL — no button named `Pobierz`.

- [ ] **Step 4: Implement**

`const t = useT()` in both components; replace every literal with its key. `problemsOf` moves inside the component (or takes `t`'s resolved fallback as a second argument) so it can reach the catalogue. `report.problems` items are still rendered verbatim.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @weavesmith/web test` → whole suite PASS
Run: `pnpm --filter @weavesmith/web typecheck` → clean

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/io apps/web/src/i18n apps/web/test
git commit -m "feat(web): translate the file menu and the pattern name field

The app's own sentences are translated; PatternError.problems items stay
verbatim because core writes them and rewording them here would mean two
places to keep honest."
```

---

### Task 10: The printable chart

**Files:**
- Modify: `apps/web/src/chart/{Chart,Summary}.tsx`, `apps/web/src/i18n/messages/{en,pl}.ts`
- Test: `apps/web/test/i18n/toggle.test.tsx` (extend)

**Interfaces:**
- Consumes: `useT`, the counted-noun keys from Task 5, `WOOL_NAME_KEYS` from Task 8.
- Produces: nothing new.

`Summary.tsx:7` has its own English-only `plural()`. Delete it — the catalogue owns plurals now. `Chart`'s `↑`/`↓` glyphs stay; their meaning is carried by the `title`, in words, which is what a screen reader and a photocopy both need.

- [ ] **Step 1: Add the keys**

`en.ts`:

```ts
  'chart.print': 'Print or save as PDF',
  'chart.qrAlt': (a: { url: string }) => `QR code linking to ${a.url}`,
  'chart.threading': 'Threading',
  'chart.hole': 'Hole',
  'chart.turningChart': 'Turning chart',
  'chart.pick': 'Pick',
  'chart.forward': 'Forward',
  'chart.backward': 'Backward',
  'summary.heading': 'Summary',
  'summary.counts': (a: { cards: string; ends: string }) =>
    `${a.cards}, ${a.ends} (four per card).`,
  'summary.warpThreads': 'Warp threads',
  'summary.twistHeading': 'Accumulated twist',
  'summary.twistUniform': (a: { turns: string; picks: string }) =>
    `Every card ends at ${a.turns} turns after ${a.picks}.`,
  'summary.twistVaries': (a: { picks: string }) =>
    `Cards end at different twists after ${a.picks}:`,
  'summary.twistCard': (a: { index: number; turns: string }) => `Card ${a.index}: ${a.turns}`,
  'summary.againstTarget': 'Against the target',
  'summary.targetLine': (a: { unreachable: string; unmet: string }) =>
    `${a.unreachable}, ${a.unmet}.`,
```

`pl.ts`:

```ts
  'chart.print': 'Wydrukuj lub zapisz jako PDF',
  'chart.qrAlt': (a: { url: string }) => `Kod QR prowadzący do ${a.url}`,
  'chart.threading': 'Przewleczenie',
  'chart.hole': 'Otwór',
  'chart.turningChart': 'Tabela obrotów',
  'chart.pick': 'Przeplot',
  'chart.forward': 'Do przodu',
  'chart.backward': 'Do tyłu',
  'summary.heading': 'Podsumowanie',
  'summary.counts': (a: { cards: string; ends: string }) =>
    `${a.cards}, ${a.ends} (cztery na tabliczkę).`,
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
```

The counted phrases arrive pre-rendered as strings (`a.cards`, `a.picks`) because the noun's form depends on the number, so the plural call has to happen before the sentence is assembled.

- [ ] **Step 2: Write the failing test**

Add to `apps/web/test/i18n/toggle.test.tsx`:

```tsx
  it('translates the chart sheet, with Polish plural forms', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    await userEvent.click(screen.getByRole('link', { name: 'Schemat' }));
    expect(screen.getByRole('heading', { name: 'Podsumowanie' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Tabela obrotów' })).toBeInTheDocument();
    // The default band is 8 cards, 32 warp ends, 24 picks. Each lands in a
    // different Polish plural category, which is exactly why this assertion
    // is worth making: 8 -> many, 32 -> few, 24 -> few.
    const summary = screen.getByTestId('chart-summary');
    expect(summary).toHaveTextContent('8 tabliczek');
    expect(summary).toHaveTextContent('32 nitki osnowy');
    expect(summary).toHaveTextContent('24 przeploty');
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @weavesmith/web test i18n/toggle`
Expected: FAIL — no heading named `Podsumowanie`.

- [ ] **Step 4: Implement**

- `Chart.tsx`: `const t = useT()`; `DIRECTION` becomes a key map resolved per cell (`title={t(turn === 1 ? 'chart.forward' : 'chart.backward')}`); both `<caption>`s, both header cells, the print button, the QR `alt`, and `colorName` go through `t`.
- `Summary.tsx`: delete the local `plural`; build each counted phrase with the Task 5 keys and pass the resulting strings into the sentence keys. `signed()` stays as it is — `+3` needs no translation.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @weavesmith/web test` → whole suite PASS
Run: `pnpm --filter @weavesmith/web typecheck` → clean

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/chart apps/web/src/i18n apps/web/test
git commit -m "feat(web): translate the printable chart and its summary

Summary had its own English-only plural(); the catalogue owns plurals now,
because \"24 przeploty\" and \"25 przeplotow\" take different forms and a
printed sheet is the last place to get that wrong."
```

---

### Task 11: The footer, and a Polish render

**Files:**
- Modify: `apps/web/src/Footer.tsx`, `apps/web/src/i18n/messages/{en,pl}.ts`
- Create: `apps/web/test/i18n/polish.test.tsx`
- Test: `apps/web/test/app/footer.test.tsx` must keep passing untouched

**Interfaces:**
- Consumes: `useT`.
- Produces: nothing new.

The footer's coffee `alt` is currently Polish (`'Postaw kawę dla demonsthere na buycoffee.to'`) in an otherwise English app. This task gives each catalogue its own version rather than leaving one language's text in both.

- [ ] **Step 1: Add the keys**

`en.ts`:

```ts
  'footer.source': 'Source on GitHub',
  'footer.coffeeAlt': 'Buy demonsthere a coffee on buycoffee.to',
```

`pl.ts`:

```ts
  'footer.source': 'Źródło na GitHubie',
  'footer.coffeeAlt': 'Postaw kawę dla demonsthere na buycoffee.to',
```

- [ ] **Step 2: Write the failing test**

`apps/web/test/i18n/polish.test.tsx` — the test that fails if any component hardcodes a string past the catalogue:

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App.js';
import { useStore } from '../../src/state/store.js';

describe('the app in Polish', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.getState().setLocale('pl');
  });

  it('renders its chrome in Polish', () => {
    render(<App />);
    expect(screen.getByRole('navigation', { name: 'Ekrany' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plansza' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tryb ekranu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Źródło na GitHubie' })).toBeInTheDocument();
  });

  // A documented gap, pinned rather than described: commands.ts is out of
  // scope, so the live region still announces English under a Polish board.
  // Closing that later must fail this test loudly — that is the whole point
  // of asserting it. The coupling to commands.ts wording is deliberate: the
  // wording IS the gap.
  it('still announces the live region in English (known gap)', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Space flips the focused cell; toggleTurn's message is English-only.
    await user.click(screen.getByLabelText(/Tabliczka 1, przeplot 1,/));
    await user.keyboard(' ');
    expect(screen.getByRole('status')).toHaveTextContent('Flipped 1 cell');
  });
});
```

`userEvent` and the board's Polish cell label are both needed here, so import `userEvent from '@testing-library/user-event'` in this file. If `getByRole('status')` matches more than one element (`BrushStrip` also renders one, but only in Paint mode — Design is the default), narrow with the board's own container rather than loosening the assertion.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @weavesmith/web test i18n/polish`
Expected: FAIL — no link named `Źródło na GitHubie`.

- [ ] **Step 4: Implement**

`Footer.tsx`: `const t = useT()`; the link text and the `img alt` go through `t`. The `Weave`/`Smith` wordmark does not.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @weavesmith/web test` → whole suite PASS
Run: `pnpm --filter @weavesmith/web typecheck` → clean
Run: `pnpm test` → whole workspace PASS (core untouched, and this proves it)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src apps/web/test
git commit -m "feat(web): translate the footer, and assert a full Polish render

The coffee alt text was Polish in an English app; each catalogue now
carries its own. The Polish render test is the one that fails if a
component hardcodes a string past the catalogue."
```

---

### Task 12: Polish README section and discoverability

**Files:**
- Modify: `README.md`, `apps/web/index.html`, `apps/web/vite.config.ts`

No test cycle — this task is prose and metadata. Its verification is a build and a read.

- [ ] **Step 1: Add the language line at the top of `README.md`**

Directly under the `# WeaveSmith` heading and the coffee badge:

```markdown
**English** · [Polski](#polski)
```

- [ ] **Step 2: Append the Polish section at the bottom of `README.md`**

After the `## Licence` section, keeping one file rather than splitting:

```markdown
## Polski

**WeaveSmith** to przeglądarkowy projektant wzorów do **tkactwa
tabliczkowego** — krajek tkanych na tabliczkach. Działa w przeglądarce,
także bez internetu, więc można go otworzyć przy krośnie.

Powstał jako prezent: moja żona uczy się tkactwa tabliczkowego, a ja gram na
gitarze — dlatego interfejs wygląda jak gryf gitary. Dotychczasowe narzędzie,
[GTT](https://www.guntram.co.za/tabletweaving/gtt.htm), działa tylko na
Windowsie i nie jest rozwijane od około 20 lat.

Projekt wyrósł z polskiego przewodnika, który wart jest przeczytania
niezależnie od tego, czy skorzystasz z tego programu:

> 📖 **[WICI — Tkactwo tabliczkowe: przewodnik, cz. 3 (darmowe materiały do
> nauki)](https://wici.org.pl/2020/04/tkactwo-tabliczkowe-przewodnik-cz-3-darmowe-materialy-do-nauki/)**
> — najlepszy polski punkt wyjścia i indeks darmowych materiałów.

### Co potrafi

- Projektowanie wzoru tabliczka po tabliczce: przewleczenie S/Z, kolory
  czterech otworów, kierunek obrotu w każdym przeplocie.
- **Malowanie wzorca** i automatyczne wyliczenie obrotów, które go dają —
  wraz z uczciwą informacją o komórkach, których nie da się osiągnąć.
- Tryb tkania: licznik przeplotów przy krośnie, który pamięta, gdzie
  skończyłaś.
- Schemat do druku (tabela obrotów, przewleczenie, podsumowanie osnowy),
  zapis do pliku, eksport SVG/PNG i link do udostępnienia.
- Polski i angielski interfejs — przełącznik języka jest w nagłówku.

Zakres wersji 1 to wzory *threaded-in*. Double-face, 3/1 broken twill,
brokat i wzory blokowe to inne struktury splotu i celowo ich tu nie ma.

### Jak uruchomić

Polecenia są takie same jak w angielskiej części — patrz
[Development](#development). W skrócie: `pnpm install`, a potem
`pnpm --filter @weavesmith/web dev`.

### Słownictwo

Katalog projektu nazywa się `krajki` — po polsku tak nazywa się tkane pasy,
i to jest właściwe słowo na to, co ten program pomaga zaprojektować.
Repozytorium nosi nazwę `weavesmith`; to ten sam projekt.
```

Check the `#development` anchor resolves against the actual `## Development` heading before committing.

- [ ] **Step 3: Make the meta description bilingual**

`apps/web/index.html`:

```html
    <meta
      name="description"
      content="A pattern designer for tablet weaving — projektowanie wzorów krajek tkanych na tabliczkach."
    />
```

`apps/web/vite.config.ts`, in `manifest`, the same sentence for `description`. `name` and `short_name` stay `WeaveSmith` — they are the identity, not copy.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @weavesmith/web build` → succeeds
Run: `pnpm --filter @weavesmith/web test` → PASS (the manifest test, if any, may assert the description — update its expectation, not the manifest)
Read the rendered README on GitHub after pushing, or in a Markdown preview, and confirm the `Polski` anchor jumps correctly.

- [ ] **Step 5: Ask Jakub to check the Polish**

The terminology table in Global Constraints and every Polish string in the catalogue are the one part of this work no test can validate. Ask before merging. Specifically worth a second opinion: `przeplot` for *pick*, `wzorzec` for the painted *target*, `nitki osnowy` for *warp ends*, and the dye names.

- [ ] **Step 6: Commit**

```bash
git add README.md apps/web/index.html apps/web/vite.config.ts
git commit -m "docs: add a Polish section to the README

Tablet weaving has a Polish word — krajki — and the README carried none of
it, so a Polish weaver searching in Polish found nothing. The section
leads with the WICI guide the project grew from rather than with the app.

Commands are not duplicated; the Polish section links up to Development so
there is one place to fix them."
```

- [ ] **Step 7: Repository topics (Jakub's call, outward-facing)**

Not part of the code change, and it alters repository metadata, so it is not run unasked:

```bash
gh repo edit Demonsthere/weavesmith \
  --add-topic krajki \
  --add-topic tablet-weaving \
  --add-topic tabletweaving \
  --add-topic weaving \
  --add-topic pwa
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Catalogue, `typeof en` contract | 1 |
| Detection, resolution order | 2, 4 (boot effect) |
| Locale state, persistence, absent from share link | 3 |
| `useT` | 4 |
| Toggle placement, own-language names, per-button `lang`, `documentElement.lang` | 4 |
| Test setup pins `en` | 3 |
| String coverage: chrome | 6 |
| String coverage: board | 7 |
| String coverage: editor, brush, weave | 8 |
| String coverage: file menu, pattern name, app-authored fallbacks | 6 (boot), 9 (file) |
| String coverage: chart, summary, print sheet | 10 |
| String coverage: footer | 11 |
| Catalogue parity / empty / key-as-value tests | 1 |
| Detection tests | 2 |
| Toggle tests | 4 |
| Polish render test | 11 |
| Known gaps left English and asserted | 11 |
| README Polish section, WICI emphasis | 12 |
| Bilingual meta + manifest | 12 |
| `gh repo edit` topics | 12 |

**Departure from the spec, resolved in this plan:** the spec files Polish plurals under future work for the live region. Task 5 brings them forward, because `chart/Summary.tsx` carries its own `plural()` and is in scope — the printed sheet says "24 picks" and Polish needs `przeploty` vs `przeplotów`. This does not widen the scope to the live region; it means finishing that later is cheaper than the spec assumed.

**Placeholder scan:** no TBD, no "handle edge cases", no "similar to Task N". Every code step carries its content. Test assertions against the default band use its real values — 8 cards, 32 warp ends, 24 picks, every turn forward, read from `state/defaultPattern.ts` while writing this plan rather than guessed.

**Type consistency:** `Messages`/`MessageKey` from `messages/en.js`; `Locale`/`LOCALES`/`CATALOGUES`/`DEFAULT_LOCALE` from `catalogues.js`; `detectLocale` from `detect.js`; `useT` from `useT.js`; `readLocale`/`writeLocale`/`clearLocale` from `io/preferences.js`; `WOOL_NAME_KEYS` replaces `WOOL_NAMES` in Task 8 and is consumed under that name in Task 10. `bootPattern` gains a second parameter in Task 6 and no later task calls it. Counted-noun keys defined in Task 5 are consumed only in Task 10, under the same names.
