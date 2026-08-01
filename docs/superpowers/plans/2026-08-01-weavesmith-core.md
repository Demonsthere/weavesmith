# WeaveSmith Core Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@weavesmith/core`, a dependency-free TypeScript library that simulates threaded-in tablet weaving, solves turn sequences from a target band, and validates the JSON pattern format.

**Architecture:** Four pure capabilities layered bottom-up — weaving conventions, forward simulation, inverse solving, and analysis — plus validation and serialisation of the on-disk format. No DOM, no dependencies, no I/O. Every function takes data and returns data. The web app in the sibling plan is a view over this package and nothing else.

**Tech Stack:** TypeScript 5.x, Vitest, pnpm workspaces, Node 22+.

**Spec:** `docs/superpowers/specs/2026-08-01-weavesmith-design.md`

## Global Constraints

- **Node ≥ 22, pnpm ≥ 9.** The repo is a pnpm workspace.
- **`@weavesmith/core` has zero runtime dependencies.** Dev dependencies (Vitest, TypeScript) are fine. If a task seems to need a runtime dependency, it is wrong — write the code.
- **No DOM, no `window`, no filesystem access in core.** It must run in Node and a browser unchanged.
- **TypeScript `strict: true`.** No `any` in exported signatures.
- **Cards per band: 4 minimum, 40 maximum.** Enforced by validation, not by convention.
- **A card has exactly 4 holes**, labelled A, B, C, D, indexed 0–3 in that order.
- **`Turn` is `1` (forward) or `-1` (backward).** Never a boolean, never a string.
- **Every weaving convention is pinned by a test before it is written.** If a fixture from a real band disagrees with an implementation, the implementation is wrong. Never edit a fixture to make a test pass.

---

## File Structure

```
package.json                          workspace root, pnpm-workspace.yaml
packages/core/
  package.json                        name @weavesmith/core, zero deps
  tsconfig.json
  vitest.config.ts
  src/
    types.ts                          Card, Pattern, Turn, Threading, Cell + limits
    conventions.ts                    holeAt, leanOf — the two pinned functions
    simulate.ts                       simulate(pattern) -> Cell[][]
    solve.ts                          solveTurns(cards, target, opts)
    analyse.ts                        netTwist, threadCounts
    validate.ts                       validatePattern -> string[]
    serialise.ts                      fromJSON, toJSON, gcPalette
    index.ts                          public barrel
  test/
    conventions.test.ts
    simulate.test.ts
    bands.test.ts                     real published bands
    solve.test.ts
    analyse.test.ts
    validate.test.ts
    serialise.test.ts
    fixtures/
      README.md                       provenance rules
      chevron-8.json                  hand-derived, self-evident
      <published-band>.json           sourced, with provenance
    helpers/
      build.ts                        test pattern builders
```

Each `src` file has one responsibility and one test file. `conventions.ts` is deliberately tiny and separate: it is the only place a weaving-convention decision lives, so when a real band disagrees there is exactly one file to change.

---

## Task 1: Workspace and core package skeleton

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`
- Create: `packages/core/src/types.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Threading`, `Turn`, `Card`, `Pattern`, `Cell`, `MIN_CARDS`, `MAX_CARDS`, `HOLE_COUNT`, `HOLE_LABELS`.

- [ ] **Step 1: Create the workspace root**

`package.json`:

```json
{
  "name": "weavesmith",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 2: Create the core package**

`packages/core/package.json`:

```json
{
  "name": "@weavesmith/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

Note there is no `dependencies` key. There never will be.

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

`packages/core/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
```

- [ ] **Step 3: Write the failing test**

`packages/core/test/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HOLE_COUNT, HOLE_LABELS, MAX_CARDS, MIN_CARDS } from '../src/index.js';

describe('constants', () => {
  it('describes a tablet-weaving card', () => {
    expect(HOLE_COUNT).toBe(4);
    expect(HOLE_LABELS).toEqual(['A', 'B', 'C', 'D']);
  });

  it('bounds a band at 4 to 40 cards', () => {
    expect(MIN_CARDS).toBe(4);
    expect(MAX_CARDS).toBe(40);
  });
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `pnpm install && pnpm --filter @weavesmith/core test`
Expected: FAIL — `Failed to resolve import "../src/index.js"`.

- [ ] **Step 5: Write the types**

`packages/core/src/types.ts`:

```ts
/** Threading direction: which way the warp passes through the card. */
export type Threading = 'S' | 'Z';

/** Turn direction for one card on one pick. */
export type Turn = 1 | -1;

/** Rotation position of a card, 0-3. */
export type Rotation = 0 | 1 | 2 | 3;

/** Hole index, 0-3, corresponding to labels A-D. */
export type Hole = 0 | 1 | 2 | 3;

/** Which way a stitch leans on the face of the band. */
export type Lean = '/' | '\\';

export interface Card {
  /** Palette indices for holes A, B, C, D in that order. */
  colors: [number, number, number, number];
  threading: Threading;
  /** Rotation before the first pick. */
  start: Rotation;
}

export interface PatternMeta {
  name: string;
  author?: string;
  notes?: string;
}

export interface Pattern {
  version: 1;
  meta: PatternMeta;
  /** Hex colours, e.g. "#B4402C". Cards hold indices into this list. */
  palette: string[];
  cards: Card[];
  /** picks[pick][card] — must be rectangular. */
  picks: Turn[][];
}

/** One woven cell: the thread showing, and the way it leans. */
export interface Cell {
  color: number;
  lean: Lean;
}

export const HOLE_COUNT = 4;
export const HOLE_LABELS = ['A', 'B', 'C', 'D'] as const;
export const MIN_CARDS = 4;
export const MAX_CARDS = 40;
```

`packages/core/src/index.ts`:

```ts
export * from './types.js';
```

- [ ] **Step 6: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/core test`
Expected: PASS, 2 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json packages/core pnpm-lock.yaml
git commit -m "feat(core): add workspace and pattern types"
```

---

## Task 2: Weaving conventions

The two functions that decide what tablet weaving *means*. Everything else is arithmetic on top of them.

**Files:**
- Create: `packages/core/src/conventions.ts`
- Test: `packages/core/test/conventions.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Threading`, `Turn`, `Rotation`, `Hole`, `Lean` from Task 1.
- Produces:
  - `holeAt(rotation: Rotation, threading: Threading): Hole`
  - `leanOf(threading: Threading, turn: Turn): Lean`
  - `advance(rotation: Rotation, turn: Turn): Rotation`

- [ ] **Step 1: Write the failing test**

These assertions are *definitional* — they follow from what a rotating card physically does, independently of which hole we call "first". They are safe to assert before any real band is available.

`packages/core/test/conventions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advance, holeAt, leanOf } from '../src/index.js';
import type { Rotation } from '../src/index.js';

const ROTATIONS: Rotation[] = [0, 1, 2, 3];

describe('advance', () => {
  it('wraps forward through four positions', () => {
    expect([0, 1, 2, 3].map((r) => advance(r as Rotation, 1))).toEqual([1, 2, 3, 0]);
  });

  it('wraps backward through four positions', () => {
    expect([0, 1, 2, 3].map((r) => advance(r as Rotation, -1))).toEqual([3, 0, 1, 2]);
  });

  it('returns to the start after four turns in one direction', () => {
    let pos: Rotation = 0;
    for (let i = 0; i < 4; i++) pos = advance(pos, 1);
    expect(pos).toBe(0);
  });
});

describe('holeAt', () => {
  it('shows every hole exactly once per full rotation', () => {
    for (const threading of ['S', 'Z'] as const) {
      const seen = ROTATIONS.map((r) => holeAt(r, threading));
      expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    }
  });

  it('runs Z through the holes in the opposite order to S', () => {
    const s = ROTATIONS.map((r) => holeAt(r, 'S'));
    const z = ROTATIONS.map((r) => holeAt(r, 'Z'));
    expect(z).toEqual([...s].reverse().map((h) => h));
  });

  it('starts both threadings on hole A at rotation 0', () => {
    expect(holeAt(0, 'S')).toBe(0);
    expect(holeAt(0, 'Z')).toBe(0);
  });
});

describe('leanOf', () => {
  it('reverses when the turn reverses', () => {
    for (const threading of ['S', 'Z'] as const) {
      expect(leanOf(threading, 1)).not.toBe(leanOf(threading, -1));
    }
  });

  it('reverses when the threading reverses', () => {
    for (const turn of [1, -1] as const) {
      expect(leanOf('S', turn)).not.toBe(leanOf('Z', turn));
    }
  });

  it('is symmetric: flipping both threading and turn gives the same lean', () => {
    expect(leanOf('S', 1)).toBe(leanOf('Z', -1));
    expect(leanOf('Z', 1)).toBe(leanOf('S', -1));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @weavesmith/core test conventions`
Expected: FAIL — `advance is not exported`.

- [ ] **Step 3: Write the implementation**

`packages/core/src/conventions.ts`:

```ts
import type { Hole, Lean, Rotation, Threading, Turn } from './types.js';
import { HOLE_COUNT } from './types.js';

/**
 * Rotate a card one pick in the given direction.
 */
export function advance(rotation: Rotation, turn: Turn): Rotation {
  return ((rotation + turn + HOLE_COUNT) % HOLE_COUNT) as Rotation;
}

/**
 * Which hole's thread shows on the face of the band at a given rotation.
 *
 * An S-threaded card presents its holes in order as it turns forward; a
 * Z-threaded card is the mirror image and presents them in reverse. Rotation 0
 * shows hole A either way — that is the definition of the start position, not a
 * property of the weave.
 *
 * CONVENTION. Pinned by test/bands.test.ts against published bands. If a real
 * band disagrees, change this function, never the fixture.
 */
export function holeAt(rotation: Rotation, threading: Threading): Hole {
  if (threading === 'S') return rotation;
  return ((HOLE_COUNT - rotation) % HOLE_COUNT) as Hole;
}

/**
 * Which way the stitch leans.
 *
 * Threading direction and turn direction each flip the lean, so flipping both
 * leaves it unchanged.
 *
 * CONVENTION. Same rule as holeAt: fixtures win.
 */
export function leanOf(threading: Threading, turn: Turn): Lean {
  const forwardS = (threading === 'S') === (turn === 1);
  return forwardS ? '/' : '\\';
}
```

Add to `packages/core/src/index.ts`:

```ts
export * from './conventions.js';
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/core test conventions`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/conventions.ts packages/core/src/index.ts packages/core/test/conventions.test.ts
git commit -m "feat(core): add weaving conventions pinned by rotation properties"
```

---

## Task 3: Forward simulation

**Files:**
- Create: `packages/core/src/simulate.ts`
- Create: `packages/core/test/helpers/build.ts`
- Test: `packages/core/test/simulate.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `advance`, `holeAt`, `leanOf` from Task 2; `Pattern`, `Cell` from Task 1.
- Produces:
  - `simulate(pattern: Pattern): Cell[][]` — indexed `[pick][card]`
  - Test helper `buildPattern(options)` used by every later test file.

- [ ] **Step 1: Write the test helper**

`packages/core/test/helpers/build.ts`:

```ts
import type { Card, Pattern, Threading, Turn } from '../../src/index.js';

export const PALETTE = ['#4B3826', '#B4402C', '#2F5F8F', '#D8A62B', '#EADCC0'];
export const WALNUT = 0, MADDER = 1, WOAD = 2, WELD = 3, CREAM = 4;

export function card(
  colors: [number, number, number, number],
  threading: Threading = 'S',
): Card {
  return { colors, threading, start: 0 };
}

/** A band of `cards`, `picks` picks long, every card turning forward. */
export function buildPattern(cards: Card[], picks: number): Pattern {
  return {
    version: 1,
    meta: { name: 'test' },
    palette: PALETTE,
    cards,
    picks: Array.from({ length: picks }, () =>
      cards.map(() => 1 as Turn),
    ),
  };
}
```

- [ ] **Step 2: Write the failing test**

`packages/core/test/simulate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { simulate } from '../src/index.js';
import { buildPattern, card, CREAM, MADDER, WALNUT, WELD, WOAD } from './helpers/build.js';

describe('simulate', () => {
  it('returns a grid of picks by cards', () => {
    const pattern = buildPattern([card([0, 1, 2, 3]), card([0, 1, 2, 3])], 5);
    const grid = simulate(pattern);
    expect(grid).toHaveLength(5);
    expect(grid[0]).toHaveLength(2);
  });

  it('cycles an S card through its holes B, C, D, A when turning forward', () => {
    // start = 0, so the first pick advances to rotation 1 = hole B.
    const pattern = buildPattern([card([WALNUT, MADDER, WOAD, WELD], 'S')], 4);
    const colors = simulate(pattern).map((row) => row[0]!.color);
    expect(colors).toEqual([MADDER, WOAD, WELD, WALNUT]);
  });

  it('cycles a Z card through its holes in the opposite order', () => {
    const pattern = buildPattern([card([WALNUT, MADDER, WOAD, WELD], 'Z')], 4);
    const colors = simulate(pattern).map((row) => row[0]!.color);
    expect(colors).toEqual([WELD, WOAD, MADDER, WALNUT]);
  });

  it('returns to the starting thread every four picks', () => {
    const pattern = buildPattern([card([WALNUT, MADDER, WOAD, WELD])], 8);
    const colors = simulate(pattern).map((row) => row[0]!.color);
    expect(colors.slice(0, 4)).toEqual(colors.slice(4, 8));
  });

  it('leans every stitch the same way when every card turns forward with one threading', () => {
    const pattern = buildPattern([card([0, 1, 2, 3], 'S'), card([0, 1, 2, 3], 'S')], 3);
    const leans = simulate(pattern).flatMap((row) => row.map((c) => c.lean));
    expect(new Set(leans).size).toBe(1);
  });

  it('mirrors the lean between an S card and a Z card on the same pick', () => {
    const pattern = buildPattern([card([0, 1, 2, 3], 'S'), card([0, 1, 2, 3], 'Z')], 1);
    const [row] = simulate(pattern);
    expect(row![0]!.lean).not.toBe(row![1]!.lean);
  });

  it('holds a card still on the band when its turns alternate', () => {
    const pattern = buildPattern([card([WALNUT, MADDER, WOAD, WELD])], 4);
    pattern.picks = [[1], [-1], [1], [-1]];
    const colors = simulate(pattern).map((row) => row[0]!.color);
    // forward to B, back to A, forward to B, back to A
    expect(colors).toEqual([MADDER, WALNUT, MADDER, WALNUT]);
  });

  it('does not mutate the pattern it is given', () => {
    const pattern = buildPattern([card([0, 1, 2, 3])], 3);
    const before = JSON.stringify(pattern);
    simulate(pattern);
    expect(JSON.stringify(pattern)).toBe(before);
  });

  it('respects a non-zero start rotation', () => {
    const pattern = buildPattern([card([WALNUT, MADDER, WOAD, WELD])], 1);
    pattern.cards[0]!.start = 3;
    expect(simulate(pattern)[0]![0]!.color).toBe(WALNUT);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm --filter @weavesmith/core test simulate`
Expected: FAIL — `simulate is not exported`.

- [ ] **Step 4: Write the implementation**

`packages/core/src/simulate.ts`:

```ts
import { advance, holeAt, leanOf } from './conventions.js';
import type { Cell, Pattern, Rotation } from './types.js';

/**
 * Weave the band. Total: every valid pattern produces a grid.
 *
 * Returns cells indexed [pick][card]. Each pick turns every card once, then
 * the weft locks whatever thread is now on the face.
 */
export function simulate(pattern: Pattern): Cell[][] {
  const rotations: Rotation[] = pattern.cards.map((c) => c.start);

  return pattern.picks.map((turnsForPick) => {
    return pattern.cards.map((card, index) => {
      const turn = turnsForPick[index]!;
      const rotation = advance(rotations[index]!, turn);
      rotations[index] = rotation;
      return {
        color: card.colors[holeAt(rotation, card.threading)]!,
        lean: leanOf(card.threading, turn),
      };
    });
  });
}
```

Add to `packages/core/src/index.ts`:

```ts
export * from './simulate.js';
```

- [ ] **Step 5: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/core test simulate`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/simulate.ts packages/core/src/index.ts packages/core/test/simulate.test.ts packages/core/test/helpers/build.ts
git commit -m "feat(core): add forward simulation"
```

---

## Task 4: Pin the conventions against a published band

Tasks 2 and 3 assert properties that are true of *any* consistent convention. This task is the one that decides whether the convention is the same one the weaving world uses.

**Files:**
- Create: `packages/core/test/fixtures/README.md`
- Create: `packages/core/test/fixtures/chevron-8.json`
- Create: `packages/core/test/fixtures/<published-band>.json`
- Test: `packages/core/test/bands.test.ts`

**Interfaces:**
- Consumes: `simulate` from Task 3.
- Produces: no source code. Produces confidence, and possibly a corrected `conventions.ts`.

- [ ] **Step 1: Write the provenance rules**

`packages/core/test/fixtures/README.md`:

```markdown
# Fixtures

Each fixture is a `Pattern` plus the band it is known to produce. They are the
only thing standing between us and a plausible-looking but wrong weave.

Rules:

1. Every fixture records where its data came from, in a `source` field: a URL, a
   book with page number, or "derived" with an explanation.
2. A fixture is never edited to make a test pass. If simulation disagrees with a
   sourced fixture, the bug is in `src/conventions.ts`.
3. A "derived" fixture may only encode something self-evident (a solid-colour
   card produces a solid column). Anything requiring weaving knowledge must be
   sourced.

Sources worth using:

- https://www.guntram.co.za/tabletweaving/patterns/patterns.html — GTT's own
  pattern archive, with rendered charts.
- https://tabletweaving.shelaghlewins.com/ — patterns with woven photographs.
- The TWIST database (Tablet Weavers' International Studies and Techniques).
```

- [ ] **Step 2: Write the derived fixture**

`packages/core/test/fixtures/chevron-8.json`. This one is self-evident: eight cards, the outer two solid walnut, the inner six alternating cream/madder with the first three threaded S and the last three Z. Every card turns forward for 8 picks.

```json
{
  "source": "derived — mirrored S/Z threading must produce a mirrored band",
  "pattern": {
    "version": 1,
    "meta": { "name": "Chevron 8" },
    "palette": ["#4B3826", "#B4402C", "#EADCC0"],
    "cards": [
      { "colors": [0, 0, 0, 0], "threading": "S", "start": 0 },
      { "colors": [2, 2, 1, 1], "threading": "S", "start": 0 },
      { "colors": [2, 2, 1, 1], "threading": "S", "start": 0 },
      { "colors": [2, 2, 1, 1], "threading": "S", "start": 0 },
      { "colors": [2, 2, 1, 1], "threading": "Z", "start": 0 },
      { "colors": [2, 2, 1, 1], "threading": "Z", "start": 0 },
      { "colors": [2, 2, 1, 1], "threading": "Z", "start": 0 },
      { "colors": [0, 0, 0, 0], "threading": "Z", "start": 0 }
    ],
    "picks": [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1]
    ]
  }
}
```

- [ ] **Step 3: Source one published band**

Open the GTT pattern archive at https://www.guntram.co.za/tabletweaving/patterns/patterns.html and pick a **threaded-in** pattern (not double-face, not twill) whose page shows both the card setup and the resulting band. Transcribe it into `packages/core/test/fixtures/<name>.json` using the same shape as `chevron-8.json`, with:

- `source` set to the exact URL and the pattern's name on that page.
- `pattern` as transcribed: hole colours per card, S/Z per card, and the turning sequence.
- `expected`: an array of strings, one per pick, each character a palette index — the band as drawn on the source page.

If the source page gives the band as an image only, read the colours off it. If a cell is ambiguous, leave that pick out rather than guessing: a smaller correct fixture beats a larger invented one.

Example of the `expected` encoding for a 4-card, 3-pick band:

```json
{
  "source": "https://www.guntram.co.za/... — 'Ram's Horn'",
  "pattern": { "...": "as above" },
  "expected": ["0110", "0220", "0110"]
}
```

- [ ] **Step 4: Write the failing test**

`packages/core/test/bands.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { simulate } from '../src/index.js';
import type { Pattern } from '../src/index.js';
import chevron from './fixtures/chevron-8.json' with { type: 'json' };

interface Fixture {
  source: string;
  pattern: Pattern;
  expected?: string[];
}

function bandOf(pattern: Pattern): string[] {
  return simulate(pattern).map((row) => row.map((cell) => cell.color).join(''));
}

describe('chevron-8', () => {
  const fixture = chevron as unknown as Fixture;

  it('mirrors the two halves of the band', () => {
    for (const row of bandOf(fixture.pattern)) {
      expect(row).toBe([...row].reverse().join(''));
    }
  });

  it('holds the border cards at a solid colour', () => {
    for (const row of bandOf(fixture.pattern)) {
      expect(row[0]).toBe('0');
      expect(row[row.length - 1]).toBe('0');
    }
  });

  it('leans the two halves of the band in opposite directions', () => {
    const [first] = simulate(fixture.pattern);
    expect(first![1]!.lean).not.toBe(first![6]!.lean);
  });
});
```

Then add a second `describe` block for the sourced fixture:

```ts
import published from './fixtures/<name>.json' with { type: 'json' };

describe('<name> (published)', () => {
  const fixture = published as unknown as Fixture;

  it('reproduces the band as published', () => {
    expect(bandOf(fixture.pattern)).toEqual(fixture.expected);
  });
});
```

- [ ] **Step 5: Run it**

Run: `pnpm --filter @weavesmith/core test bands`

Two outcomes, and the second is the valuable one:

- **PASS** — the conventions in Task 2 match the weaving world. Move on.
- **FAIL** — the conventions are wrong. Fix `src/conventions.ts`, not the fixture. The likely corrections, in order of probability: `holeAt` for `'Z'` is off by one (`(3 - rotation)` rather than `(4 - rotation) % 4`, or vice versa); `leanOf` is inverted; the first pick should be read *before* advancing rather than after. Change one thing, re-run the whole suite — Task 2 and Task 3 tests must still pass, since they encode properties any correct convention has.

- [ ] **Step 6: Record what happened**

Add a comment at the top of `src/conventions.ts` naming the fixture that pins it:

```ts
// Pinned by test/bands.test.ts against <name>, transcribed from <URL>.
// These two functions define what the library believes tablet weaving is.
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/test/fixtures packages/core/test/bands.test.ts packages/core/src/conventions.ts
git commit -m "test(core): pin weaving conventions against a published band"
```

---

## Task 5: Solve turns from a target band

**Files:**
- Create: `packages/core/src/solve.ts`
- Test: `packages/core/test/solve.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `advance`, `holeAt` from Task 2; `simulate` from Task 3.
- Produces:
  - `type TargetGrid = (number | null)[][]` — `[pick][card]`, `null` meaning "don't care"
  - `interface Unreachable { card: number; pick: number; wanted: number }`
  - `interface SolveResult { picks: Turn[][]; unreachable: Unreachable[] }`
  - `interface SolveOptions { previous?: Turn[][] }`
  - `solveTurns(cards: Card[], target: TargetGrid, options?: SolveOptions): SolveResult`

- [ ] **Step 1: Write the failing test**

`packages/core/test/solve.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { simulate, solveTurns } from '../src/index.js';
import type { Pattern, TargetGrid, Turn } from '../src/index.js';
import { buildPattern, card, MADDER, WALNUT, WELD, WOAD } from './helpers/build.js';

function targetFrom(pattern: Pattern): TargetGrid {
  return simulate(pattern).map((row) => row.map((cell) => cell.color));
}

describe('solveTurns', () => {
  it('reproduces any band that simulation produced', () => {
    const pattern = buildPattern(
      [card([WALNUT, MADDER, WOAD, WELD], 'S'), card([WALNUT, MADDER, WOAD, WELD], 'Z')],
      12,
    );
    pattern.picks = pattern.picks.map((row, t) =>
      row.map((_, c) => ((t + c) % 3 === 0 ? -1 : 1) as Turn),
    );

    const target = targetFrom(pattern);
    const result = solveTurns(pattern.cards, target);

    expect(result.unreachable).toEqual([]);
    expect(simulate({ ...pattern, picks: result.picks })).toEqual(simulate(pattern));
  });

  it('reports the cells it cannot reach instead of approximating', () => {
    // A card holding only two colours can never show a third.
    const cards = [card([WALNUT, WALNUT, MADDER, MADDER], 'S')];
    const target: TargetGrid = [[WOAD], [WALNUT]];

    const result = solveTurns(cards, target);

    expect(result.unreachable).toEqual([{ card: 0, pick: 0, wanted: WOAD }]);
    expect(result.picks).toHaveLength(2);
  });

  it('treats null as "any colour will do"', () => {
    const cards = [card([WALNUT, MADDER, WOAD, WELD], 'S')];
    const result = solveTurns(cards, [[null], [null], [null]]);
    expect(result.unreachable).toEqual([]);
    expect(result.picks).toHaveLength(3);
  });

  it('solves each card independently', () => {
    // Card 1 is satisfiable, card 0 is not. Card 1 must still be solved.
    const cards = [
      card([WALNUT, WALNUT, WALNUT, WALNUT], 'S'),
      card([WALNUT, MADDER, WOAD, WELD], 'S'),
    ];
    const target: TargetGrid = [[MADDER, MADDER]];

    const result = solveTurns(cards, target);

    expect(result.unreachable).toEqual([{ card: 0, pick: 0, wanted: MADDER }]);
    const band = simulate({
      ...buildPattern(cards, 1),
      picks: result.picks,
    });
    expect(band[0]![1]!.color).toBe(MADDER);
  });

  it('honours each card\'s start rotation', () => {
    const cards = [{ ...card([WALNUT, MADDER, WOAD, WELD], 'S'), start: 2 as const }];
    const result = solveTurns(cards, [[WELD]]);
    expect(result.unreachable).toEqual([]);
    expect(result.picks[0]![0]).toBe(1); // rotation 2 -> 3 -> hole D
  });

  it('returns a rectangular pick matrix', () => {
    const cards = [card([0, 1, 2, 3]), card([0, 1, 2, 3]), card([0, 1, 2, 3])];
    const result = solveTurns(cards, [[null, null, null], [null, null, null]]);
    for (const row of result.picks) expect(row).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @weavesmith/core test solve`
Expected: FAIL — `solveTurns is not exported`.

- [ ] **Step 3: Write the implementation**

`packages/core/src/solve.ts`:

```ts
import { advance, holeAt } from './conventions.js';
import { HOLE_COUNT } from './types.js';
import type { Card, Rotation, Turn } from './types.js';

/** Desired colour per cell, [pick][card]. null means "any colour will do". */
export type TargetGrid = (number | null)[][];

export interface Unreachable {
  card: number;
  pick: number;
  wanted: number;
}

export interface SolveResult {
  picks: Turn[][];
  unreachable: Unreachable[];
}

export interface SolveOptions {
  /** Existing turns, used to break ties toward the pattern the user already has. */
  previous?: Turn[][];
}

const TURNS: Turn[] = [1, -1];

/** A mismatch always outweighs any number of tie-break penalties. */
const MISMATCH = 1_000_000;

/**
 * Find the turn sequence that produces `target`, with threading held fixed.
 *
 * Cards do not interact in threaded-in weaving, so this decomposes into one
 * independent problem per card: a shortest path over 4 rotation states by
 * however many picks, two edges out of each state. Exact, and linear in picks.
 */
export function solveTurns(
  cards: Card[],
  target: TargetGrid,
  options: SolveOptions = {},
): SolveResult {
  const pickCount = target.length;
  const picks: Turn[][] = Array.from({ length: pickCount }, () =>
    cards.map(() => 1 as Turn),
  );
  const unreachable: Unreachable[] = [];

  cards.forEach((card, cardIndex) => {
    const solved = solveCard(card, cardIndex, target, options.previous);
    solved.turns.forEach((turn, pick) => {
      picks[pick]![cardIndex] = turn;
    });
    unreachable.push(...solved.unreachable);
  });

  return { picks, unreachable };
}

interface CardSolution {
  turns: Turn[];
  unreachable: Unreachable[];
}

function solveCard(
  card: Card,
  cardIndex: number,
  target: TargetGrid,
  previous?: Turn[][],
): CardSolution {
  const pickCount = target.length;
  if (pickCount === 0) return { turns: [], unreachable: [] };

  // cost[r] = best cost of arriving at rotation r after the current pick.
  let cost: number[] = new Array(HOLE_COUNT).fill(Number.POSITIVE_INFINITY);
  const from: Array<Array<Rotation | null>> = [];
  const via: Array<Array<Turn | null>> = [];

  // Seed from the card's fixed start rotation.
  const seedCost: number[] = new Array(HOLE_COUNT).fill(Number.POSITIVE_INFINITY);
  const seedFrom: Array<Rotation | null> = new Array(HOLE_COUNT).fill(null);
  const seedVia: Array<Turn | null> = new Array(HOLE_COUNT).fill(null);

  for (const turn of TURNS) {
    const next = advance(card.start, turn);
    const c = stepCost(card, cardIndex, 0, next, turn, target, previous);
    if (c < seedCost[next]!) {
      seedCost[next] = c;
      seedFrom[next] = card.start;
      seedVia[next] = turn;
    }
  }
  cost = seedCost;
  from.push(seedFrom);
  via.push(seedVia);

  for (let pick = 1; pick < pickCount; pick++) {
    const nextCost: number[] = new Array(HOLE_COUNT).fill(Number.POSITIVE_INFINITY);
    const nextFrom: Array<Rotation | null> = new Array(HOLE_COUNT).fill(null);
    const nextVia: Array<Turn | null> = new Array(HOLE_COUNT).fill(null);

    for (let r = 0; r < HOLE_COUNT; r++) {
      if (!Number.isFinite(cost[r]!)) continue;
      for (const turn of TURNS) {
        const next = advance(r as Rotation, turn);
        const c = cost[r]! + stepCost(card, cardIndex, pick, next, turn, target, previous);
        if (c < nextCost[next]!) {
          nextCost[next] = c;
          nextFrom[next] = r as Rotation;
          nextVia[next] = turn;
        }
      }
    }
    cost = nextCost;
    from.push(nextFrom);
    via.push(nextVia);
  }

  // Backtrack from the cheapest final rotation.
  let best: Rotation = 0;
  for (let r = 1; r < HOLE_COUNT; r++) {
    if (cost[r]! < cost[best]!) best = r as Rotation;
  }

  const turns: Turn[] = new Array(pickCount);
  let rotation = best;
  for (let pick = pickCount - 1; pick >= 0; pick--) {
    turns[pick] = via[pick]![rotation]!;
    rotation = from[pick]![rotation]!;
  }

  // Report what the winning path could not match.
  const unreachable: Unreachable[] = [];
  let pos: Rotation = card.start;
  for (let pick = 0; pick < pickCount; pick++) {
    pos = advance(pos, turns[pick]!);
    const wanted = target[pick]![cardIndex];
    if (wanted === null || wanted === undefined) continue;
    if (card.colors[holeAt(pos, card.threading)] !== wanted) {
      unreachable.push({ card: cardIndex, pick, wanted });
    }
  }

  return { turns, unreachable };
}

function stepCost(
  card: Card,
  cardIndex: number,
  pick: number,
  rotation: Rotation,
  turn: Turn,
  target: TargetGrid,
  previous?: Turn[][],
): number {
  const wanted = target[pick]?.[cardIndex];
  let cost = 0;
  if (wanted !== null && wanted !== undefined) {
    if (card.colors[holeAt(rotation, card.threading)] !== wanted) cost += MISMATCH;
  }
  if (previous?.[pick]?.[cardIndex] !== undefined && previous[pick]![cardIndex] !== turn) {
    cost += 1;
  }
  return cost;
}
```

Add to `packages/core/src/index.ts`:

```ts
export * from './solve.js';
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/core test solve`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/solve.ts packages/core/src/index.ts packages/core/test/solve.test.ts
git commit -m "feat(core): solve turn sequences from a target band"
```

---

## Task 6: Minimum-change solving

The solver currently returns *a* correct answer. This makes it return the one nearest what the user already had, so a single edit does not reshuffle the whole column.

**Files:**
- Test: `packages/core/test/solve.test.ts` (add cases)
- Modify: `packages/core/src/solve.ts` if the tests fail

**Interfaces:**
- Consumes: `solveTurns`, `SolveOptions` from Task 5.
- Produces: no new exports. Strengthens the guarantee on `SolveOptions.previous`.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/solve.test.ts`:

```ts
describe('solveTurns minimum change', () => {
  it('returns the previous turns unchanged when they already match', () => {
    const pattern = buildPattern([card([WALNUT, MADDER, WOAD, WELD], 'S')], 10);
    pattern.picks = pattern.picks.map((_, t) => [((t % 4 === 0 ? -1 : 1) as Turn)]);
    const target = targetFrom(pattern);

    const result = solveTurns(pattern.cards, target, { previous: pattern.picks });

    expect(result.picks).toEqual(pattern.picks);
  });

  it('changes as few turns as possible when only one cell differs', () => {
    const cards = [card([WALNUT, MADDER, WOAD, WELD], 'S')];
    const pattern = buildPattern(cards, 8);
    const target = targetFrom(pattern);

    // Ask for a different colour at pick 4 only.
    const original = target[4]![0]!;
    const alternatives = [WALNUT, MADDER, WOAD, WELD].filter((c) => c !== original);
    target[4]![0] = alternatives[0]!;

    const result = solveTurns(cards, target, { previous: pattern.picks });

    const changed = result.picks.filter((row, t) => row[0] !== pattern.picks[t]![0]);
    expect(changed.length).toBeGreaterThan(0);
    // Nothing before the edit may move.
    for (let t = 0; t < 4; t++) {
      expect(result.picks[t]![0]).toBe(pattern.picks[t]![0]);
    }
  });

  it('prefers matching the band over matching the previous turns', () => {
    const cards = [card([WALNUT, MADDER, WOAD, WELD], 'S')];
    const previous: Turn[][] = [[1], [1], [1]];
    // Target demands backward turns throughout.
    const target: TargetGrid = [[WELD], [WOAD], [MADDER]];

    const result = solveTurns(cards, target, { previous });

    expect(result.unreachable).toEqual([]);
    expect(result.picks).toEqual([[-1], [-1], [-1]]);
  });
});
```

- [ ] **Step 2: Run and see where you stand**

Run: `pnpm --filter @weavesmith/core test solve`

The tie-break in Task 5 may already satisfy these. If a test fails, the cause is almost certainly one of:

- **Ties broken at the wrong point.** The backtrack picks the lowest-index rotation on equal cost; it should prefer the rotation reached by the previous turn. Fix by comparing `cost[r] < cost[best]` *or* equal cost with `via[last][r]` matching `previous[last][0]`.
- **Penalty swamped.** Confirm `MISMATCH` exceeds the longest plausible band; at 1,000,000 versus one penalty per pick it holds to 1,000,000 picks.

- [ ] **Step 3: Fix if needed, then re-run the whole suite**

Run: `pnpm --filter @weavesmith/core test`
Expected: PASS, all files. The Task 5 tests must not regress.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/solve.ts packages/core/test/solve.test.ts
git commit -m "feat(core): break solver ties toward the existing pattern"
```

---

## Task 7: Validation and serialisation

**Files:**
- Create: `packages/core/src/validate.ts`
- Create: `packages/core/src/serialise.ts`
- Test: `packages/core/test/validate.test.ts`, `packages/core/test/serialise.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Pattern`, `MIN_CARDS`, `MAX_CARDS` from Task 1.
- Produces:
  - `validatePattern(value: unknown): string[]` — empty array means valid
  - `fromJSON(text: string): Pattern` — throws `PatternError` on invalid input
  - `toJSON(pattern: Pattern): string`
  - `class PatternError extends Error { readonly problems: string[] }`

- [ ] **Step 1: Write the failing validation test**

`packages/core/test/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validatePattern } from '../src/index.js';
import { buildPattern, card } from './helpers/build.js';

const valid = () => buildPattern([card([0, 1, 2, 3]), card([0, 1, 2, 3]),
                                  card([0, 1, 2, 3]), card([0, 1, 2, 3])], 4);

describe('validatePattern', () => {
  it('accepts a well-formed pattern', () => {
    expect(validatePattern(valid())).toEqual([]);
  });

  it('rejects anything that is not an object', () => {
    expect(validatePattern(null)).toContain('pattern must be an object');
    expect(validatePattern('nope')).toContain('pattern must be an object');
  });

  it('rejects an unknown version', () => {
    expect(validatePattern({ ...valid(), version: 2 }))
      .toContain('unsupported version 2, expected 1');
  });

  it('rejects a band narrower than four cards', () => {
    const pattern = valid();
    pattern.cards = pattern.cards.slice(0, 3);
    pattern.picks = pattern.picks.map((row) => row.slice(0, 3));
    expect(validatePattern(pattern)).toContain('a band needs at least 4 cards, found 3');
  });

  it('rejects a band wider than forty cards', () => {
    const pattern = valid();
    pattern.cards = Array.from({ length: 41 }, () => card([0, 1, 2, 3]));
    pattern.picks = [Array.from({ length: 41 }, () => 1 as const)];
    expect(validatePattern(pattern)).toContain('a band takes at most 40 cards, found 41');
  });

  it('rejects a ragged pick matrix', () => {
    const pattern = valid();
    pattern.picks[1] = [1, 1];
    expect(validatePattern(pattern))
      .toContain('pick 2 has 2 turns but the band has 4 cards');
  });

  it('rejects a turn that is not 1 or -1', () => {
    const pattern = valid();
    (pattern.picks[0] as number[])[0] = 0;
    expect(validatePattern(pattern))
      .toContain('pick 1, card 1: turn must be 1 or -1, found 0');
  });

  it('rejects a colour index outside the palette', () => {
    const pattern = valid();
    pattern.cards[0]!.colors[2] = 99;
    expect(validatePattern(pattern))
      .toContain('card 1, hole C: colour 99 is not in the palette');
  });

  it('rejects a card without exactly four holes', () => {
    const pattern = valid();
    (pattern.cards[0] as { colors: number[] }).colors = [0, 1];
    expect(validatePattern(pattern)).toContain('card 1 must have 4 holes, found 2');
  });

  it('rejects an unknown threading direction', () => {
    const pattern = valid();
    (pattern.cards[0] as { threading: string }).threading = 'X';
    expect(validatePattern(pattern))
      .toContain('card 1: threading must be S or Z, found "X"');
  });

  it('rejects a start rotation outside 0-3', () => {
    const pattern = valid();
    (pattern.cards[0] as { start: number }).start = 7;
    expect(validatePattern(pattern)).toContain('card 1: start must be 0-3, found 7');
  });

  it('collects every problem rather than stopping at the first', () => {
    const pattern = valid();
    (pattern.cards[0] as { threading: string }).threading = 'X';
    (pattern.cards[1] as { start: number }).start = 9;
    expect(validatePattern(pattern)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @weavesmith/core test validate`
Expected: FAIL — `validatePattern is not exported`.

- [ ] **Step 3: Write the validator**

`packages/core/src/validate.ts`:

```ts
import { HOLE_COUNT, HOLE_LABELS, MAX_CARDS, MIN_CARDS } from './types.js';

/**
 * Check a value against the Pattern format.
 *
 * Returns every problem found, phrased for a person: 1-based indices, the
 * offending value quoted. An empty array means the value is a valid Pattern.
 */
export function validatePattern(value: unknown): string[] {
  const problems: string[] = [];

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['pattern must be an object'];
  }
  const pattern = value as Record<string, unknown>;

  if (pattern.version !== 1) {
    problems.push(`unsupported version ${String(pattern.version)}, expected 1`);
  }

  const palette = Array.isArray(pattern.palette) ? (pattern.palette as unknown[]) : null;
  if (!palette) problems.push('palette must be an array of colours');

  const cards = Array.isArray(pattern.cards) ? (pattern.cards as unknown[]) : null;
  if (!cards) {
    problems.push('cards must be an array');
    return problems;
  }

  if (cards.length < MIN_CARDS) {
    problems.push(`a band needs at least ${MIN_CARDS} cards, found ${cards.length}`);
  }
  if (cards.length > MAX_CARDS) {
    problems.push(`a band takes at most ${MAX_CARDS} cards, found ${cards.length}`);
  }

  cards.forEach((raw, index) => {
    const label = `card ${index + 1}`;
    if (typeof raw !== 'object' || raw === null) {
      problems.push(`${label} must be an object`);
      return;
    }
    const card = raw as Record<string, unknown>;

    const colors = Array.isArray(card.colors) ? (card.colors as unknown[]) : null;
    if (!colors || colors.length !== HOLE_COUNT) {
      problems.push(`${label} must have ${HOLE_COUNT} holes, found ${colors?.length ?? 0}`);
    } else if (palette) {
      colors.forEach((color, hole) => {
        if (typeof color !== 'number' || color < 0 || color >= palette.length) {
          problems.push(
            `${label}, hole ${HOLE_LABELS[hole]}: colour ${String(color)} is not in the palette`,
          );
        }
      });
    }

    if (card.threading !== 'S' && card.threading !== 'Z') {
      problems.push(`${label}: threading must be S or Z, found "${String(card.threading)}"`);
    }
    if (typeof card.start !== 'number' || card.start < 0 || card.start > 3) {
      problems.push(`${label}: start must be 0-3, found ${String(card.start)}`);
    }
  });

  const picks = Array.isArray(pattern.picks) ? (pattern.picks as unknown[]) : null;
  if (!picks) {
    problems.push('picks must be an array');
    return problems;
  }

  picks.forEach((raw, pick) => {
    if (!Array.isArray(raw)) {
      problems.push(`pick ${pick + 1} must be an array of turns`);
      return;
    }
    if (raw.length !== cards.length) {
      problems.push(
        `pick ${pick + 1} has ${raw.length} turns but the band has ${cards.length} cards`,
      );
    }
    raw.forEach((turn, cardIndex) => {
      if (turn !== 1 && turn !== -1) {
        problems.push(
          `pick ${pick + 1}, card ${cardIndex + 1}: turn must be 1 or -1, found ${String(turn)}`,
        );
      }
    });
  });

  return problems;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/core test validate`
Expected: PASS, 12 tests.

- [ ] **Step 5: Write the failing serialisation test**

`packages/core/test/serialise.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fromJSON, PatternError, toJSON } from '../src/index.js';
import { buildPattern, card } from './helpers/build.js';

const valid = () => buildPattern([card([0, 1, 2, 3]), card([0, 1, 2, 3]),
                                  card([0, 1, 2, 3]), card([0, 1, 2, 3])], 4);

describe('toJSON / fromJSON', () => {
  it('round-trips a pattern unchanged', () => {
    const pattern = valid();
    expect(fromJSON(toJSON(pattern))).toEqual(pattern);
  });

  it('writes readable, diffable JSON', () => {
    expect(toJSON(valid())).toContain('\n');
  });

  it('throws PatternError listing every problem', () => {
    const broken = { ...valid(), version: 3 };
    try {
      fromJSON(JSON.stringify(broken));
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PatternError);
      expect((error as PatternError).problems).toContain('unsupported version 3, expected 1');
    }
  });

  it('throws PatternError on text that is not JSON at all', () => {
    expect(() => fromJSON('not json')).toThrow(PatternError);
  });
});
```

- [ ] **Step 6: Write the serialiser**

`packages/core/src/serialise.ts`:

```ts
import type { Pattern } from './types.js';
import { validatePattern } from './validate.js';

export class PatternError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Not a valid pattern:\n- ${problems.join('\n- ')}`);
    this.name = 'PatternError';
    this.problems = problems;
  }
}

/** Serialise a pattern as indented JSON, so saved files diff cleanly. */
export function toJSON(pattern: Pattern): string {
  return JSON.stringify(pattern, null, 2);
}

/** Parse and validate. Throws PatternError with every problem found. */
export function fromJSON(text: string): Pattern {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new PatternError([`not valid JSON: ${(error as Error).message}`]);
  }

  const problems = validatePattern(value);
  if (problems.length > 0) throw new PatternError(problems);

  return value as Pattern;
}
```

Add to `packages/core/src/index.ts`:

```ts
export * from './validate.js';
export * from './serialise.js';
```

- [ ] **Step 7: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/core test`
Expected: PASS, all files.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/validate.ts packages/core/src/serialise.ts packages/core/src/index.ts packages/core/test/validate.test.ts packages/core/test/serialise.test.ts
git commit -m "feat(core): validate and serialise patterns"
```

---

## Task 8: Analysis and palette housekeeping

**Files:**
- Create: `packages/core/src/analyse.ts`
- Test: `packages/core/test/analyse.test.ts`
- Modify: `packages/core/src/serialise.ts`, `packages/core/src/index.ts`, `packages/core/test/serialise.test.ts`

**Interfaces:**
- Consumes: `Pattern` from Task 1.
- Produces:
  - `netTwist(pattern: Pattern): number[]`
  - `interface ThreadCounts { perColor: Record<number, number>; cards: number; warpEnds: number }`
  - `threadCounts(pattern: Pattern): ThreadCounts`
  - `gcPalette(pattern: Pattern): Pattern`

- [ ] **Step 1: Write the failing test**

`packages/core/test/analyse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { gcPalette, netTwist, threadCounts } from '../src/index.js';
import { buildPattern, card, CREAM, MADDER, WALNUT } from './helpers/build.js';
import type { Turn } from '../src/index.js';

describe('netTwist', () => {
  it('counts accumulated turns per card', () => {
    const pattern = buildPattern([card([0, 1, 2, 3]), card([0, 1, 2, 3])], 6);
    pattern.picks = pattern.picks.map(() => [1, -1] as Turn[]);
    expect(netTwist(pattern)).toEqual([6, -6]);
  });

  it('returns zero for a card that turns back as often as forward', () => {
    const pattern = buildPattern([card([0, 1, 2, 3])], 4);
    pattern.picks = [[1], [1], [-1], [-1]];
    expect(netTwist(pattern)).toEqual([0]);
  });

  it('returns a zero per card for a band with no picks', () => {
    const pattern = buildPattern([card([0, 1, 2, 3]), card([0, 1, 2, 3])], 0);
    expect(netTwist(pattern)).toEqual([0, 0]);
  });
});

describe('threadCounts', () => {
  it('counts warp threads by colour across every card', () => {
    const pattern = buildPattern(
      [card([WALNUT, WALNUT, MADDER, MADDER]), card([CREAM, CREAM, CREAM, CREAM])],
      1,
    );
    const counts = threadCounts(pattern);
    expect(counts.perColor[WALNUT]).toBe(2);
    expect(counts.perColor[MADDER]).toBe(2);
    expect(counts.perColor[CREAM]).toBe(4);
    expect(counts.cards).toBe(2);
    expect(counts.warpEnds).toBe(8);
  });

  it('omits colours the band does not use', () => {
    const pattern = buildPattern([card([WALNUT, WALNUT, WALNUT, WALNUT])], 1);
    expect(threadCounts(pattern).perColor).toEqual({ [WALNUT]: 4 });
  });
});

describe('gcPalette', () => {
  it('drops unused colours and renumbers the cards', () => {
    const pattern = buildPattern([card([1, 1, 3, 3])], 2);
    // palette has 5 entries; only indices 1 and 3 are used
    const cleaned = gcPalette(pattern);
    expect(cleaned.palette).toEqual(['#B4402C', '#D8A62B']);
    expect(cleaned.cards[0]!.colors).toEqual([0, 0, 1, 1]);
  });

  it('leaves a pattern that uses everything untouched', () => {
    const pattern = buildPattern([card([0, 1, 2, 3])], 1);
    pattern.palette = pattern.palette.slice(0, 4);
    expect(gcPalette(pattern)).toEqual(pattern);
  });

  it('does not mutate the pattern it is given', () => {
    const pattern = buildPattern([card([1, 1, 3, 3])], 1);
    const before = JSON.stringify(pattern);
    gcPalette(pattern);
    expect(JSON.stringify(pattern)).toBe(before);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @weavesmith/core test analyse`
Expected: FAIL — `netTwist is not exported`.

- [ ] **Step 3: Write the implementation**

`packages/core/src/analyse.ts`:

```ts
import { HOLE_COUNT } from './types.js';
import type { Pattern } from './types.js';

/**
 * Accumulated turns per card. A card at +40 has forty twists of warp above the
 * weaving line and will need unwinding.
 */
export function netTwist(pattern: Pattern): number[] {
  return pattern.cards.map((_, cardIndex) =>
    pattern.picks.reduce((sum, turnsForPick) => sum + turnsForPick[cardIndex]!, 0),
  );
}

export interface ThreadCounts {
  /** Warp threads needed of each palette colour. */
  perColor: Record<number, number>;
  cards: number;
  warpEnds: number;
}

/** What to measure out before warping the loom. */
export function threadCounts(pattern: Pattern): ThreadCounts {
  const perColor: Record<number, number> = {};
  for (const card of pattern.cards) {
    for (const color of card.colors) {
      perColor[color] = (perColor[color] ?? 0) + 1;
    }
  }
  return {
    perColor,
    cards: pattern.cards.length,
    warpEnds: pattern.cards.length * HOLE_COUNT,
  };
}
```

Add `gcPalette` to `packages/core/src/serialise.ts` — it belongs with saving, since that is when it runs:

```ts
/**
 * Drop palette entries no card uses and renumber what remains.
 *
 * Recolouring a band leaves orphaned entries behind; this keeps saved files
 * honest about what the band actually contains.
 */
export function gcPalette(pattern: Pattern): Pattern {
  const used = new Set<number>();
  for (const card of pattern.cards) for (const color of card.colors) used.add(color);

  const kept = [...used].sort((a, b) => a - b);
  const remap = new Map(kept.map((oldIndex, newIndex) => [oldIndex, newIndex]));

  return {
    ...pattern,
    palette: kept.map((index) => pattern.palette[index]!),
    cards: pattern.cards.map((card) => ({
      ...card,
      colors: card.colors.map((c) => remap.get(c)!) as [number, number, number, number],
    })),
  };
}
```

Add to `packages/core/src/index.ts`:

```ts
export * from './analyse.js';
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/core test`
Expected: PASS, all files.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analyse.ts packages/core/src/serialise.ts packages/core/src/index.ts packages/core/test/analyse.test.ts
git commit -m "feat(core): add twist and thread analysis, palette cleanup"
```

---

## Task 9: Round-trip property test, build, and README

The invariant that catches solver bugs no example test will, plus making the package consumable.

**Files:**
- Create: `packages/core/test/roundtrip.test.ts`
- Create: `packages/core/README.md`
- Modify: root `package.json`

**Interfaces:**
- Consumes: everything.
- Produces: a built `packages/core/dist` that `apps/web` can import.

- [ ] **Step 1: Write the property test**

Any band produced by `simulate` is by construction reachable, so `solveTurns` must reproduce it with nothing unreachable. This is the strongest single check on the solver.

`packages/core/test/roundtrip.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { simulate, solveTurns } from '../src/index.js';
import type { Card, Pattern, Threading, Turn } from '../src/index.js';
import { PALETTE } from './helpers/build.js';

/** Deterministic PRNG so a failure is reproducible from its seed. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomPattern(seed: number): Pattern {
  const random = rng(seed);
  const cardCount = 4 + Math.floor(random() * 16);
  const pickCount = 1 + Math.floor(random() * 40);

  const cards: Card[] = Array.from({ length: cardCount }, () => ({
    colors: [0, 1, 2, 3].map(() => Math.floor(random() * PALETTE.length)) as
      [number, number, number, number],
    threading: (random() < 0.5 ? 'S' : 'Z') as Threading,
    start: Math.floor(random() * 4) as 0 | 1 | 2 | 3,
  }));

  return {
    version: 1,
    meta: { name: `seed-${seed}` },
    palette: PALETTE,
    cards,
    picks: Array.from({ length: pickCount }, () =>
      cards.map(() => (random() < 0.5 ? 1 : -1) as Turn),
    ),
  };
}

describe('solve/simulate round trip', () => {
  const seeds = Array.from({ length: 200 }, (_, i) => i + 1);

  it.each(seeds)('reproduces the band for seed %i', (seed) => {
    const pattern = randomPattern(seed);
    const target = simulate(pattern).map((row) => row.map((cell) => cell.color));

    const result = solveTurns(pattern.cards, target, { previous: pattern.picks });

    expect(result.unreachable).toEqual([]);
    expect(simulate({ ...pattern, picks: result.picks })).toEqual(simulate(pattern));
  });

  it('returns exactly the original turns when seeded with them', () => {
    const pattern = randomPattern(42);
    const target = simulate(pattern).map((row) => row.map((cell) => cell.color));
    const result = solveTurns(pattern.cards, target, { previous: pattern.picks });
    expect(result.picks).toEqual(pattern.picks);
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @weavesmith/core test roundtrip`
Expected: PASS, 201 tests.

If any seed fails, do not weaken the test. Print the failing pattern, shrink it by hand (fewer cards, fewer picks) until the smallest failing case is clear, add it as a named case in `solve.test.ts`, then fix `solve.ts`.

Note the second test is stricter than the first: it demands the *identical* turn sequence, not merely an equivalent one. If it fails while the first passes, the tie-break from Task 6 is not firm enough.

- [ ] **Step 3: Verify the build**

Run: `pnpm --filter @weavesmith/core build && ls packages/core/dist`
Expected: `index.js`, `index.d.ts`, and one file per module.

- [ ] **Step 4: Write the README**

`packages/core/README.md`:

````markdown
# @weavesmith/core

Threaded-in tablet weaving: simulation, inverse solving, and the pattern format.
No dependencies, no DOM. Runs in Node and the browser.

## Model

A band is `cards` wide and `picks` long. Each card carries four warp threads
through holes A–D, is threaded S or Z, and turns forward (`1`) or backward
(`-1`) on every pick. The thread that ends up on the face of the band is a
function of those three things and nothing else.

## Use

```ts
import { simulate, solveTurns, fromJSON } from '@weavesmith/core';

const pattern = fromJSON(text);

// Forward: what does this weave into?
const band = simulate(pattern);           // Cell[][], [pick][card]

// Inverse: what turns produce this band, with threading held fixed?
const { picks, unreachable } = solveTurns(
  pattern.cards,
  band.map((row) => row.map((cell) => cell.color)),
  { previous: pattern.picks },            // stay near what the user had
);
```

`solveTurns` is exact, not a search: cards are independent in threaded-in
weaving, so each is a shortest path over four rotation states.

`unreachable` lists cells whose requested colour the card cannot show from its
current rotation. It is never silently approximated.

## Conventions

`holeAt` and `leanOf` in `src/conventions.ts` define what this library believes
tablet weaving is. They are pinned by `test/bands.test.ts` against published
bands. If a real band disagrees with the code, the code is wrong.
````

- [ ] **Step 5: Wire up the root scripts**

Confirm `pnpm test` at the repo root runs the core suite, and `pnpm typecheck` passes:

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/test/roundtrip.test.ts packages/core/README.md package.json
git commit -m "test(core): add solve/simulate round-trip property"
```

---

## Definition of done

- `pnpm test` passes from the repo root.
- `pnpm typecheck` passes with `strict: true`.
- `packages/core` has no `dependencies` key.
- `test/bands.test.ts` contains at least one fixture transcribed from a
  published source, with its URL recorded.
- `packages/core/dist` builds and exports types.

The web app plan (`2026-08-01-weavesmith-web.md`) depends on this package and
should not begin until the above holds.
