# Paint a Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a weaver paint the band they want, solve for the turn sequence that produces it, and see honestly marked every cell no turn sequence can reach.

**Architecture:** A sparse `target` grid (`palette index | null`, `null` = "any colour will do") lives on `Pattern`, so it autosaves, exports and travels in a share link. A new `reportTarget` in core splits band-vs-target disagreements into *unreachable* (the solver cannot fix it) and *unmet* (a Solve would). The web app gains a third screen mode, `paint`; both existing binding hooks branch on it and dispatch three new commands, so there is still one editing model with three bindings.

**Tech Stack:** TypeScript, zero-dependency `@weavesmith/core`; React + Vite + zustand in `apps/web`; Vitest + @testing-library/react everywhere.

**Spec:** `docs/superpowers/specs/2026-08-04-paint-a-target-design.md`. Read it before Task 1.

## Global Constraints

- **TDD, always.** Write the failing test, run it, confirm it fails for the expected reason, then implement. Never write implementation first.
- **`packages/core` has zero runtime dependencies.** Do not add one.
- **Never edit a test fixture to make a test pass.** If a fixture and the code disagree, the code is wrong. No task here touches `packages/core/test/fixtures/`.
- **One editing model, three bindings.** Never add a capability to the pointer binding without the keyboard binding in the same task.
- **Board DOM stays row-major**: one element per pick, orientation via grid placement.
- **Identity colour never touches a note face.** Note faces carry thread colours only.
- Node ≥22, pnpm ≥9. Commands: `pnpm test`, `pnpm typecheck`, `pnpm --filter @weavesmith/core test`, `pnpm --filter @weavesmith/web test`.
- Commits: Conventional Commits. Explain *why* in the body when it is not obvious.
- Run a single core test file with `pnpm --filter @weavesmith/core exec vitest run test/<file> -t '<name>'`; the same with `@weavesmith/web` for the app.

---

### Task 1: `Pattern.target` and its validation

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/solve.ts:5-6` (move `TargetGrid` out, import it back)
- Modify: `packages/core/src/validate.ts:159-185` (add a target block before the final `return`)
- Test: `packages/core/test/validate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Pattern.target?: TargetGrid`, and `TargetGrid = (number | null)[][]` now exported from `types.ts` (it currently lives in `solve.ts`). Every later task depends on this shape: `target[pick][card]`, same dimensions as `picks`, `null` meaning "any colour will do".

`TargetGrid` must move to `types.ts` because `Pattern` lives there and `types.ts` must not import from `solve.ts` — `solve.ts` already imports `types.js`, and the reverse would be a cycle. Delete the definition from `solve.ts` and import it instead; do not re-export it from both files, because `index.ts` uses `export *` and TypeScript reports a duplicate export.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/test/validate.test.ts`, inside the existing top-level `describe('validatePattern', ...)`. Add `import { buildPattern, card, MADDER, WALNUT, WELD, WOAD } from './helpers/build.js';` if the file does not import them already.

`MIN_CARDS` is 4, so every band here has four cards and every target row has four entries — otherwise `validatePattern` adds a card-count problem of its own and the exact-equality expectations below stop being exact.

```ts
  const FOUR = () =>
    buildPattern(
      [
        card([WALNUT, MADDER, WOAD, WELD]),
        card([WALNUT, MADDER, WOAD, WELD]),
        card([WALNUT, MADDER, WOAD, WELD]),
        card([WALNUT, MADDER, WOAD, WELD], 'Z'),
      ],
      2,
    );
  /** One target row: `first` on card 1, don't-care on the rest. */
  const ROW = (first: number | null = null): (number | null)[] => [first, null, null, null];

  it('accepts a pattern with no target', () => {
    expect(validatePattern(FOUR())).toEqual([]);
  });

  it('accepts a target of the right shape', () => {
    expect(validatePattern({ ...FOUR(), target: [ROW(WALNUT), ROW()] })).toEqual([]);
  });

  it('rejects a target whose pick count differs from picks', () => {
    expect(validatePattern({ ...FOUR(), target: [ROW(WALNUT)] })).toEqual([
      'target has 1 picks but the band has 2',
    ]);
  });

  it('rejects a target row whose length differs from the card count', () => {
    expect(validatePattern({ ...FOUR(), target: [[WALNUT, null], ROW()] })).toEqual([
      'target pick 1 has 2 cells but the band has 4 cards',
    ]);
  });

  it('rejects a target colour that is not in the palette', () => {
    expect(validatePattern({ ...FOUR(), target: [ROW(99), ROW()] })).toEqual([
      'target pick 1, card 1: colour 99 is not in the palette',
    ]);
  });

  it('rejects a sparse target row rather than skipping its holes', () => {
    const sparse: (number | null)[] = [];
    sparse.length = 4; // four cells, not one of them actually present

    const problems = validatePattern({ ...FOUR(), target: [sparse, ROW()] });

    expect(problems).toHaveLength(4);
    expect(problems[0]).toBe('target pick 1, card 1: colour undefined is not in the palette');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @weavesmith/core exec vitest run test/validate.test.ts`
Expected: FAIL — the shape tests pass vacuously today (nothing checks `target`), so the three rejection tests fail with "expected [] to deeply equal [ 'target has 1 picks…' ]".

- [ ] **Step 3: Move `TargetGrid` into `types.ts`**

In `packages/core/src/types.ts`, add above `Pattern`:

```ts
/** Desired colour per cell, [pick][card]. null means "any colour will do". */
export type TargetGrid = (number | null)[][];
```

and add the field to `Pattern`, after `picks`:

```ts
  /**
   * What the weaver asked for, when they have painted anything — a palette
   * index per cell, or null for "any colour will do". Same dimensions as
   * `picks`. Absent, not empty, when nothing is painted: an all-null grid
   * and no grid mean the same thing, and only one of them should ever be
   * written to a file.
   */
  target?: TargetGrid;
```

In `packages/core/src/solve.ts`, delete the local `TargetGrid` definition (lines 5-6) and take it from types instead:

```ts
import { HOLE_COUNT } from './types.js';
import type { Card, Cell, Rotation, TargetGrid, Turn } from './types.js';
```

- [ ] **Step 4: Add the validation block**

In `packages/core/src/validate.ts`, insert immediately before the final `return problems;` of `inspect`:

```ts
  const target = pattern.target;
  if (target !== undefined) {
    if (!Array.isArray(target)) {
      problems.push('target must be an array');
    } else {
      if (target.length !== picks.length) {
        problems.push(`target has ${target.length} picks but the band has ${picks.length}`);
      }
      // Array.from: see the palette loop above — a sparse target must not
      // skip a hole's checks entirely.
      Array.from(target).forEach((raw, pick) => {
        if (!Array.isArray(raw)) {
          problems.push(`target pick ${pick + 1} must be an array of colours`);
          return;
        }
        if (raw.length !== cards.length) {
          problems.push(
            `target pick ${pick + 1} has ${raw.length} cells but the band has ` +
            `${cards.length} cards`,
          );
        }
        Array.from(raw).forEach((color, cardIndex) => {
          if (color === null) return;
          if (
            typeof color !== 'number' ||
            !Number.isInteger(color) ||
            color < 0 ||
            (palette !== null && color >= palette.length)
          ) {
            problems.push(
              `target pick ${pick + 1}, card ${cardIndex + 1}: ` +
              `colour ${describe(color)} is not in the palette`,
            );
          }
        });
      });
    }
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @weavesmith/core exec vitest run test/validate.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck the workspace**

Run: `pnpm typecheck`
Expected: clean. If `solve.test.ts` imports `TargetGrid` it still resolves — `index.ts` re-exports `types.js`.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/solve.ts \
        packages/core/src/validate.ts packages/core/test/validate.test.ts
git commit -m "feat(core): add an optional target grid to Pattern

The inverse solver already takes a target; the document had nowhere to
keep one. Optional, so every existing file stays valid without a version
bump, and validated against picks' dimensions because an imported file
can claim anything."
```

---

### Task 2: The target survives serialisation and palette collection

**Files:**
- Modify: `packages/core/src/serialise.ts:36-74` (`paletteIntegrityProblems`), `:89-137` (`gcPalette`)
- Test: `packages/core/test/serialise.test.ts`

**Interfaces:**
- Consumes: `Pattern.target` from Task 1.
- Produces: `gcPalette` keeps colours only the target references, and renumbers target indices with the rest.

`gcPalette` runs on every share and every save. It renumbers the palette; a target still holding pre-collection indices would silently repoint at different colours. This is the sharpest failure mode in the whole feature.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/test/serialise.test.ts`:

```ts
  it('round-trips a target', () => {
    const pattern = buildPattern(
      [
        card([WALNUT, MADDER, WOAD, WELD]),
        card([WALNUT, MADDER, WOAD, WELD]),
        card([WALNUT, MADDER, WOAD, WELD]),
        card([WALNUT, MADDER, WOAD, WELD], 'Z'),
      ],
      2,
    );
    pattern.target = [
      [MADDER, null, null, null],
      [null, null, WOAD, null],
    ];

    expect(fromJSON(toJSON(pattern))).toEqual(pattern);
  });

  it('keeps a colour only the target uses, and renumbers the target with it', () => {
    const pattern = buildPattern(
      [
        card([WALNUT, WALNUT, WALNUT, WALNUT]),
        card([WALNUT, WALNUT, WALNUT, WALNUT]),
        card([WALNUT, WALNUT, WALNUT, WALNUT]),
        card([WALNUT, WALNUT, WALNUT, WALNUT], 'Z'),
      ],
      1,
    );
    // CREAM (index 4) is used by nothing but the target.
    pattern.target = [[CREAM, null, null, null]];

    const collected = gcPalette(pattern);

    // WALNUT and CREAM survive, in ascending order of their old indices.
    expect(collected.palette).toEqual([PALETTE[WALNUT], PALETTE[CREAM]]);
    expect(collected.cards[0]!.colors).toEqual([0, 0, 0, 0]);
    expect(collected.target).toEqual([[1, null, null, null]]);
  });

  it('refuses a target index that is not in the palette', () => {
    const pattern = buildPattern(
      [
        card([WALNUT, WALNUT, WALNUT, WALNUT]),
        card([WALNUT, WALNUT, WALNUT, WALNUT]),
        card([WALNUT, WALNUT, WALNUT, WALNUT]),
        card([WALNUT, WALNUT, WALNUT, WALNUT], 'Z'),
      ],
      1,
    );
    pattern.target = [[99, null, null, null]];

    expect(() => gcPalette(pattern)).toThrow(PatternError);
  });
```

Import whatever of `PALETTE`, `CREAM`, `gcPalette`, `PatternError` the file does not already import.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @weavesmith/core exec vitest run test/serialise.test.ts`
Expected: the round-trip test passes already (JSON carries the field), the collection test fails with `collected.target` still `[[4, null, null, null]]`, and the refusal test fails because nothing throws.

- [ ] **Step 3: Teach `paletteIntegrityProblems` about the target**

In `packages/core/src/serialise.ts`, inside `paletteIntegrityProblems`, after the existing `pattern.cards.forEach(...)` block and before `return problems;`:

```ts
  // Same reason as the card loop: gcPalette's `remap.get(c)!` would produce
  // `undefined` for an out-of-range target index and launder a corrupt
  // pattern into one that validates clean.
  Array.from(pattern.target ?? []).forEach((row, pick) => {
    Array.from(row ?? []).forEach((color, cardIndex) => {
      if (color === null) return;
      if (!Number.isInteger(color) || color < 0 || color >= pattern.palette.length) {
        problems.push(
          `target pick ${pick + 1}, card ${cardIndex + 1}: ` +
          `colour ${String(color)} is not in the palette`,
        );
      }
    });
  });
```

- [ ] **Step 4: Count and remap the target in `gcPalette`**

Still in `serialise.ts`, in `gcPalette`, after the `used` loop over cards:

```ts
  // A colour the weaver has asked for is live even if no card carries it
  // yet — that is exactly the unreachable case the UI is built to report,
  // and collecting the colour away would rewrite the question.
  for (const row of pattern.target ?? []) {
    for (const color of row) if (color !== null) used.add(color);
  }
```

and in the returned object, after `picks:`:

```ts
    ...(pattern.target
      ? {
          target: pattern.target.map((row) =>
            row.map((color) => (color === null ? null : remap.get(color)!)),
          ),
        }
      : {}),
```

The spread of `...pattern` at the top of that object already copies `target` by reference; this overwrites it with the remapped copy, and contributes nothing when there is no target.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @weavesmith/core exec vitest run test/serialise.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/serialise.ts packages/core/test/serialise.test.ts
git commit -m "fix(core): carry the target through palette collection

gcPalette renumbers the palette on every save and share. A target left
holding pre-collection indices would silently repoint at different
colours, so target indices are remapped with the cards' and a colour only
the target references now counts as live."
```

---

### Task 3: `reportTarget` — unreachable versus unmet

**Files:**
- Modify: `packages/core/src/solve.ts` (append; it already imports what is needed except `simulate` and `Pattern`)
- Test: `packages/core/test/solve.test.ts`

**Interfaces:**
- Consumes: `Pattern.target` (Task 1), the existing `solveTurns`, `Unreachable`, and `simulate`.
- Produces:
```ts
export interface TargetReport { unreachable: Unreachable[]; unmet: Unreachable[] }
export function reportTarget(pattern: Pattern): TargetReport
```
Both lists hold `{ card, pick, wanted }`, 0-based, exactly like `solveTurns`' `unreachable`.

- [ ] **Step 1: Write the failing tests**

Add a new `describe` to `packages/core/test/solve.test.ts`:

```ts
describe('reportTarget', () => {
  const band = () =>
    buildPattern(
      [
        card([WALNUT, MADDER, WOAD, WELD], 'S'),
        card([WALNUT, MADDER, WOAD, WELD], 'Z'),
        card([WALNUT, MADDER, WOAD, WELD], 'S'),
        card([WALNUT, MADDER, WOAD, WELD], 'Z'),
      ],
      6,
    );

  it('reports nothing when there is no target', () => {
    expect(reportTarget(band())).toEqual({ unreachable: [], unmet: [] });
  });

  it('reports nothing for an all-null target', () => {
    const pattern = band();
    pattern.target = pattern.picks.map((row) => row.map(() => null));
    expect(reportTarget(pattern)).toEqual({ unreachable: [], unmet: [] });
  });

  it('reports nothing when the target is the band itself', () => {
    const pattern = band();
    pattern.target = targetOf(simulate(pattern));
    expect(reportTarget(pattern)).toEqual({ unreachable: [], unmet: [] });
  });

  it('reports a colour the card does not carry as unreachable', () => {
    const pattern = buildPattern(
      [
        card([WALNUT, WALNUT, MADDER, MADDER], 'S'),
        card([WALNUT, WALNUT, MADDER, MADDER], 'S'),
        card([WALNUT, WALNUT, MADDER, MADDER], 'S'),
        card([WALNUT, WALNUT, MADDER, MADDER], 'Z'),
      ],
      2,
    );
    pattern.target = [
      [WOAD, null, null, null],
      [null, null, null, null],
    ];

    const report = reportTarget(pattern);

    expect(report.unreachable).toEqual([{ card: 0, pick: 0, wanted: WOAD }]);
    expect(report.unmet).toEqual([]);
  });

  it('reports the same hole two picks running as unreachable', () => {
    // Rotation must change every pick, so a colour carried by exactly one
    // hole cannot show twice in a row. This is the constraint that makes the
    // feature honest rather than decorative.
    const pattern = buildPattern(
      [
        card([WALNUT, MADDER, WOAD, WELD], 'S'),
        card([WALNUT, MADDER, WOAD, WELD], 'S'),
        card([WALNUT, MADDER, WOAD, WELD], 'S'),
        card([WALNUT, MADDER, WOAD, WELD], 'Z'),
      ],
      2,
    );
    pattern.target = [
      [MADDER, null, null, null],
      [MADDER, null, null, null],
    ];

    const report = reportTarget(pattern);

    expect(report.unreachable).toHaveLength(1);
    expect(report.unreachable[0]!.wanted).toBe(MADDER);
    expect(report.unreachable[0]!.card).toBe(0);
  });

  it('reports a solvable disagreement as unmet, not unreachable', () => {
    const pattern = band();
    pattern.target = targetOf(simulate(pattern));
    // Flip one turn, as a Design-mode edit after a solve would.
    pattern.picks[2]![0] = -pattern.picks[2]![0]! as Turn;

    const report = reportTarget(pattern);

    expect(report.unreachable).toEqual([]);
    expect(report.unmet.length).toBeGreaterThan(0);
    expect(report.unmet.every((cell) => cell.card === 0)).toBe(true);
    expect(report.unmet.some((cell) => cell.pick === 2)).toBe(true);
  });
});
```

Add `reportTarget` to the file's existing import from `../src/index.js`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @weavesmith/core exec vitest run test/solve.test.ts -t reportTarget`
Expected: FAIL — `reportTarget is not a function`.

- [ ] **Step 3: Implement `reportTarget`**

At the top of `packages/core/src/solve.ts`, extend the imports:

```ts
import { advance, holeAt } from './conventions.js';
import { simulate } from './simulate.js';
import { HOLE_COUNT } from './types.js';
import type { Card, Cell, Pattern, Rotation, TargetGrid, Turn } from './types.js';
```

(`simulate.ts` imports only `types` and `conventions`, so this introduces no cycle.)

Append to the end of the file:

```ts
export interface TargetReport {
  /**
   * Cells no optimal turn sequence can satisfy — either the card does not
   * carry the colour at all, or satisfying this pick would cost a mismatch
   * at another. Re-solving will not help; the fix is a different hole
   * colour or a different threading.
   */
  unreachable: Unreachable[];
  /** Cells where the band simply disagrees with the target. Solve fixes these. */
  unmet: Unreachable[];
}

/**
 * Split every band-vs-target disagreement into the two kinds a weaver can
 * act on.
 *
 * The two look identical on the board and are not the same problem: after a
 * solve they coincide, but flipping a turn in Design mode afterwards makes a
 * cell unmet without making it unreachable. Linear in cells, so callers
 * recompute it rather than caching an answer that can go stale.
 */
export function reportTarget(pattern: Pattern): TargetReport {
  const target = pattern.target;
  if (target === undefined) return { unreachable: [], unmet: [] };

  const band = simulate(pattern);
  const solved = solveTurns(pattern.cards, target, { previous: pattern.picks });
  const blocked = new Set(solved.unreachable.map((cell) => `${cell.pick}:${cell.card}`));

  const unmet: Unreachable[] = [];
  target.forEach((row, pick) => {
    row.forEach((wanted, card) => {
      if (wanted === null) return;
      if (blocked.has(`${pick}:${card}`)) return;
      if (band[pick]?.[card]?.color === wanted) return;
      unmet.push({ card, pick, wanted });
    });
  });

  return { unreachable: solved.unreachable, unmet };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @weavesmith/core exec vitest run test/solve.test.ts`
Expected: PASS, including the pre-existing `solveTurns` tests.

- [ ] **Step 5: Run the whole core suite and typecheck**

Run: `pnpm --filter @weavesmith/core test && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/solve.ts packages/core/test/solve.test.ts
git commit -m "feat(core): report unreachable and unmet target cells separately

They look identical on the board and are not the same problem. A cell the
solver cannot satisfy needs a different hole colour or threading; a cell
that merely disagrees with the band needs a solve. Pins the sequential
constraint too: the same hole cannot show two picks running, because
rotation moves every pick."
```

---

### Task 4: Paint mode and the brush in the store

**Files:**
- Modify: `apps/web/src/state/store.ts:8` (`ScreenMode`), `:50-105` (state interface), `:109-120` (initial state), `:208-215` (actions), `:237-250` (`reset`)
- Test: `apps/web/test/state/store.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ScreenMode = 'design' | 'paint' | 'weave'`; `brush: number | null` (palette index, `null` = erase) and `setBrush: (brush: number | null) => void` on the store. `reset` restores `brush` to `0`; `load` leaves it alone, like the other display preferences.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/test/state/store.test.ts`:

```ts
  it('starts with the first palette entry as the brush', () => {
    expect(useStore.getState().brush).toBe(0);
  });

  it('sets the brush, including the erase brush', () => {
    useStore.getState().setBrush(3);
    expect(useStore.getState().brush).toBe(3);
    useStore.getState().setBrush(null);
    expect(useStore.getState().brush).toBeNull();
  });

  it('takes paint as a screen mode', () => {
    useStore.getState().setMode('paint');
    expect(useStore.getState().mode).toBe('paint');
  });

  it('restores the brush and the mode on reset', () => {
    useStore.getState().setBrush(null);
    useStore.getState().setMode('paint');
    useStore.getState().reset();
    expect(useStore.getState().brush).toBe(0);
    expect(useStore.getState().mode).toBe('design');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @weavesmith/web exec vitest run test/state/store.test.ts`
Expected: FAIL — `setBrush is not a function`, `brush` undefined.

- [ ] **Step 3: Implement**

In `apps/web/src/state/store.ts`:

```ts
export type ScreenMode = 'design' | 'paint' | 'weave';
```

In `StoreState`, beside `render`:

```ts
  // Which palette entry the paint brush lays down, or null for erase. UI
  // state like `orientation`/`render`/`mode` — the painting itself lives on
  // the pattern, this is only which colour the next stroke uses.
  brush: number | null;
```

and in the actions block of the interface, beside `setRender`:

```ts
  setBrush: (brush: number | null) => void;
```

In the store body, beside `render: 'woven',` add `brush: 0,`; beside `setRender` add:

```ts
  setBrush: (brush) => set({ brush }),
```

and in `reset`'s `set({ … })`, beside `render: 'woven',` add `brush: 0,`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @weavesmith/web exec vitest run test/state/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/state/store.ts apps/web/test/state/store.test.ts
git commit -m "feat(web): add paint mode and a brush to the store

The painting lives on the pattern; the brush is only which colour the
next stroke uses, so it belongs with the other display preferences and
resets with them."
```

---

### Task 5: The three paint commands

**Files:**
- Modify: `apps/web/src/state/commands.ts` (add three commands; extend `addCard` at `:147-154` and `removeCard` at `:179-182`)
- Test: `apps/web/test/state/commands.test.ts`

**Interfaces:**
- Consumes: `Pattern.target` (Task 1), `solveTurns` (core).
- Produces, all in the existing pure `CommandResult` shape:
```ts
paintTarget(pattern: Pattern, selection: Selection, color: number): CommandResult
clearTarget(pattern: Pattern, selection: Selection): CommandResult
solveTarget(pattern: Pattern): CommandResult
```
Later tasks dispatch exactly these three names through `runCommand`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/test/state/commands.test.ts`, using that file's existing `defaultPattern()`, `cell(pick, card)` and `rect(t0, c0, t1, c1)` helpers. Add the three new commands to its import from `../../src/state/commands.js`.

Two facts about `defaultPattern()` these tests rest on, both worth knowing before reading them: **card 0 is threaded all-walnut** (`colors: [0, 0, 0, 0]`), so any colour other than palette index 0 is permanently unreachable on it; and **card 3 carries four distinct colours**, so it is the card to use when a test needs a colour that *is* reachable.

```ts
const MADDER = 1;

describe('paintTarget', () => {
  it('creates the target lazily, filled with null', () => {
    const before = defaultPattern();
    expect(before.target).toBeUndefined();

    const { pattern: after, message } = paintTarget(before, cell(1, 2), MADDER);

    expect(after.target).toHaveLength(before.picks.length);
    expect(after.target![0]!).toHaveLength(before.cards.length);
    expect(after.target![1]![2]).toBe(MADDER);
    expect(after.target![0]![0]).toBeNull();
    expect(message).toBe('Painted 1 cell');
    // The command is pure: the pattern it was handed is untouched.
    expect(before.target).toBeUndefined();
  });

  it('paints every cell in the selection', () => {
    const { pattern: after } = paintTarget(defaultPattern(), rect(0, 0, 1, 1), MADDER);
    expect(after.target![0]![0]).toBe(MADDER);
    expect(after.target![0]![1]).toBe(MADDER);
    expect(after.target![1]![0]).toBe(MADDER);
    expect(after.target![1]![1]).toBe(MADDER);
  });
});

describe('clearTarget', () => {
  it('clears the selection back to null', () => {
    const painted = paintTarget(defaultPattern(), rect(0, 0, 1, 1), MADDER).pattern;
    const { pattern: after, message } = clearTarget(painted, cell(0, 0));
    expect(after.target![0]![0]).toBeNull();
    expect(after.target![1]![1]).toBe(MADDER);
    expect(message).toBe('Cleared 1 cell');
  });

  it('drops the target entirely once nothing is painted', () => {
    const painted = paintTarget(defaultPattern(), cell(0, 0), MADDER).pattern;
    const { pattern: after } = clearTarget(painted, cell(0, 0));
    expect(after.target).toBeUndefined();
  });

  it('is a no-op when nothing was ever painted', () => {
    const { pattern: after } = clearTarget(defaultPattern(), cell(0, 0));
    expect(after.target).toBeUndefined();
  });
});

describe('solveTarget', () => {
  it('says so when nothing is painted', () => {
    const before = defaultPattern();
    const { pattern: after, message } = solveTarget(before);
    expect(message).toBe('Nothing painted yet');
    expect(after.picks).toEqual(before.picks);
  });

  it('writes the turns that produce the painted colour', () => {
    const before = defaultPattern();
    // The colour card 3 would show at pick 1 if that turn were the other
    // way. Reachable by construction — no assumption about which hole is
    // where — and different from what the band shows now, because card 3
    // carries four distinct colours.
    const flipped = structuredClone(before);
    flipped.picks[1]![3] = -flipped.picks[1]![3]! as Turn;
    const wanted = simulate(flipped)[1]![3]!.color;
    expect(wanted).not.toBe(simulate(before)[1]![3]!.color);

    const { pattern: after, message } = solveTarget(
      paintTarget(before, cell(1, 3), wanted).pattern,
    );

    expect(simulate(after)[1]![3]!.color).toBe(wanted);
    expect(message).toMatch(/^Solved 1 cell/);
  });

  it('names the cells it could not reach', () => {
    // Card 0 is all walnut (palette 0), so madder can never show on it.
    const painted = paintTarget(defaultPattern(), cell(0, 0), MADDER).pattern;

    const { message } = solveTarget(painted);

    expect(message).toContain('1 unreachable');
    expect(message).toContain('card 1 pick 1');
    expect(message).toMatch(/^Solved 0 cells/);
  });
});

describe('card add/remove with a target', () => {
  it('keeps target rows the same width as pick rows', () => {
    const painted = paintTarget(defaultPattern(), cell(0, 0), MADDER).pattern;

    const grown = addCard(painted, 'S').result.pattern;
    expect(grown.target![0]!).toHaveLength(grown.picks[0]!.length);

    const shrunk = removeCard(grown, removalIndex(grown.cards)).pattern;
    expect(shrunk.target![0]!).toHaveLength(shrunk.picks[0]!.length);
  });
});
```

`Turn` needs importing as a type from `@weavesmith/core` if the file does not already.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @weavesmith/web exec vitest run test/state/commands.test.ts`
Expected: FAIL — `paintTarget is not exported`.

- [ ] **Step 3: Implement the commands**

In `apps/web/src/state/commands.ts`, extend the core import to include `solveTurns`, and append:

```ts
/** A fully-null target of the pattern's dimensions. */
function emptyTarget(pattern: Pattern): (number | null)[][] {
  return pattern.picks.map(() => pattern.cards.map(() => null));
}

/**
 * Ask for a colour on every cell in the selection.
 *
 * The target is created on first use rather than carried empty: an all-null
 * grid and no grid mean the same thing, and only one of them belongs in a
 * saved file.
 */
export function paintTarget(
  pattern: Pattern,
  selection: Selection,
  color: number,
): CommandResult {
  const cells = cellsIn(selectionRect(selection));
  const next = edit(pattern, (draft) => {
    const target = draft.target ?? emptyTarget(draft);
    for (const { pick, card } of cells) target[pick]![card] = color;
    draft.target = target;
  });
  return { pattern: next, message: `Painted ${plural(cells.length, 'cell')}` };
}

/** Take the selection back to "any colour will do". */
export function clearTarget(pattern: Pattern, selection: Selection): CommandResult {
  const cells = cellsIn(selectionRect(selection));
  const next = edit(pattern, (draft) => {
    if (!draft.target) return;
    for (const { pick, card } of cells) draft.target[pick]![card] = null;
    if (draft.target.every((row) => row.every((color) => color === null))) {
      delete draft.target;
    }
  });
  return { pattern: next, message: `Cleared ${plural(cells.length, 'cell')}` };
}

/**
 * Solve the whole band for the painted target.
 *
 * Whole band, not "affected columns": unpainted cells are null, which costs
 * the solver nothing, and `previous` breaks ties toward the turns the weaver
 * already has — so untouched columns come back exactly as they went in.
 */
export function solveTarget(pattern: Pattern): CommandResult {
  const target = pattern.target;
  if (!target) return { pattern, message: 'Nothing painted yet' };

  const { picks, unreachable } = solveTurns(pattern.cards, target, {
    previous: pattern.picks,
  });
  const next = edit(pattern, (draft) => {
    draft.picks = picks;
  });

  const painted = target.reduce(
    (count, row) => count + row.filter((color) => color !== null).length,
    0,
  );
  let message = `Solved ${plural(painted - unreachable.length, 'cell')}`;
  if (unreachable.length > 0) {
    const named = unreachable
      .slice(0, 3)
      .map((cell) => `card ${cell.card + 1} pick ${cell.pick + 1}`)
      .join(', ');
    message += `; ${unreachable.length} unreachable (${named})`;
  }
  return { pattern: next, message };
}
```

In `addCard`'s `edit` callback, after `for (const row of draft.picks) row.splice(index, 0, 1);`:

```ts
    if (draft.target) for (const row of draft.target) row.splice(index, 0, null);
```

In `removeCard`'s `edit` callback, after `for (const row of draft.picks) row.splice(index, 1);`:

```ts
    if (draft.target) for (const row of draft.target) row.splice(index, 1);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @weavesmith/web exec vitest run test/state/commands.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/state/commands.ts apps/web/test/state/commands.test.ts
git commit -m "feat(web): add paintTarget, clearTarget and solveTarget

Solve runs over the whole band rather than tracking affected columns:
unpainted cells are null, and solveTurns' previous-turn tie-break returns
untouched columns unchanged, so there is no bookkeeping to get wrong."
```

---

### Task 6: The pointer binding paints

**Files:**
- Modify: `apps/web/src/board/usePointerBinding.ts:89` (gesture ref type), `:96-127` (`onPointerDown`), `:129-160` (`onPointerMove`)
- Test: `apps/web/test/board/pointer.test.tsx` (the existing pointer test file; create `apps/web/test/board/paintPointer.test.tsx` if that name is taken by something narrower)

**Interfaces:**
- Consumes: `paintTarget`/`clearTarget` (Task 5), `brush`/`mode` (Task 4).
- Produces: no new exports. In `mode === 'paint'`, press-and-drag paints a run in one gesture; hover preview is suppressed.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

const cell = (pick: number, card: number) =>
  screen.getByLabelText(new RegExp(`Card ${card + 1}, pick ${pick + 1},`));

describe('painting with the pointer', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().setMode('paint');
  });

  it('paints a run in one gesture and one undo entry', async () => {
    const user = userEvent.setup();
    useStore.getState().setBrush(2);
    render(<Board />);

    await user.pointer([
      { target: cell(0, 1), keys: '[MouseLeft>]' },
      { target: cell(1, 1) },
      { target: cell(2, 1) },
      { keys: '[/MouseLeft]' },
    ]);

    const { pattern } = useStore.getState();
    expect(pattern.target![0]![1]).toBe(2);
    expect(pattern.target![1]![1]).toBe(2);
    expect(pattern.target![2]![1]).toBe(2);

    useStore.getState().undo();
    expect(useStore.getState().pattern.target).toBeUndefined();
  });

  it('erases with the null brush', async () => {
    const user = userEvent.setup();
    useStore.getState().setBrush(2);
    render(<Board />);
    await user.click(cell(0, 1));
    expect(useStore.getState().pattern.target![0]![1]).toBe(2);

    useStore.getState().setBrush(null);
    await user.click(cell(0, 1));
    expect(useStore.getState().pattern.target).toBeUndefined();
  });

  it('leaves the turns alone while painting', async () => {
    const user = userEvent.setup();
    const before = structuredClone(useStore.getState().pattern.picks);
    useStore.getState().setBrush(1);
    render(<Board />);

    await user.click(cell(0, 1));

    expect(useStore.getState().pattern.picks).toEqual(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @weavesmith/web exec vitest run test/board/paintPointer.test.tsx`
Expected: FAIL — the click flips a turn instead of painting; `pattern.target` is undefined.

- [ ] **Step 3: Implement the paint branch**

In `apps/web/src/board/usePointerBinding.ts`, extend the imports:

```ts
import { clearTarget, paintTarget, runCommand, setTurn } from '../state/commands.js';
```

Replace the gesture ref declaration and its comment with a discriminated union:

```ts
  // The gesture in progress, or null. `kind` says which command the drag is
  // repeating: a turn drag carries the direction taken from the first cell,
  // a paint drag carries the brush the stroke started with — so changing the
  // brush mid-drag cannot split a stroke into two colours.
  type Gesture =
    | { kind: 'turn'; dir: Turn; token: GestureToken }
    | { kind: 'paint'; brush: number | null; token: GestureToken };
  const gestureRef = useRef<Gesture | null>(null);
```

(Declare `type Gesture` above the hook, at module scope, rather than inside it.)

In `onPointerDown`, after the shift-click branch and `clearHover()`, before the existing turn logic:

```ts
    const { mode, brush } = useStore.getState();

    const singleCell: Selection = { anchor: target, focus: target };
    setSelection(singleCell);

    if (mode === 'paint') {
      const token = beginGesture((draft) => {
        if (brush === null) runCommand(draft, clearTarget, singleCell);
        else runCommand(draft, paintTarget, singleCell, brush);
      }, brush === null ? 'Clear target' : 'Paint target');
      gestureRef.current = { kind: 'paint', brush, token };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
```

Delete the now-duplicated `const singleCell` / `setSelection(singleCell)` lines from the turn path below, and tag its gesture: `gestureRef.current = { kind: 'turn', dir, token };`.

In `onPointerMove`'s drag branch, replace the single `continueGesture` call with:

```ts
      continueGesture(gesture.token, (draft) => {
        if (gesture.kind === 'paint') {
          if (gesture.brush === null) runCommand(draft, clearTarget, grown);
          else runCommand(draft, paintTarget, grown, gesture.brush);
        } else {
          runCommand(draft, setTurn, grown, gesture.dir);
        }
      });
```

And suppress the hover preview outside Design mode — replace

```ts
    if (!canHover() || useStore.getState().mode === 'weave') return;
```

with

```ts
    // Hover previews the *ripple*, which only Design mode can cause: a
    // target does not ripple, and Weave mode is not editing at all.
    if (!canHover() || useStore.getState().mode !== 'design') return;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @weavesmith/web exec vitest run test/board/paintPointer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the whole web suite**

Run: `pnpm --filter @weavesmith/web test`
Expected: PASS — the existing pointer and parity tests still pass, because Design mode's path is unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/board/usePointerBinding.ts apps/web/test/board/paintPointer.test.tsx
git commit -m "feat(web): paint the target by pointer in paint mode

The drag carries the brush it started with, so changing colour mid-stroke
cannot split one gesture into two colours. Hover preview is suppressed:
it previews a ripple, and a target does not ripple."
```

---

### Task 7: The keyboard paints, and solves

**Files:**
- Modify: `apps/web/src/board/useKeyboardBinding.ts:40-47` (destructure `mode`/`brush`), `:76-82` (add the solve chord after undo/redo), `:123-128` (`Enter`/`Space`), `:162-167` (digits), plus a new `Backspace`/`Delete` case
- Test: `apps/web/test/board/paintKeyboard.test.tsx`

**Interfaces:**
- Consumes: `paintTarget`/`clearTarget`/`solveTarget` (Task 5), `brush`/`setBrush`/`mode` (Task 4).
- Produces: no new exports. Paint-mode keys: `1`–`9` choose the brush, `Enter`/`Space` paint the selection, `Backspace`/`Delete` clear it, `Ctrl`/`Cmd`+`Enter` solves.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

const cell = (pick: number, card: number) =>
  screen.getByLabelText(new RegExp(`Card ${card + 1}, pick ${pick + 1},`));

describe('painting with the keyboard', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().setMode('paint');
  });

  it('chooses the brush with a digit', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(cell(0, 0));
    await user.keyboard('3');
    expect(useStore.getState().brush).toBe(2);
  });

  it('refuses a digit past the end of the palette', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(cell(0, 0));
    const size = useStore.getState().pattern.palette.length;
    expect(size).toBeLessThan(9);

    await user.keyboard('9');

    expect(useStore.getState().brush).toBe(0);
    expect(screen.getByRole('status')).toHaveTextContent(`${size} colours`);
  });

  it('paints the selection with Enter and clears it with Backspace', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(cell(0, 0));
    await user.keyboard('{Escape}{Shift>}{ArrowDown}{/Shift}2{Enter}');

    expect(useStore.getState().pattern.target![0]![0]).toBe(1);
    expect(useStore.getState().pattern.target![1]![0]).toBe(1);

    await user.keyboard('{Backspace}');
    expect(useStore.getState().pattern.target).toBeUndefined();
  });

  it('solves with Ctrl+Enter', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(cell(1, 0));

    const { pattern } = useStore.getState();
    const currently = pattern.cards[0]!.colors[0];
    const wanted = pattern.cards[0]!.colors.findIndex((c) => c !== currently) + 1;
    await user.keyboard(`${wanted}{Enter}{Control>}{Enter}{/Control}`);

    expect(useStore.getState().pattern.picks).not.toEqual(pattern.picks);
    expect(screen.getByRole('status')).toHaveTextContent(/Solved/);
  });

  it('leaves the Design-mode keys alone', async () => {
    const user = userEvent.setup();
    useStore.getState().setMode('design');
    render(<Board />);
    await user.click(cell(0, 0));
    await user.keyboard('2');

    // Digit 2 is setHole B in Design mode: turns change, target does not exist.
    expect(useStore.getState().pattern.target).toBeUndefined();
    expect(useStore.getState().brush).toBe(0);
  });
});
```

`screen.getByRole('status')` targets `LiveRegion`. If `LiveRegion` renders `aria-live` without `role="status"`, use `screen.getByTestId(...)` with whatever test id it already carries, or query the live region by its `aria-live` attribute — check `apps/web/src/board/LiveRegion.tsx` first and match it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @weavesmith/web exec vitest run test/board/paintKeyboard.test.tsx`
Expected: FAIL — digits still run `setHole`, `Backspace` does nothing.

- [ ] **Step 3: Implement**

In `apps/web/src/board/useKeyboardBinding.ts`, extend the command import:

```ts
import {
  clearTarget, paintTarget, runCommand, setHole, setThreading, setTurn, solveTarget, toggleTurn,
} from '../state/commands.js';
```

Extend the destructure at the top of `onKeyDown`:

```ts
    const {
      selection, pattern, orientation, mode, brush,
      moveFocus, setSelection, apply, undo, redo,
    } = useStore.getState();
```

Immediately after the undo/redo branch, add the solve chord (it must come before the "any modifier means the browser's" guard further down):

```ts
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      if (mode !== 'paint') return;
      event.preventDefault();
      run('Solve target', solveTarget);
      return;
    }
```

Replace the `' '` / `'Enter'` case:

```ts
      case ' ':
      case 'Enter':
        event.preventDefault();
        if (mode === 'paint') {
          if (brush === null) run('Clear target', clearTarget, selection);
          else run('Paint target', paintTarget, selection, brush);
          return;
        }
        run('Toggle turn', toggleTurn, selection);
        return;
```

Add a case to the same `switch`, after `'Escape'`:

```ts
      case 'Backspace':
      case 'Delete':
        if (mode !== 'paint') return;
        event.preventDefault();
        run('Clear target', clearTarget, selection);
        return;
```

Replace the digit branch at the end:

```ts
    // Digits mean different things per mode: a hole in Design, a brush in
    // Paint. Accepted deliberately — a second keyset for painting runs out
    // of both keys and muscle memory.
    if (event.key >= '1' && event.key <= '9') {
      event.preventDefault();
      const index = Number(event.key) - 1;

      if (mode === 'paint') {
        if (index >= pattern.palette.length) {
          setMessage(`The palette has ${pattern.palette.length} colours`);
          return;
        }
        useStore.getState().setBrush(index);
        setMessage(`Brush ${index + 1}`);
        return;
      }

      if (event.key <= '4') {
        run(`Show hole ${event.key}`, setHole, selection, index as Hole);
      }
      return;
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @weavesmith/web exec vitest run test/board/paintKeyboard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the whole web suite**

Run: `pnpm --filter @weavesmith/web test`
Expected: PASS — Design-mode keys are unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/board/useKeyboardBinding.ts apps/web/test/board/paintKeyboard.test.tsx
git commit -m "feat(web): paint and solve from the keyboard

Digits choose a brush in Paint mode and a hole in Design mode. The double
meaning is deliberate: a separate keyset for painting runs out of keys
before it runs out of commands."
```

---

### Task 8: The brush strip, the Solve button and the mode toggle

**Files:**
- Create: `apps/web/src/paint/BrushStrip.tsx`
- Create: `apps/web/src/paint/brushStrip.css`
- Modify: `apps/web/src/App.tsx:16-19` (`SCREEN_MODES`), `:127` (mount)
- Test: `apps/web/test/paint/brushStrip.test.tsx`

**Interfaces:**
- Consumes: `brush`/`setBrush`/`mode` (Task 4), `paintTarget`/`clearTarget`/`solveTarget` (Task 5), `WOOL_NAMES` from `apps/web/src/editor/palette.ts`.
- Produces: `export function BrushStrip(): JSX.Element`, mounted only in Paint mode.

The strip carries its own visible report (`role="status"`) rather than reaching the board's `LiveRegion`: a Solve result — "3 unreachable" — is something a weaver needs to keep reading while they decide what to do, not something that should flash past.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { BrushStrip } from '../../src/paint/BrushStrip.js';
import { useStore } from '../../src/state/store.js';

describe('BrushStrip', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().setMode('paint');
    useStore.getState().setSelection({
      anchor: { pick: 0, card: 0 },
      focus: { pick: 1, card: 0 },
    });
  });

  it('shows one swatch per palette entry, plus erase', () => {
    render(<BrushStrip />);
    const { palette } = useStore.getState().pattern;
    expect(screen.getAllByRole('button', { name: /brush/i })).toHaveLength(palette.length + 1);
  });

  it('sets the brush and paints the selection in one click', async () => {
    const user = userEvent.setup();
    render(<BrushStrip />);

    await user.click(screen.getAllByRole('button', { name: /brush/i })[1]!);

    expect(useStore.getState().brush).toBe(1);
    expect(useStore.getState().pattern.target![0]![0]).toBe(1);
    expect(useStore.getState().pattern.target![1]![0]).toBe(1);
  });

  it('erases with the erase brush', async () => {
    const user = userEvent.setup();
    render(<BrushStrip />);
    await user.click(screen.getAllByRole('button', { name: /brush/i })[1]!);
    await user.click(screen.getByRole('button', { name: /erase/i }));

    expect(useStore.getState().brush).toBeNull();
    expect(useStore.getState().pattern.target).toBeUndefined();
  });

  it('reports the solve, and keeps the report on screen', async () => {
    const user = userEvent.setup();
    render(<BrushStrip />);
    await user.click(screen.getAllByRole('button', { name: /brush/i })[1]!);
    await user.click(screen.getByRole('button', { name: 'Solve' }));

    expect(screen.getByRole('status')).toHaveTextContent(/Solved|unreachable/);
  });

  it('marks the active brush pressed', async () => {
    const user = userEvent.setup();
    render(<BrushStrip />);
    const second = screen.getAllByRole('button', { name: /brush/i })[1]!;
    await user.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @weavesmith/web exec vitest run test/paint/brushStrip.test.tsx`
Expected: FAIL — cannot resolve `../../src/paint/BrushStrip.js`.

- [ ] **Step 3: Write the component**

`apps/web/src/paint/BrushStrip.tsx`:

```tsx
import { useState } from 'react';
import { runCommand, clearTarget, paintTarget, solveTarget } from '../state/commands.js';
import { useStore } from '../state/store.js';
import { WOOL_NAMES } from '../editor/palette.js';
import '../styles/controls.css';
import './brushStrip.css';

/** A palette entry's name if it is one of the dyed-wool presets, else its hex. */
const colorName = (hex: string): string => WOOL_NAMES[hex] ?? hex;

/**
 * Paint mode's chrome: which colour the brush lays down, and the Solve that
 * turns the painting into turns.
 *
 * A swatch click both sets the brush and paints the current selection, so a
 * select-then-colour weaver and a drag-with-a-brush weaver each get one
 * gesture instead of two.
 *
 * The report is a visible `role="status"` line rather than the board's live
 * region: "3 unreachable" is something you read while deciding what to do
 * about it, not something that should flash past.
 */
export function BrushStrip() {
  const pattern = useStore((state) => state.pattern);
  const brush = useStore((state) => state.brush);
  const setBrush = useStore((state) => state.setBrush);
  const [report, setReport] = useState('');

  const pick = (index: number | null) => {
    setBrush(index);
    const { selection, apply } = useStore.getState();
    let message = '';
    apply((draft) => {
      message = index === null
        ? runCommand(draft, clearTarget, selection)
        : runCommand(draft, paintTarget, selection, index);
    }, index === null ? 'Clear target' : 'Paint target');
    setReport(message);
  };

  const solve = () => {
    let message = '';
    useStore.getState().apply((draft) => {
      message = runCommand(draft, solveTarget);
    }, 'Solve target');
    setReport(message);
  };

  return (
    <div className="brushstrip">
      <div className="swatches" role="group" aria-label="Brush colour">
        {pattern.palette.map((hex, index) => (
          <button
            key={hex}
            type="button"
            className="swatch"
            style={{ background: hex }}
            aria-pressed={brush === index}
            aria-label={`Brush ${index + 1}, ${colorName(hex)}`}
            onClick={() => pick(index)}
          />
        ))}
        <button
          type="button"
          className="swatch erase"
          aria-pressed={brush === null}
          aria-label="Erase brush"
          onClick={() => pick(null)}
        >
          ⌧
        </button>
      </div>
      <button type="button" className="btn" onClick={solve}>
        Solve
      </button>
      <p className="brush-report" role="status">
        {report}
      </p>
    </div>
  );
}
```

`apps/web/src/paint/brushStrip.css`:

```css
.brushstrip {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.swatches { display: flex; gap: 6px; }
.swatch {
  width: 28px; height: 28px;
  border: 1px solid var(--line);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}
.swatch[aria-pressed='true'] { outline: 2px solid var(--accent); outline-offset: 2px; }
.swatch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.swatch.erase { background: transparent; color: var(--text); }
.brush-report { margin: 0; font-size: 0.9rem; color: var(--text); min-height: 1.2em; }
```

- [ ] **Step 4: Wire it into the app**

In `apps/web/src/App.tsx`, extend `SCREEN_MODES`:

```ts
const SCREEN_MODES: { value: ScreenMode; label: string }[] = [
  { value: 'design', label: 'Design' },
  { value: 'paint', label: 'Paint' },
  { value: 'weave', label: 'Weave' },
];
```

Import the strip (`import { BrushStrip } from './paint/BrushStrip.js';`) and mount it beside `WeaveBar`, keeping that line's reasoning intact:

```tsx
      {mode === 'weave' && <WeaveBar />}
      {mode === 'paint' && <BrushStrip />}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @weavesmith/web exec vitest run test/paint/brushStrip.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the whole web suite**

Run: `pnpm --filter @weavesmith/web test`
Expected: PASS. The smoke test may assert the set of mode buttons — if it fails on the new Paint button, update the smoke test's expectation, not the toggle.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/paint apps/web/src/App.tsx apps/web/test/paint
git commit -m "feat(web): add the brush strip and the Solve button

A swatch click sets the brush and paints the current selection, so both
ways of working cost one gesture. The solve report is a visible status
line, not a live-region flash: 'three unreachable' is something you read
while deciding what to change."
```

---

### Task 9: Mark the cells the band cannot deliver

**Files:**
- Modify: `apps/web/src/board/Cell.tsx` (props, classes, `aria-label`, `--wanted`)
- Modify: `apps/web/src/board/Board.tsx:37-46` (report memo), `:110-120` (board classes), `:148-169` (cell props)
- Modify: `apps/web/src/styles/board.css` (append after the existing `.cell.willchange` rule)
- Test: `apps/web/test/board/unmet.test.tsx`

**Interfaces:**
- Consumes: `reportTarget` (Task 3), `mode` (Task 4).
- Produces: `Cell` gains two props:
```ts
  /** The colour the target asks for here, when Paint mode should draw it. */
  targetHex: string | null;
  /** Set when band and target disagree here. */
  unmet: { hex: string; reachable: boolean } | null;
```

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulate } from '@weavesmith/core';
import type { Turn } from '@weavesmith/core';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

const cell = (pick: number, card: number) =>
  screen.getByLabelText(new RegExp(`Card ${card + 1}, pick ${pick + 1},`));

const MADDER = 1;

/**
 * Ask for madder on card 0, which is threaded all-walnut — so this is
 * unreachable by construction, not by luck.
 */
function paintUnreachable() {
  useStore.getState().apply((draft) => {
    draft.target = draft.picks.map(() => draft.cards.map(() => null));
    draft.target[0]![0] = MADDER;
  }, 'test');
}

/**
 * Ask card 3 (four distinct colours) for the colour the *other* turn at pick
 * 1 would show, without changing the turns. Reachable, and not what the band
 * currently shows — so it is unmet-but-solvable.
 */
function paintUnmet() {
  const before = useStore.getState().pattern;
  const flipped = structuredClone(before);
  flipped.picks[1]![3] = -flipped.picks[1]![3]! as Turn;
  const wanted = simulate(flipped)[1]![3]!.color;
  expect(wanted).not.toBe(simulate(before)[1]![3]!.color);

  useStore.getState().apply((draft) => {
    draft.target = draft.picks.map(() => draft.cards.map(() => null));
    draft.target[1]![3] = wanted;
  }, 'test');
  return wanted;
}

describe('unmet cells', () => {
  beforeEach(() => useStore.getState().reset());

  it('marks an unreachable cell and names it for a screen reader', () => {
    paintUnreachable();
    render(<Board />);

    expect(cell(0, 0).className).toContain('unmet');
    expect(cell(0, 0).getAttribute('aria-label')).toMatch(/wanted .*unreachable/i);
  });

  it('tells a solvable disagreement apart from an unreachable one', () => {
    paintUnmet();
    render(<Board />);

    expect(cell(1, 3).className).toContain('unmet');
    expect(cell(1, 3).getAttribute('aria-label')).toMatch(/press Solve/i);
    expect(cell(1, 3).getAttribute('aria-label')).not.toMatch(/unreachable/i);
  });

  it('carries no marks in weave mode', () => {
    paintUnreachable();
    useStore.getState().setMode('weave');
    render(<Board />);

    expect(cell(0, 0).className).not.toContain('unmet');
  });

  it('draws the painted colour in paint mode', () => {
    paintUnreachable();
    useStore.getState().setMode('paint');
    render(<Board />);

    const { palette } = useStore.getState().pattern;
    const note = cell(0, 0).querySelector('.note') as HTMLElement;
    // jsdom normalises a hex background to rgb(), so compare loosely: the
    // note must not be showing walnut, which is what the band weaves there.
    expect(note.style.background).not.toBe(palette[0]);
    expect(cell(0, 0).className).toContain('painted');
    expect(cell(0, 1).className).toContain('unpainted');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @weavesmith/web exec vitest run test/board/unmet.test.tsx`
Expected: FAIL — no `unmet` class, no "wanted" in the label.

- [ ] **Step 3: Extend `Cell`**

`apps/web/src/board/Cell.tsx` — add the two props to the interface and destructure, then:

```tsx
  const classes = [
    'cell',
    cell.lean === '/' ? 'lean-s' : 'lean-z',
    selected ? 'selected' : '',
    focused ? 'focused' : '',
    weaveState === 'none' ? '' : weaveState,
    ghost ? 'ghost' : '',
    willChange ? 'willchange' : '',
    unmet ? 'unmet' : '',
    targetHex === null ? 'unpainted' : 'painted',
  ].filter(Boolean).join(' ');

  const wanted = unmet
    ? `, wanted ${unmet.hex}${unmet.reachable ? ' — press Solve' : ' — unreachable'}`
    : '';

  return (
    <button
      type="button"
      role="gridcell"
      className={classes}
      style={unmet ? ({ ...style, '--wanted': unmet.hex } as CSSProperties) : style}
      tabIndex={focused ? 0 : -1}
      data-pick={pick}
      data-card={card}
      aria-label={
        `Card ${card + 1}, pick ${pick + 1}, turning ` +
        `${turn === 1 ? 'forward' : 'backward'}${wanted}`
      }
    >
      <span className="note" style={{ background: targetHex ?? hex }} />
    </button>
  );
```

- [ ] **Step 4: Compute the report in `Board`**

In `apps/web/src/board/Board.tsx`, import `reportTarget` alongside `simulate`, and after the `band` memo:

```ts
  // Recomputed rather than cached: reportTarget is linear in cells, and a
  // stale answer here would be a board that lies about what the loom will
  // produce. Weave mode is the at-loom view and carries no marks at all.
  const marks = useMemo(() => {
    if (mode === 'weave') return new Map<string, { hex: string; reachable: boolean }>();
    const report = reportTarget(pattern);
    const entries = new Map<string, { hex: string; reachable: boolean }>();
    for (const cell of report.unreachable) {
      entries.set(`${cell.pick}:${cell.card}`, {
        hex: pattern.palette[cell.wanted]!,
        reachable: false,
      });
    }
    for (const cell of report.unmet) {
      entries.set(`${cell.pick}:${cell.card}`, {
        hex: pattern.palette[cell.wanted]!,
        reachable: true,
      });
    }
    return entries;
  }, [pattern, mode]);
```

Add `paint` to the board's class list:

```tsx
        className={`board ${vertical ? 'v' : 'h'} mode-${render}${mode === 'paint' ? ' paint' : ''}`}
```

And pass the two new props where `Cell` is rendered:

```tsx
                unmet={marks.get(`${t}:${c}`) ?? null}
                targetHex={
                  mode === 'paint' && pattern.target?.[t]?.[c] != null
                    ? pattern.palette[pattern.target[t]![c]!]!
                    : null
                }
```

- [ ] **Step 5: Add the CSS**

Append to `apps/web/src/styles/board.css`, **after** the `.cell.willchange::after` rule — both use `::after` at equal specificity, so source order decides, and on the rare cell that is both hovered-preview and unmet the slash should win:

```css
/* Band and target disagree here. The note keeps the colour that will
   actually be woven — desaturated, not replaced, because the board must not
   lie about the loom's output. The slash is currentColor so it survives a
   greyscale print; the pip carries the colour that was asked for. */
.cell.unmet .note { filter: saturate(0.25); }
.cell.unmet::after {
  content: ""; position: absolute; inset: 2px; z-index: 4; pointer-events: none;
  background: linear-gradient(to top right,
    transparent calc(50% - 1px), currentColor calc(50% - 1px),
    currentColor calc(50% + 1px), transparent calc(50% + 1px));
}
.cell.unmet::before {
  content: ""; position: absolute; top: 2px; right: 2px;
  width: 6px; height: 6px; border-radius: 1px;
  background: var(--wanted); z-index: 5; pointer-events: none;
}

/* Paint mode draws the target, which has no lean and no weave texture. */
.board.paint .note { transform: none; background-image: none; }
.board.paint .cell.unpainted .note { opacity: 0.3; }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @weavesmith/web exec vitest run test/board/unmet.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the whole web suite**

Run: `pnpm --filter @weavesmith/web test`
Expected: PASS. Existing board tests that assert `aria-label` with an exact string will need the label's new optional suffix accounted for — they use a `Card N, pick M,` prefix regex, which still matches.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/board/Cell.tsx apps/web/src/board/Board.tsx \
        apps/web/src/styles/board.css apps/web/test/board/unmet.test.tsx
git commit -m "feat(web): mark cells where the band cannot match the target

The note keeps the colour that will actually be woven, desaturated rather
than replaced — the board must not lie about the loom's output. The slash
prints black and the corner pip carries the colour that was asked for,
and the same fact is in the aria-label, so the mark is never the only
channel."
```

---

### Task 10: The summary counts them

**Files:**
- Modify: `apps/web/src/chart/Summary.tsx`
- Test: `apps/web/test/chart/summary.test.tsx`

**Interfaces:**
- Consumes: `reportTarget` (Task 3).
- Produces: nothing new; one extra line in the existing `Summary` section.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/test/chart/summary.test.tsx`:

```tsx
  it('counts unreachable and unmet cells when a target exists', () => {
    useStore.getState().reset();
    // Madder on card 0, which is threaded all-walnut: unreachable by
    // construction.
    useStore.getState().apply((draft) => {
      draft.target = draft.picks.map(() => draft.cards.map(() => null));
      draft.target[0]![0] = 1;
    }, 'test');

    render(<Summary />);

    expect(screen.getByText(/1 cell unreachable/)).toBeInTheDocument();
  });

  it('says nothing about targets when nothing is painted', () => {
    useStore.getState().reset();
    render(<Summary />);
    expect(screen.queryByText(/unreachable/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @weavesmith/web exec vitest run test/chart/summary.test.tsx`
Expected: FAIL — no such text.

- [ ] **Step 3: Implement**

In `apps/web/src/chart/Summary.tsx`, import `reportTarget` from `@weavesmith/core`, add a plural helper and the section:

```tsx
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
```

Inside the component, after `const twist = netTwist(pattern);`:

```tsx
  const report = reportTarget(pattern);
  const painted = report.unreachable.length + report.unmet.length > 0;
```

and before the closing `</section>`:

```tsx
      {painted && (
        <>
          <h3>Against the target</h3>
          <p className="summary-line">
            {plural(report.unreachable.length, 'cell')} unreachable,{' '}
            {plural(report.unmet.length, 'cell')} unmet.
          </p>
        </>
      )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @weavesmith/web exec vitest run test/chart/summary.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/chart/Summary.tsx apps/web/test/chart/summary.test.tsx
git commit -m "feat(web): count unreachable and unmet cells in the summary

The per-cell marks answer 'where'; a weaver deciding whether to re-thread
a card wants 'how many' without hunting the board for slashes."
```

---

### Task 11: Parity — every paint command reachable from every binding

**Files:**
- Modify: `apps/web/test/board/parity.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 5-8.
- Produces: no source change. This is the test issue #26 item 3 asked for, generalised: the existing parity test compares which commands each binding *dispatches*, not which each binding can *reach*.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/test/board/parity.test.tsx`:

```tsx
describe('paint-mode parity', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().setMode('paint');
  });

  it('paints the same target by drag and by keyboard', async () => {
    const user = userEvent.setup();
    useStore.getState().setBrush(2);

    const { unmount } = render(<Board />);
    await user.pointer([
      { target: cell(0, 1), keys: '[MouseLeft>]' },
      { target: cell(1, 1) },
      { target: cell(2, 1) },
      { keys: '[/MouseLeft]' },
    ]);
    const byPointer = structuredClone(useStore.getState().pattern);
    unmount();

    useStore.getState().reset();
    useStore.getState().setMode('paint');
    render(<Board />);
    await user.click(cell(0, 1));
    await user.keyboard('{Escape}{Shift>}{ArrowDown}{ArrowDown}{/Shift}3{Enter}');
    const byKeyboard = useStore.getState().pattern;

    expect(byKeyboard.target).toEqual(byPointer.target);
    expect(byKeyboard).toEqual(byPointer);
  });

  it('reaches every paint command from every binding', async () => {
    const user = userEvent.setup();
    render(<Board />);

    // paintTarget — keyboard
    await user.click(cell(0, 0));
    await user.keyboard('2{Enter}');
    expect(useStore.getState().pattern.target![0]![0]).toBe(1);

    // clearTarget — keyboard
    await user.keyboard('{Backspace}');
    expect(useStore.getState().pattern.target).toBeUndefined();

    // paintTarget — pointer
    useStore.getState().setBrush(1);
    await user.click(cell(0, 0));
    expect(useStore.getState().pattern.target![0]![0]).toBe(1);

    // clearTarget — pointer (erase brush)
    useStore.getState().setBrush(null);
    await user.click(cell(0, 0));
    expect(useStore.getState().pattern.target).toBeUndefined();

    // solveTarget — keyboard chord
    useStore.getState().setBrush(1);
    await user.click(cell(1, 0));
    await user.keyboard('{Enter}');
    const beforeSolve = structuredClone(useStore.getState().pattern.picks);
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(useStore.getState().pattern.picks).not.toEqual(beforeSolve);
  });
});
```

The pointer path uses the erase brush where the keyboard uses `Backspace`, because that is the pointer's equivalent — the point of the assertion is that the *command* is reachable from both, not that the gesture is spelled the same way.

`solveTarget`'s pointer route is the Solve button, which lives in `BrushStrip`, not `Board`; Task 8's `brushStrip.test.tsx` already covers it. Add a comment saying so, so a later reader does not think it was forgotten:

```tsx
    // solveTarget's pointer route is the Solve button in BrushStrip, covered
    // by test/paint/brushStrip.test.tsx — it is chrome, not a board gesture.
```

- [ ] **Step 2: Run the test to verify it fails, then passes**

Run: `pnpm --filter @weavesmith/web exec vitest run test/board/parity.test.tsx`
Expected: PASS if Tasks 5-8 are correct. **If it fails, the bug is in the implementation, not the test** — fix the source, never the assertion. If it passes first time, confirm the test is real by temporarily commenting out the `Backspace` case in `useKeyboardBinding.ts`, re-running (expect FAIL), then restoring it.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/board/parity.test.tsx
git commit -m "test(web): assert paint commands are reachable from every binding

The old parity test compared which commands each binding dispatches, not
which it can reach at all — which is how setHole ended up keyboard-only
without the suite noticing (see issue #26 item 3)."
```

---

### Task 12: The target survives the round trip, and the README says the feature exists

**Files:**
- Test: `apps/web/test/io/target.test.ts`
- Modify: `README.md:83-95` ("What v1 does")

**Interfaces:**
- Consumes: everything above.
- Produces: nothing new. This task proves the persistence promise the spec makes and closes the loop on the issue.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { decodePattern, encodePattern } from '../../src/io/share.js';
import { autosave, restore, clearAutosave } from '../../src/io/storage.js';
import { useStore } from '../../src/state/store.js';

describe('target persistence', () => {
  beforeEach(() => {
    useStore.getState().reset();
    clearAutosave();
  });

  it('survives a share-link round trip', () => {
    const { apply } = useStore.getState();
    apply((draft) => {
      draft.target = draft.picks.map(() => draft.cards.map(() => null));
      draft.target[0]![0] = 1;
    }, 'test');
    const { pattern } = useStore.getState();

    const back = decodePattern(encodePattern(pattern));

    expect(back.target).toBeDefined();
    // gcPalette may renumber, so compare the colour, not the index.
    const wanted = back.palette[back.target![0]![0]!];
    expect(wanted).toBe(pattern.palette[1]);
  });

  it('survives autosave and restore', () => {
    const { apply } = useStore.getState();
    apply((draft) => {
      draft.target = draft.picks.map(() => draft.cards.map(() => null));
      draft.target[1]![2] = 0;
    }, 'test');

    autosave(useStore.getState().pattern);

    expect(restore()!.target![1]![2]).toBe(0);
  });
});
```

Check `apps/web/src/io/share.ts` for the actual exported names before running — if they are not `encodePattern`/`decodePattern`, use whatever it exports.

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @weavesmith/web exec vitest run test/io/target.test.ts`
Expected: PASS if Tasks 1-2 are correct. If the share test fails with a validation error, the bug is in `validate` or `gcPalette` — fix core, not the test.

- [ ] **Step 3: Update the README**

In `README.md`, under "What v1 does", after the **Simulate** bullet:

```markdown
- **Solve backwards.** Paint the band you want and get the turn sequence that
  produces it — with the cells no turn sequence can reach marked honestly
  rather than quietly approximated.
```

- [ ] **Step 4: Run everything**

Run: `pnpm test && pnpm typecheck`
Expected: PASS, clean. Do not claim completion until both have actually run and passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/io/target.test.ts README.md
git commit -m "test(web): prove the target survives sharing and autosave

The spec's reason for putting the target on Pattern rather than in the
store was that a weaver can send both the band they wanted and the cells
wool cannot do. Untested, that is just an intention."
```

---

## Verification

After Task 12, confirm by hand in the browser (`pnpm --filter @weavesmith/web dev`), because none of the above has been seen on a real screen:

1. Switch to Paint, pick a colour, drag a run down one card. The cells take the colour flat.
2. Press Solve. The band changes; the report line names what it could not reach.
3. Paint a colour that card does not carry, Solve, and check the slash, the desaturated note and the corner pip are all legible — in both light and dark themes.
4. Switch to Design. The marks are still there; the band reads normally.
5. Switch to Weave. No marks.
6. Reload the page. The painting is still there.
7. Copy a share link, open it in a private window. The painting travels.
