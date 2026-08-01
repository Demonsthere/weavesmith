# WeaveSmith Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the WeaveSmith browser app — a fretboard-style board for designing threaded-in tablet weaving patterns, with a printable turning chart, an at-loom tracker, JSON import/export, and share links. Static, no backend.

**Architecture:** A thin view over `@weavesmith/core`. All weaving logic lives in core; the app owns a single `Pattern` in a store, a selection, and a command set. Pointer, keyboard and touch are three bindings onto the same commands — never three code paths. The board is one component that transposes between orientations by changing grid placement, not by branching into two layouts.

**Tech Stack:** React 19, Vite 6, TypeScript 5.x, Zustand 5, fflate, vite-plugin-pwa, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-01-weavesmith-design.md`
**Prototype:** `docs/mockups/board.html` — a working single-file version of the board. Read it before Task 4; it is the reference for layout, colour and interaction feel, and it already solves the grid-placement problem.

**Depends on:** `docs/superpowers/plans/2026-08-01-weavesmith-core.md` must be complete.

## Global Constraints

- **Node ≥ 22, pnpm ≥ 9.** App lives at `apps/web` in the existing workspace.
- **All weaving logic comes from `@weavesmith/core`.** If the app needs to know how a card rotates, that is a missing core function, not a helper in a component.
- **No backend, no accounts, no network calls at runtime.** The built app is static files.
- **Hash routing only** (`#/board`, `#/chart`) — GitHub Pages serves no SPA rewrites.
- **Every command is reachable by keyboard.** No pointer-only capability. This is tested, not assumed.
- **Board DOM is row-major**: one element per pick containing its cells, `display: contents` on the wrapper, orientation decided by grid placement. Column-major draws identically and is wrong — it transposes the band for screen readers.
- **Card identity colour never appears on a note face.** Note faces are thread colours.
- **Dark and light themes are both supported**, driven by tokens: `prefers-color-scheme` plus a `data-theme` override that wins in both directions.
- **Cell size floor is 28px.** Shrink to fit down to that, then scroll.
- **Cards per band: 4–40.**

## What the engine turned out to be, that this plan predates

`@weavesmith/core` is built and merged (314 tests). Three things differ from what
this plan assumed when it was written:

- **Rotation parity is a sharper constraint than "two of four colours".** A card
  advances one rotation per pick, so its parity flips every pick. At pick *t* it can
  only be at rotations of parity `(start + t + 1) % 2` — so not only are just two of
  its four holes reachable, *which* two alternates pick by pick. Everything that
  reasons about reachability depends on this: `setHole` refusals, the hover preview,
  and any test that asks for "a different colour". Asking for an opposite-parity
  colour is asking for something no turn sequence can produce, at any point in the
  band. Two plan defects in the engine came from missing this.
- **`gcPalette` throws `PatternError`** when a pattern's palette or colour indices
  are corrupt, rather than silently producing a broken palette. The share path calls
  it, so the share path must catch it.
- **`targetOf(grid: Cell[][]): TargetGrid`** is exported. Use it instead of
  hand-writing `simulate(p).map(r => r.map(c => c.color))` — that duplication is
  exactly why it exists.

---

## File Structure

```
apps/web/
  package.json, vite.config.ts, tsconfig.json, index.html
  src/
    main.tsx                      mount, theme boot
    App.tsx                       hash routing between Board and Chart
    state/
      store.ts                    zustand: pattern, selection, undo stack
      commands.ts                 pure: toggleTurn, setTurn, setHole, threading, cards
      selection.ts                Selection type + rect maths
    board/
      Board.tsx                   the grid; orientation is a prop
      Cell.tsx                    one woven cell
      CardChip.tsx                the card header / tuning peg
      usePointerBinding.ts        click, drag, shift-click, hover preview
      useKeyboardBinding.ts       arrows, Space, F/B, 1-4, S/Z, E, undo
      identity.ts                 identity colour + landmark rules
    editor/
      CardEditor.tsx              dialog: threading + hole colours
      palette.ts                  wool presets, colour assignment
    weave/
      WeaveBar.tsx                at-loom controls
    chart/
      Chart.tsx                   printable turning chart + summary
    io/
      storage.ts                  localStorage autosave + named saves
      share.ts                    deflate/inflate to URL hash
      exportImage.ts              band as SVG and PNG
    styles/
      tokens.css                  colour, type, spacing tokens; both themes
      board.css                   grid, cells, orientation
  test/                           mirrors src
```

Split by responsibility, not layer: the pointer binding lives next to the board it drives, not in a global `hooks/` bucket.

---

## Task 1: App scaffold

**Files:**
- Create: `apps/web/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- Create: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles/tokens.css`
- Test: `apps/web/test/smoke.test.tsx`

**Interfaces:**
- Consumes: `@weavesmith/core` (workspace dependency).
- Produces: a running dev server and a passing test harness.

- [ ] **Step 1: Create the package**

`apps/web/package.json`:

```json
{
  "name": "@weavesmith/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc -b --noEmit"
  },
  "dependencies": {
    "@weavesmith/core": "workspace:*",
    "fflate": "^0.8.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "vite": "^6.0.0"
  }
}
```

`apps/web/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',            // relative paths: works on GitHub Pages under /weavesmith/
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
```

`apps/web/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Write the failing test**

`apps/web/test/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App.js';

describe('App', () => {
  it('renders the board by default', () => {
    render(<App />);
    expect(screen.getByRole('grid', { name: /weaving board/i })).toBeInTheDocument();
  });

  it('names itself', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toHaveTextContent(/weavesmith/i);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm install && pnpm --filter @weavesmith/web test`
Expected: FAIL — cannot resolve `../src/App.js`.

- [ ] **Step 4: Write the minimum app**

`apps/web/src/App.tsx`:

```tsx
export function App() {
  return (
    <>
      <header role="banner">
        <h1>Weave<em>Smith</em></h1>
      </header>
      <main>
        <div role="grid" aria-label="Weaving board" />
      </main>
    </>
  );
}
```

`apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles/tokens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WeaveSmith</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write the design tokens**

`apps/web/src/styles/tokens.css`. Copy the token block from `docs/mockups/board.html` verbatim — the dyed-wool palette, both themes, and the type stack. It is already correct; retyping it invites drift.

The structure that matters:

```css
:root { /* dark by default */ }
@media (prefers-color-scheme: light) { :root { /* light overrides */ } }
:root[data-theme="dark"]  { /* must beat the media query */ }
:root[data-theme="light"] { /* must beat the media query */ }
```

- [ ] **Step 6: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/web test`
Expected: PASS, 2 tests.

Then run `pnpm --filter @weavesmith/web dev` and confirm the page loads.

- [ ] **Step 7: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold the app"
```

---

## Task 2: Pattern store and selection

**Files:**
- Create: `apps/web/src/state/selection.ts`, `apps/web/src/state/store.ts`
- Test: `apps/web/test/state/store.test.ts`

**Interfaces:**
- Consumes: `Pattern`, `Turn`, `Card` from `@weavesmith/core`.
- Produces:
  - `interface Selection { focus: CellRef; anchor: CellRef }`, `interface CellRef { pick: number; card: number }`
  - `selectionRect(s: Selection): { t0: number; t1: number; c0: number; c1: number }`
  - `cellsIn(rect): CellRef[]`
  - `useStore` with state `{ pattern, selection, orientation, render, mode, currentPick }` and actions `{ apply, undo, redo, setSelection, moveFocus, setOrientation, setRender, setMode, setCurrentPick }`
  - `apply(mutator: (draft: Pattern) => void, label: string): void` — the single write path; pushes undo.

- [ ] **Step 1: Write the failing test**

`apps/web/test/state/store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { cellsIn, selectionRect } from '../../src/state/selection.js';
import { useStore } from '../../src/state/store.js';

describe('selectionRect', () => {
  it('normalises a selection dragged upward and leftward', () => {
    const rect = selectionRect({ focus: { pick: 2, card: 1 }, anchor: { pick: 7, card: 5 } });
    expect(rect).toEqual({ t0: 2, t1: 7, c0: 1, c1: 5 });
  });

  it('is a single cell when focus and anchor coincide', () => {
    const rect = selectionRect({ focus: { pick: 3, card: 3 }, anchor: { pick: 3, card: 3 } });
    expect(cellsIn(rect)).toEqual([{ pick: 3, card: 3 }]);
  });

  it('enumerates every cell in the rectangle', () => {
    const rect = selectionRect({ focus: { pick: 0, card: 0 }, anchor: { pick: 1, card: 1 } });
    expect(cellsIn(rect)).toHaveLength(4);
  });
});

describe('store', () => {
  beforeEach(() => useStore.getState().reset());

  it('starts with a valid default band', () => {
    const { pattern } = useStore.getState();
    expect(pattern.cards.length).toBeGreaterThanOrEqual(4);
    expect(pattern.picks[0]).toHaveLength(pattern.cards.length);
  });

  it('applies a mutation and records it for undo', () => {
    const before = useStore.getState().pattern.picks[0]![0];
    useStore.getState().apply((draft) => {
      draft.picks[0]![0] = (before === 1 ? -1 : 1);
    }, 'flip');
    expect(useStore.getState().pattern.picks[0]![0]).not.toBe(before);

    useStore.getState().undo();
    expect(useStore.getState().pattern.picks[0]![0]).toBe(before);
  });

  it('redoes what it undid', () => {
    useStore.getState().apply((draft) => { draft.meta.name = 'changed'; }, 'rename');
    useStore.getState().undo();
    useStore.getState().redo();
    expect(useStore.getState().pattern.meta.name).toBe('changed');
  });

  it('drops the redo stack once a new change is applied', () => {
    useStore.getState().apply((draft) => { draft.meta.name = 'first'; }, 'a');
    useStore.getState().undo();
    useStore.getState().apply((draft) => { draft.meta.name = 'second'; }, 'b');
    useStore.getState().redo();
    expect(useStore.getState().pattern.meta.name).toBe('second');
  });

  it('never mutates the previous pattern object', () => {
    const before = useStore.getState().pattern;
    useStore.getState().apply((draft) => { draft.meta.name = 'new'; }, 'rename');
    expect(before.meta.name).not.toBe('new');
  });

  it('clamps focus within the band', () => {
    useStore.getState().moveFocus(999, 999, false);
    const { pattern, selection } = useStore.getState();
    expect(selection.focus.pick).toBe(pattern.picks.length - 1);
    expect(selection.focus.card).toBe(pattern.cards.length - 1);
  });

  it('collapses the anchor onto the focus when not extending', () => {
    useStore.getState().moveFocus(2, 1, false);
    const { selection } = useStore.getState();
    expect(selection.anchor).toEqual(selection.focus);
  });

  it('leaves the anchor put when extending', () => {
    const start = useStore.getState().selection.anchor;
    useStore.getState().moveFocus(2, 1, true);
    expect(useStore.getState().selection.anchor).toEqual(start);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @weavesmith/web test store`
Expected: FAIL — module not found.

- [ ] **Step 3: Write selection**

`apps/web/src/state/selection.ts`:

```ts
export interface CellRef {
  pick: number;
  card: number;
}

export interface Selection {
  focus: CellRef;
  anchor: CellRef;
}

export interface SelectionRect {
  t0: number;
  t1: number;
  c0: number;
  c1: number;
}

export function selectionRect(selection: Selection): SelectionRect {
  const { focus, anchor } = selection;
  return {
    t0: Math.min(focus.pick, anchor.pick),
    t1: Math.max(focus.pick, anchor.pick),
    c0: Math.min(focus.card, anchor.card),
    c1: Math.max(focus.card, anchor.card),
  };
}

export function cellsIn(rect: SelectionRect): CellRef[] {
  const cells: CellRef[] = [];
  for (let pick = rect.t0; pick <= rect.t1; pick++) {
    for (let card = rect.c0; card <= rect.c1; card++) cells.push({ pick, card });
  }
  return cells;
}

export function rectContains(rect: SelectionRect, pick: number, card: number): boolean {
  return pick >= rect.t0 && pick <= rect.t1 && card >= rect.c0 && card <= rect.c1;
}
```

- [ ] **Step 4: Write the store**

`apps/web/src/state/store.ts`:

```ts
import { create } from 'zustand';
import type { Pattern } from '@weavesmith/core';
import type { Selection } from './selection.js';
import { defaultPattern } from './defaultPattern.js';

export type Orientation = 'vertical' | 'horizontal';
export type RenderMode = 'woven' | 'dots';
export type ScreenMode = 'design' | 'weave';

const UNDO_LIMIT = 100;

interface StoreState {
  pattern: Pattern;
  selection: Selection;
  orientation: Orientation;
  render: RenderMode;
  mode: ScreenMode;
  currentPick: number;
  past: Pattern[];
  future: Pattern[];

  apply: (mutate: (draft: Pattern) => void, label: string) => void;
  undo: () => void;
  redo: () => void;
  setSelection: (selection: Selection) => void;
  moveFocus: (dPick: number, dCard: number, extend: boolean) => void;
  setOrientation: (orientation: Orientation) => void;
  setRender: (render: RenderMode) => void;
  setMode: (mode: ScreenMode) => void;
  setCurrentPick: (pick: number) => void;
  load: (pattern: Pattern) => void;
  reset: () => void;
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(max, 0));

export const useStore = create<StoreState>((set, get) => ({
  pattern: defaultPattern(),
  selection: { focus: { pick: 0, card: 0 }, anchor: { pick: 0, card: 0 } },
  orientation: 'vertical',
  render: 'woven',
  mode: 'design',
  currentPick: 0,
  past: [],
  future: [],

  // The single write path. Everything that changes the pattern goes through
  // here, so undo never misses a change.
  apply: (mutate) => {
    const { pattern, past } = get();
    const draft = structuredClone(pattern);
    mutate(draft);
    set({
      pattern: draft,
      past: [...past, pattern].slice(-UNDO_LIMIT),
      future: [],
    });
  },

  undo: () => {
    const { past, pattern, future } = get();
    const previous = past.at(-1);
    if (!previous) return;
    set({ pattern: previous, past: past.slice(0, -1), future: [pattern, ...future] });
  },

  redo: () => {
    const { future, pattern, past } = get();
    const next = future[0];
    if (!next) return;
    set({ pattern: next, past: [...past, pattern], future: future.slice(1) });
  },

  setSelection: (selection) => set({ selection }),

  moveFocus: (dPick, dCard, extend) => {
    const { pattern, selection } = get();
    const focus = {
      pick: clamp(selection.focus.pick + dPick, pattern.picks.length - 1),
      card: clamp(selection.focus.card + dCard, pattern.cards.length - 1),
    };
    set({ selection: { focus, anchor: extend ? selection.anchor : focus } });
  },

  setOrientation: (orientation) => set({ orientation }),
  setRender: (render) => set({ render }),
  setMode: (mode) => set({ mode }),
  setCurrentPick: (pick) =>
    set({ currentPick: clamp(pick, get().pattern.picks.length - 1) }),

  load: (pattern) =>
    set({
      pattern,
      past: [],
      future: [],
      selection: { focus: { pick: 0, card: 0 }, anchor: { pick: 0, card: 0 } },
      currentPick: 0,
    }),

  reset: () => get().load(defaultPattern()),
}));
```

`apps/web/src/state/defaultPattern.ts` — the chevron from the prototype, so a first-time visitor sees a real band:

```ts
import type { Card, Pattern, Threading, Turn } from '@weavesmith/core';

export const WOOL = ['#4B3826', '#B4402C', '#2F5F8F', '#D8A62B', '#EADCC0'];
const WALNUT = 0, MADDER = 1, WOAD = 2, WELD = 3, CREAM = 4;

const card = (colors: [number, number, number, number], threading: Threading): Card => ({
  colors,
  threading,
  start: 0,
});

export function defaultPattern(): Pattern {
  const cards: Card[] = [
    card([WALNUT, WALNUT, WALNUT, WALNUT], 'S'),
    card([CREAM, CREAM, MADDER, MADDER], 'S'),
    card([CREAM, CREAM, MADDER, MADDER], 'S'),
    card([CREAM, WELD, WOAD, MADDER], 'S'),
    card([CREAM, WELD, WOAD, MADDER], 'Z'),
    card([CREAM, CREAM, MADDER, MADDER], 'Z'),
    card([CREAM, CREAM, MADDER, MADDER], 'Z'),
    card([WALNUT, WALNUT, WALNUT, WALNUT], 'Z'),
  ];
  return {
    version: 1,
    meta: { name: 'Chevron' },
    palette: WOOL,
    cards,
    picks: Array.from({ length: 24 }, () => cards.map(() => 1 as Turn)),
  };
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/web test store`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/state apps/web/test/state
git commit -m "feat(web): add pattern store, selection and undo"
```

---

## Task 3: The command set

Pure functions over `(pattern, selection)`. No React, no events. This is what both input bindings call, and testing it once here is what keeps them from drifting.

**Files:**
- Create: `apps/web/src/state/commands.ts`
- Test: `apps/web/test/state/commands.test.ts`

**Interfaces:**
- Consumes: `advance`, `holeAt`, `HOLE_LABELS`, `MIN_CARDS`, `MAX_CARDS` from core; `Selection`, `selectionRect`, `cellsIn` from Task 2.
  Deliberately NOT `solveTurns`: it targets a colour, while `setHole` targets a hole, and cards routinely carry the same colour twice — the solver could satisfy "show hole B" by landing on hole A with the opposite lean.
- Produces:
  - `interface CommandResult { pattern: Pattern; message: string }`
  - `toggleTurn(pattern, selection): CommandResult`
  - `setTurn(pattern, selection, dir: Turn): CommandResult`
  - `setHole(pattern, selection, hole: Hole): CommandResult`
  - `setThreading(pattern, selection, threading: Threading): CommandResult`
  - `addCard(pattern, threading): { result: CommandResult; index: number }`
  - `removeCard(pattern, index): CommandResult`
  - `setHoleColor(pattern, card: number, hole: Hole, hex: string): CommandResult`

- [ ] **Step 1: Write the failing test**

`apps/web/test/state/commands.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { simulate } from '@weavesmith/core';
import { addCard, removeCard, setHole, setHoleColor, setThreading, setTurn, toggleTurn }
  from '../../src/state/commands.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

const cell = (pick: number, card: number) => ({ focus: { pick, card }, anchor: { pick, card } });
const rect = (t0: number, c0: number, t1: number, c1: number) =>
  ({ focus: { pick: t1, card: c1 }, anchor: { pick: t0, card: c0 } });

describe('toggleTurn', () => {
  it('flips one cell', () => {
    const pattern = defaultPattern();
    const before = pattern.picks[3]![2]!;
    const { pattern: after } = toggleTurn(pattern, cell(3, 2));
    expect(after.picks[3]![2]).toBe(-before);
  });

  it('flips every cell in a rectangle', () => {
    const pattern = defaultPattern();
    const { pattern: after } = toggleTurn(pattern, rect(1, 1, 3, 3));
    for (let t = 1; t <= 3; t++) {
      for (let c = 1; c <= 3; c++) expect(after.picks[t]![c]).toBe(-pattern.picks[t]![c]!);
    }
  });

  it('leaves cells outside the selection alone', () => {
    const pattern = defaultPattern();
    const { pattern: after } = toggleTurn(pattern, cell(3, 2));
    expect(after.picks[3]![1]).toBe(pattern.picks[3]![1]);
    expect(after.picks[4]![2]).toBe(pattern.picks[4]![2]);
  });
});

describe('setTurn', () => {
  it('is idempotent', () => {
    const pattern = defaultPattern();
    const once = setTurn(pattern, rect(0, 0, 5, 3), -1).pattern;
    const twice = setTurn(once, rect(0, 0, 5, 3), -1).pattern;
    expect(twice.picks).toEqual(once.picks);
  });

  it('reports how many cells it changed', () => {
    const pattern = defaultPattern();
    const { message } = setTurn(pattern, rect(0, 0, 1, 1), -1);
    expect(message).toMatch(/4 cells/);
  });
});

describe('setHole', () => {
  it('shows the requested hole when it is reachable', () => {
    const pattern = defaultPattern();
    // From start 0, one turn reaches rotation 1 (hole B) or 3 (hole D).
    const { pattern: after } = setHole(pattern, cell(0, 1), 1);
    const band = simulate(after);
    expect(band[0]![1]!.color).toBe(after.cards[1]!.colors[1]);
  });

  it('refuses by name when the hole is unreachable', () => {
    const pattern = defaultPattern();
    // Hole C is two turns away from rotation 0: unreachable on the first pick.
    const { message } = setHole(pattern, cell(0, 1), 2);
    expect(message).toMatch(/unreachable/i);
    expect(message).toMatch(/card 2/);
  });

  it('applies to the reachable cells even when some are refused', () => {
    const pattern = defaultPattern();
    const { pattern: after, message } = setHole(pattern, rect(0, 1, 3, 3), 1);
    expect(after).not.toEqual(pattern);
    expect(message).toMatch(/set to hole B/);
  });
});

describe('setThreading', () => {
  it('sets every selected card', () => {
    const pattern = defaultPattern();
    const { pattern: after } = setThreading(pattern, rect(0, 0, 0, 3), 'Z');
    expect(after.cards.slice(0, 4).every((c) => c.threading === 'Z')).toBe(true);
  });
});

describe('addCard', () => {
  it('lands an S card at the end of the S block', () => {
    const pattern = defaultPattern();
    const { result, index } = addCard(pattern, 'S');
    expect(result.pattern.cards[index]!.threading).toBe('S');
    expect(result.pattern.cards[index - 1]!.threading).toBe('S');
  });

  it('lands a Z card at the start of the Z block', () => {
    const pattern = defaultPattern();
    const { result, index } = addCard(pattern, 'Z');
    expect(result.pattern.cards[index]!.threading).toBe('Z');
    expect(result.pattern.cards[index + 1]!.threading).toBe('Z');
  });

  it('keeps the pick matrix rectangular', () => {
    const { result } = addCard(defaultPattern(), 'S');
    for (const row of result.pattern.picks) {
      expect(row).toHaveLength(result.pattern.cards.length);
    }
  });

  it('inherits colours from its neighbour rather than arriving blank', () => {
    const pattern = defaultPattern();
    const { result, index } = addCard(pattern, 'S');
    expect(result.pattern.cards[index]!.colors).toEqual(pattern.cards[index - 1]!.colors);
  });

  it('refuses past forty cards', () => {
    let pattern = defaultPattern();
    while (pattern.cards.length < 40) pattern = addCard(pattern, 'S').result.pattern;
    const { result } = addCard(pattern, 'S');
    expect(result.pattern.cards).toHaveLength(40);
    expect(result.message).toMatch(/at most 40/);
  });
});

describe('removeCard', () => {
  it('removes the card and its column of turns', () => {
    const pattern = defaultPattern();
    const { pattern: after } = removeCard(pattern, 2);
    expect(after.cards).toHaveLength(pattern.cards.length - 1);
    for (const row of after.picks) expect(row).toHaveLength(after.cards.length);
  });

  it('refuses below four cards', () => {
    let pattern = defaultPattern();
    while (pattern.cards.length > 4) pattern = removeCard(pattern, 1).pattern;
    const { pattern: after, message } = removeCard(pattern, 1);
    expect(after.cards).toHaveLength(4);
    expect(message).toMatch(/at least 4/);
  });
});

describe('setHoleColor', () => {
  it('points the hole at an existing palette entry rather than adding a duplicate', () => {
    const pattern = defaultPattern();
    const hex = pattern.palette[2]!;
    const { pattern: after } = setHoleColor(pattern, 1, 0, hex);
    expect(after.palette).toHaveLength(pattern.palette.length);
    expect(after.cards[1]!.colors[0]).toBe(2);
  });

  it('adds a new palette entry for a colour the band does not have', () => {
    const pattern = defaultPattern();
    const { pattern: after } = setHoleColor(pattern, 1, 0, '#123456');
    expect(after.palette).toContain('#123456');
    expect(after.cards[1]!.colors[0]).toBe(after.palette.indexOf('#123456'));
  });

  it('never recolours another card that shares the entry', () => {
    const pattern = defaultPattern();
    const sharedBefore = pattern.cards[2]!.colors[0];
    const { pattern: after } = setHoleColor(pattern, 1, 0, '#123456');
    expect(after.cards[2]!.colors[0]).toBe(sharedBefore);
    expect(after.palette[sharedBefore!]).toBe(pattern.palette[sharedBefore!]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @weavesmith/web test commands`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the commands**

`apps/web/src/state/commands.ts`:

```ts
import { advance, holeAt, HOLE_LABELS, MAX_CARDS, MIN_CARDS } from '@weavesmith/core';
import type { Card, Hole, Pattern, Rotation, Threading, Turn } from '@weavesmith/core';
import { cellsIn, selectionRect } from './selection.js';
import type { Selection } from './selection.js';

export interface CommandResult {
  pattern: Pattern;
  /** Shown in the live region. Written for a person, not a log. */
  message: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function edit(pattern: Pattern, mutate: (draft: Pattern) => void): Pattern {
  const draft = structuredClone(pattern);
  mutate(draft);
  return draft;
}

export function toggleTurn(pattern: Pattern, selection: Selection): CommandResult {
  const cells = cellsIn(selectionRect(selection));
  const next = edit(pattern, (draft) => {
    for (const { pick, card } of cells) {
      draft.picks[pick]![card] = -draft.picks[pick]![card]! as Turn;
    }
  });
  return { pattern: next, message: `Flipped ${plural(cells.length, 'cell')}` };
}

export function setTurn(pattern: Pattern, selection: Selection, dir: Turn): CommandResult {
  const cells = cellsIn(selectionRect(selection));
  let changed = 0;
  const next = edit(pattern, (draft) => {
    for (const { pick, card } of cells) {
      if (draft.picks[pick]![card] !== dir) {
        draft.picks[pick]![card] = dir;
        changed++;
      }
    }
  });
  return {
    pattern: next,
    message: `Set ${plural(changed, 'cell')} to turn ${dir === 1 ? 'forward' : 'backward'}`,
  };
}

/** Rotation of a card immediately before a pick. */
function rotationBefore(pattern: Pattern, pick: number, card: number): Rotation {
  let rotation = pattern.cards[card]!.start;
  for (let t = 0; t < pick; t++) rotation = advance(rotation, pattern.picks[t]![card]!);
  return rotation;
}

/**
 * Show a specific hole. Only two of four are reachable from any rotation, so
 * this refuses per-cell and names what it refused.
 */
export function setHole(pattern: Pattern, selection: Selection, hole: Hole): CommandResult {
  const cells = cellsIn(selectionRect(selection));
  const refused: string[] = [];
  let applied = 0;

  const next = edit(pattern, (draft) => {
    for (const { pick, card } of cells) {
      const before = rotationBefore(draft, pick, card);
      const threading = draft.cards[card]!.threading;
      const hit = ([1, -1] as Turn[]).find(
        (turn) => holeAt(advance(before, turn), threading) === hole,
      );
      if (hit === undefined) {
        refused.push(`card ${card + 1} pick ${pick + 1}`);
      } else {
        draft.picks[pick]![card] = hit;
        applied++;
      }
    }
  });

  let message = `${plural(applied, 'cell')} set to hole ${HOLE_LABELS[hole]}`;
  if (refused.length > 0) {
    message += `; hole ${HOLE_LABELS[hole]} unreachable on ${refused.length}` +
      ` (${refused.slice(0, 3).join(', ')})`;
  }
  return { pattern: next, message };
}

export function setThreading(
  pattern: Pattern,
  selection: Selection,
  threading: Threading,
): CommandResult {
  const rect = selectionRect(selection);
  let changed = 0;
  const next = edit(pattern, (draft) => {
    for (let card = rect.c0; card <= rect.c1; card++) {
      if (draft.cards[card]!.threading !== threading) {
        draft.cards[card]!.threading = threading;
        changed++;
      }
    }
  });
  return { pattern: next, message: `${plural(changed, 'card')} set to ${threading} threading` };
}

/**
 * The index where a new card of this threading belongs: the S/Z boundary, so
 * each block stays contiguous and the border cards stay at the edges.
 */
function boundary(cards: Card[]): number {
  const firstZ = cards.findIndex((card) => card.threading === 'Z');
  if (firstZ === -1) return cards.length - 1;
  if (firstZ === 0) return 1;
  return firstZ;
}

export function addCard(
  pattern: Pattern,
  threading: Threading,
): { result: CommandResult; index: number } {
  if (pattern.cards.length >= MAX_CARDS) {
    return {
      result: { pattern, message: `A band takes at most ${MAX_CARDS} cards` },
      index: -1,
    };
  }
  const index = boundary(pattern.cards);
  const source = pattern.cards[Math.max(0, index - 1)]!;
  const next = edit(pattern, (draft) => {
    draft.cards.splice(index, 0, {
      colors: [...source.colors] as [number, number, number, number],
      threading,
      start: 0,
    });
    for (const row of draft.picks) row.splice(index, 0, 1);
  });
  return {
    result: { pattern: next, message: `Card ${index + 1} added, threaded ${threading}` },
    index,
  };
}

export function removeCard(pattern: Pattern, index: number): CommandResult {
  if (pattern.cards.length <= MIN_CARDS) {
    return { pattern, message: `A band needs at least ${MIN_CARDS} cards` };
  }
  const next = edit(pattern, (draft) => {
    draft.cards.splice(index, 1);
    for (const row of draft.picks) row.splice(index, 1);
  });
  return { pattern: next, message: `Card ${index + 1} removed` };
}

/**
 * Point a hole at a colour.
 *
 * This re-points the hole at a palette entry, adding one if the colour is new.
 * It never edits an existing entry in place — that would recolour every other
 * card using it.
 */
export function setHoleColor(
  pattern: Pattern,
  card: number,
  hole: Hole,
  hex: string,
): CommandResult {
  const next = edit(pattern, (draft) => {
    let index = draft.palette.indexOf(hex);
    if (index === -1) {
      draft.palette.push(hex);
      index = draft.palette.length - 1;
    }
    draft.cards[card]!.colors[hole] = index;
  });
  return {
    pattern: next,
    message: `Card ${card + 1} hole ${HOLE_LABELS[hole]} set to ${hex}`,
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/web test commands`
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/state/commands.ts apps/web/test/state/commands.test.ts
git commit -m "feat(web): add the editing command set"
```

---

## Task 4: The board

**Files:**
- Create: `apps/web/src/board/identity.ts`, `Cell.tsx`, `CardChip.tsx`, `Board.tsx`
- Create: `apps/web/src/styles/board.css`
- Test: `apps/web/test/board/board.test.tsx`, `apps/web/test/board/identity.test.ts`

**Read first:** `docs/mockups/board.html`. Its `buildBoard` function already solves grid placement for both orientations; port it rather than re-deriving it.

**Interfaces:**
- Consumes: `simulate` from core; store from Task 2.
- Produces:
  - `identityColor(card: Card, index: number, count: number, scheme: 'threading' | 'index'): string`
  - `isLandmark(index: number): boolean`
  - `<Board />` — reads everything from the store, takes no props.

- [ ] **Step 1: Write the failing identity test**

`apps/web/test/board/identity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { identityColor, isLandmark } from '../../src/board/identity.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

describe('identityColor', () => {
  const cards = defaultPattern().cards;

  it('gives every S card the same hue and every Z card another', () => {
    const s = cards.map((c, i) => ({ c, i })).filter(({ c }) => c.threading === 'S');
    const z = cards.map((c, i) => ({ c, i })).filter(({ c }) => c.threading === 'Z');
    const sColors = new Set(s.map(({ c, i }) => identityColor(c, i, cards.length, 'threading')));
    const zColors = new Set(z.map(({ c, i }) => identityColor(c, i, cards.length, 'threading')));
    expect(sColors.size).toBe(1);
    expect(zColors.size).toBe(1);
    expect([...sColors][0]).not.toBe([...zColors][0]);
  });

  it('gives every card a distinct hue under the index scheme', () => {
    const colors = cards.map((c, i) => identityColor(c, i, cards.length, 'index'));
    expect(new Set(colors).size).toBe(cards.length);
  });
});

describe('isLandmark', () => {
  it('marks every fifth card, one-indexed', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(isLandmark))
      .toEqual([false, false, false, false, true, false, true]);
  });
});
```

- [ ] **Step 2: Write identity**

`apps/web/src/board/identity.ts`:

```ts
import type { Card } from '@weavesmith/core';

export type ColorScheme = 'threading' | 'index';

/** Teal and orchid: deliberately outside any plausible wool palette. */
const SZ_HUES = { S: 172, Z: 292 } as const;

/**
 * A card's identity colour, used on its chrome only — string, chip, rail,
 * weave-bar arrow. Never on a note face, where colour means thread.
 *
 * The threading scheme spends hue on information and survives a 40-card band.
 * The index scheme is prettier below about twelve cards and unusable above
 * twenty-four; it is kept as an option, not a default.
 */
export function identityColor(
  card: Card,
  index: number,
  count: number,
  scheme: ColorScheme,
): string {
  if (scheme === 'threading') {
    return `hsl(${SZ_HUES[card.threading]} 58% 60%)`;
  }
  const hue = Math.round((index / Math.max(count, 1)) * 330);
  return `hsl(${hue} 72% 60%)`;
}

/** Every fifth card, echoing the fret inlays on the pick axis. */
export function isLandmark(index: number): boolean {
  return (index + 1) % 5 === 0;
}
```

Lightness is fixed here because the tokens file carries the theme; if the light theme needs different values, read them from CSS custom properties rather than branching in TypeScript.

- [ ] **Step 3: Write the failing board test**

`apps/web/test/board/board.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

describe('Board', () => {
  beforeEach(() => useStore.getState().reset());

  it('renders one row per pick', () => {
    render(<Board />);
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(useStore.getState().pattern.picks.length);
  });

  it('renders one cell per card in each row', () => {
    render(<Board />);
    const cards = useStore.getState().pattern.cards.length;
    for (const row of screen.getAllByRole('row')) {
      expect(within(row).getAllByRole('gridcell')).toHaveLength(cards);
    }
  });

  it('keeps DOM order row-major regardless of orientation', () => {
    // A screen reader must read pick 1 across all cards, then pick 2 - never
    // a whole card down the band. This is why orientation is placement-only.
    render(<Board />);
    const before = screen.getAllByRole('gridcell').map((el) => el.getAttribute('aria-label'));

    useStore.getState().setOrientation('horizontal');
    render(<Board />);
    const after = screen.getAllByRole('gridcell').map((el) => el.getAttribute('aria-label'));

    expect(after.slice(0, before.length)).toEqual(before);
  });

  it('labels each cell with its card, pick and turn', () => {
    render(<Board />);
    expect(screen.getByLabelText('Card 1, pick 1, turning forward')).toBeInTheDocument();
  });

  it('renders a chip per card', () => {
    render(<Board />);
    const cards = useStore.getState().pattern.cards.length;
    expect(screen.getAllByRole('button', { name: /^Card \d+, threaded/ })).toHaveLength(cards);
  });

  it('exposes exactly one tabbable cell', () => {
    render(<Board />);
    const tabbable = screen.getAllByRole('gridcell').filter((el) => el.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Write the board**

`apps/web/src/board/Board.tsx`. The essential structure — one grid, `display: contents` row wrappers, placement by orientation:

```tsx
import { useMemo } from 'react';
import { simulate } from '@weavesmith/core';
import { useStore } from '../state/store.js';
import { rectContains, selectionRect } from '../state/selection.js';
import { identityColor, isLandmark } from './identity.js';
import { Cell } from './Cell.js';
import { CardChip } from './CardChip.js';
import '../styles/board.css';

export function Board() {
  const { pattern, selection, orientation, render, mode, currentPick } = useStore();
  const band = useMemo(() => simulate(pattern), [pattern]);
  const rect = selectionRect(selection);

  const cardCount = pattern.cards.length;
  const pickCount = pattern.picks.length;
  const vertical = orientation === 'vertical';

  const style = vertical
    ? {
        gridTemplateColumns: `var(--gutter) repeat(${cardCount}, var(--cell-w))`,
        gridTemplateRows: `auto repeat(${pickCount}, var(--cell-h)) auto`,
      }
    : {
        gridTemplateColumns: `var(--chip) repeat(${pickCount}, var(--cell-w)) auto`,
        gridTemplateRows: `auto repeat(${cardCount}, var(--cell-h))`,
      };

  return (
    <div className="board-scroll">
      <div
        className={`board ${vertical ? 'v' : 'h'} mode-${render}`}
        role="grid"
        aria-label="Weaving board"
        style={style}
      >
        {pattern.cards.map((card, c) => (
          <CardChip
            key={c}
            card={card}
            index={c}
            count={cardCount}
            pickCount={pickCount}
            vertical={vertical}
            landmark={isLandmark(c)}
            color={identityColor(card, c, cardCount, 'threading')}
          />
        ))}

        {/* Row-major: one group per pick. display:contents keeps the cells as
            grid items while the DOM still reads the band in weaving order. */}
        {pattern.picks.map((_, t) => (
          <div className="row" role="row" key={t}>
            <div
              className={`tick${(t + 1) % 5 === 0 ? ' marked' : ''}`}
              style={vertical
                ? { gridRow: t + 2, gridColumn: 1 }
                : { gridRow: 1, gridColumn: t + 2 }}
            >
              <span>{t + 1}</span>
            </div>
            {pattern.cards.map((_card, c) => (
              <Cell
                key={c}
                pick={t}
                card={c}
                cell={band[t]![c]!}
                hex={pattern.palette[band[t]![c]!.color]!}
                turn={pattern.picks[t]![c]!}
                selected={rectContains(rect, t, c)}
                focused={selection.focus.pick === t && selection.focus.card === c}
                weaveState={
                  mode === 'weave'
                    ? t === currentPick ? 'current' : t < currentPick ? 'past' : 'ahead'
                    : 'none'
                }
                style={vertical
                  ? { gridRow: t + 2, gridColumn: c + 2 }
                  : { gridRow: c + 2, gridColumn: t + 2 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

`apps/web/src/board/Cell.tsx`:

```tsx
import type { CSSProperties } from 'react';
import type { Cell as WovenCell, Turn } from '@weavesmith/core';

interface Props {
  pick: number;
  card: number;
  cell: WovenCell;
  hex: string;
  turn: Turn;
  selected: boolean;
  focused: boolean;
  weaveState: 'none' | 'current' | 'past' | 'ahead';
  style: CSSProperties;
}

export function Cell({ pick, card, cell, hex, turn, selected, focused, weaveState, style }: Props) {
  const classes = [
    'cell',
    cell.lean === '/' ? 'lean-s' : 'lean-z',
    selected ? 'selected' : '',
    focused ? 'focused' : '',
    weaveState === 'none' ? '' : weaveState,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      role="gridcell"
      className={classes}
      style={style}
      tabIndex={focused ? 0 : -1}
      data-pick={pick}
      data-card={card}
      aria-label={`Card ${card + 1}, pick ${pick + 1}, turning ${turn === 1 ? 'forward' : 'backward'}`}
    >
      <span className="note" style={{ background: hex }} />
    </button>
  );
}
```

`apps/web/src/board/CardChip.tsx` — number, S/Z, four hole swatches, identity colour on the border; placement mirrors the Cell logic (`gridRow: 1, gridColumn: index + 2` when vertical, transposed when not), plus the string and rail spans.

`apps/web/src/styles/board.css`: port the `.board`, `.row`, `.cell`, `.note`, `.lean-*`, `.mode-woven`, `.chip`, `.string`, `.rail`, `.tick` rules from `docs/mockups/board.html` unchanged. They are already correct for both orientations, including the `--lean-base` and `--weave-angle` rotation.

- [ ] **Step 5: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/web test board`
Expected: PASS, 8 tests.

- [ ] **Step 6: Check it by eye**

Run `pnpm --filter @weavesmith/web dev`. Confirm against the prototype: chevron visible, woven mode contiguous, orientation toggle transposes without breaking the chevron, cells shrink but never below 28px.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/board apps/web/src/styles/board.css apps/web/test/board
git commit -m "feat(web): render the board in both orientations"
```

---

## Task 5: Pointer binding

**Files:**
- Create: `apps/web/src/board/usePointerBinding.ts`
- Test: `apps/web/test/board/pointer.test.tsx`
- Modify: `apps/web/src/board/Board.tsx`

**Interfaces:**
- Consumes: commands from Task 3, store from Task 2.
- Produces: `usePointerBinding(): { handlers: PointerHandlers; preview: Set<string>; hover: CellRef | null }`

- [ ] **Step 1: Write the failing test**

`apps/web/test/board/pointer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

const cell = (pick: number, card: number) =>
  screen.getByLabelText(new RegExp(`Card ${card + 1}, pick ${pick + 1},`));

describe('pointer binding', () => {
  beforeEach(() => useStore.getState().reset());

  it('flips a cell on click', async () => {
    const user = userEvent.setup();
    render(<Board />);
    const before = useStore.getState().pattern.picks[2]![1];
    await user.click(cell(2, 1));
    expect(useStore.getState().pattern.picks[2]![1]).toBe(-before!);
  });

  it('moves focus to the clicked cell', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(cell(3, 2));
    expect(useStore.getState().selection.focus).toEqual({ pick: 3, card: 2 });
  });

  it('extends the selection on shift-click without changing the band', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(cell(1, 1));
    const after = structuredClone(useStore.getState().pattern);
    await user.keyboard('{Shift>}');
    await user.click(cell(4, 3));
    await user.keyboard('{/Shift}');

    expect(useStore.getState().pattern.picks).toEqual(after.picks);
    expect(useStore.getState().selection).toEqual({
      anchor: { pick: 1, card: 1 },
      focus: { pick: 4, card: 3 },
    });
  });

  it('records one undo entry per drag, not one per cell', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.pointer([
      { target: cell(0, 1), keys: '[MouseLeft>]' },
      { target: cell(3, 1) },
      { keys: '[/MouseLeft]' },
    ]);
    const changed = structuredClone(useStore.getState().pattern.picks);
    useStore.getState().undo();
    expect(useStore.getState().pattern.picks).not.toEqual(changed);
    useStore.getState().undo();
    // Only one drag happened; a second undo must be a no-op.
    expect(useStore.getState().past).toHaveLength(0);
  });

  it('paints one direction across a drag rather than toggling each cell', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.pointer([
      { target: cell(0, 1), keys: '[MouseLeft>]' },
      { target: cell(1, 1) },
      { target: cell(2, 1) },
      { keys: '[/MouseLeft]' },
    ]);
    const column = [0, 1, 2].map((t) => useStore.getState().pattern.picks[t]![1]);
    expect(new Set(column).size).toBe(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @weavesmith/web test pointer`
Expected: FAIL — clicks do nothing.

- [ ] **Step 3: Write the binding**

`apps/web/src/board/usePointerBinding.ts`. Key behaviours, all of which the tests above pin:

- `pointerdown` on a cell: shift held → move focus only, no mutation. Otherwise capture the pointer, record `painting = -turn` for that cell, push **one** undo entry, and `setTurn(painting)` on the single cell.
- `pointermove` while painting: extend `focus` to the cell under the pointer and re-run `setTurn(painting)` over the whole rectangle. Because `setTurn` is idempotent and the undo entry is already pushed, dragging back and forth costs nothing.
- `pointerup`: release capture, clear `painting`, announce the count.
- `pointermove` while not painting, on a fine pointer only: set `hover` and compute the preview.

The preview diff, which belongs here rather than in core because it is a UI affordance:

```ts
import { simulate } from '@weavesmith/core';
import type { Pattern, Turn } from '@weavesmith/core';

/** Which cells below this one would change if its turn flipped. */
export function previewFlip(pattern: Pattern, pick: number, card: number): Set<string> {
  const before = simulate(pattern);
  const hypothetical = structuredClone(pattern);
  hypothetical.picks[pick]![card] = -hypothetical.picks[pick]![card]! as Turn;
  const after = simulate(hypothetical);

  const changed = new Set<string>();
  for (let t = pick; t < pattern.picks.length; t++) {
    const a = before[t]![card]!;
    const b = after[t]![card]!;
    if (a.color !== b.color || a.lean !== b.lean) changed.add(`${t}:${card}`);
  }
  return changed;
}
```

Guard the hover path behind `window.matchMedia('(hover: hover) and (pointer: fine)').matches` so touch devices never pay for it, and skip it entirely in weave mode.

Add the returned handlers to the `<div className="board">` in `Board.tsx`, and pass `preview`/`hover` down so `Cell` can add `willchange` and `ghost` classes.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/web test pointer`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/board apps/web/test/board/pointer.test.tsx
git commit -m "feat(web): add pointer editing with drag painting and hover preview"
```

---

## Task 6: Keyboard binding, accessibility, and input parity

**Files:**
- Create: `apps/web/src/board/useKeyboardBinding.ts`, `apps/web/src/board/LiveRegion.tsx`
- Test: `apps/web/test/board/keyboard.test.tsx`, `apps/web/test/board/parity.test.tsx`
- Modify: `apps/web/src/board/Board.tsx`

**Interfaces:**
- Consumes: commands from Task 3, store from Task 2.
- Produces: `useKeyboardBinding(): (event: React.KeyboardEvent) => void`, `<LiveRegion />`

- [ ] **Step 1: Write the failing keyboard test**

`apps/web/test/board/keyboard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

async function focusBoard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText(/Card 1, pick 1,/));
}

describe('keyboard binding', () => {
  beforeEach(() => useStore.getState().reset());

  it('moves focus with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(useStore.getState().selection.focus).toEqual({ pick: 1, card: 1 });
  });

  // Arrows are spatial: they move the focus in the direction pressed, so they
  // swap axes with the layout. In the horizontal band, cards run downward, so
  // Down moves to the next card. Making Down always mean "next pick" would send
  // the cursor sideways across the screen, which is disorienting and breaks the
  // convention every grid sets.
  it('swaps the arrow axes with orientation so Down moves the way it points', async () => {
    const user = userEvent.setup();
    useStore.getState().setOrientation('horizontal');
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{ArrowDown}');
    expect(useStore.getState().selection.focus.card).toBe(1);
    expect(useStore.getState().selection.focus.pick).toBe(0);
  });

  it('keeps the jump keys semantic — PageDown is five picks in either orientation', async () => {
    const user = userEvent.setup();
    useStore.getState().setOrientation('horizontal');
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{PageDown}');
    expect(useStore.getState().selection.focus.pick).toBe(5);
    expect(useStore.getState().selection.focus.card).toBe(0);
  });

  it('extends the selection with shift and arrows', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
    expect(useStore.getState().selection.anchor).toEqual({ pick: 0, card: 0 });
    expect(useStore.getState().selection.focus).toEqual({ pick: 2, card: 0 });
  });

  it('jumps five picks with PageDown', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{PageDown}');
    expect(useStore.getState().selection.focus.pick).toBe(5);
  });

  it('flips the selection with Space', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    const before = useStore.getState().pattern.picks[0]![0];
    await user.keyboard(' ');
    expect(useStore.getState().pattern.picks[0]![0]).toBe(-before!);
  });

  it('sets direction with F and B, idempotently', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('bb');
    expect(useStore.getState().pattern.picks[0]![0]).toBe(-1);
    await user.keyboard('f');
    expect(useStore.getState().pattern.picks[0]![0]).toBe(1);
  });

  it('collapses the selection with Escape', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}{Escape}');
    const { selection } = useStore.getState();
    expect(selection.anchor).toEqual(selection.focus);
  });

  it('undoes and redoes', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    const before = useStore.getState().pattern.picks[0]![0];
    await user.keyboard(' ');
    await user.keyboard('{Control>}z{/Control}');
    expect(useStore.getState().pattern.picks[0]![0]).toBe(before);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(useStore.getState().pattern.picks[0]![0]).toBe(-before!);
  });

  it('announces refusals in a live region', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('3'); // hole C: two turns away, unreachable
    expect(screen.getByRole('status')).toHaveTextContent(/unreachable/i);
  });
});
```

- [ ] **Step 2: Write the failing parity test**

This is the test that keeps the two bindings honest. `apps/web/test/board/parity.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

const cell = (pick: number, card: number) =>
  screen.getByLabelText(new RegExp(`Card ${card + 1}, pick ${pick + 1},`));

describe('input parity', () => {
  beforeEach(() => useStore.getState().reset());

  it('produces the same pattern by drag and by keyboard', async () => {
    const user = userEvent.setup();

    // Pointer: drag down column 1 from pick 0 to pick 3.
    const { unmount } = render(<Board />);
    await user.pointer([
      { target: cell(0, 1), keys: '[MouseLeft>]' },
      { target: cell(1, 1) },
      { target: cell(2, 1) },
      { target: cell(3, 1) },
      { keys: '[/MouseLeft]' },
    ]);
    const byPointer = structuredClone(useStore.getState().pattern);
    unmount();

    // Keyboard: same span, same resulting direction.
    useStore.getState().reset();
    render(<Board />);
    await user.click(cell(0, 1));
    await user.keyboard('{Escape}{Shift>}{ArrowDown}{ArrowDown}{ArrowDown}{/Shift}');
    await user.keyboard(byPointer.picks[0]![1] === 1 ? 'f' : 'b');
    const byKeyboard = useStore.getState().pattern;

    expect(byKeyboard.picks).toEqual(byPointer.picks);
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `pnpm --filter @weavesmith/web test keyboard parity`
Expected: FAIL — keys do nothing.

- [ ] **Step 4: Write the binding**

`apps/web/src/board/useKeyboardBinding.ts`. The mapping, with orientation-aware arrows:

```ts
const vertical = orientation === 'vertical';

switch (event.key) {
  case 'ArrowUp':    move(vertical ? [-1, 0] : [0, -1]); break;
  case 'ArrowDown':  move(vertical ? [1, 0]  : [0, 1]);  break;
  case 'ArrowLeft':  move(vertical ? [0, -1] : [-1, 0]); break;
  case 'ArrowRight': move(vertical ? [0, 1]  : [1, 0]);  break;
  case 'PageUp':     move([-5, 0]); break;
  case 'PageDown':   move([5, 0]);  break;
  case 'Home':       move([0, -cardCount]); break;
  case 'End':        move([0, cardCount]);  break;
  case 'Escape':     collapseSelection(); break;
  case ' ':
  case 'Enter':      run(toggleTurn); break;
}
```

Then the letter and digit keys: `f`/`b` → `setTurn(1)`/`setTurn(-1)`; `s`/`z` → `setThreading`; `e` → open the card editor; `1`–`4` → `setHole(n - 1)`. `Ctrl/Cmd+Z` → undo, with shift → redo. Call `event.preventDefault()` on every handled key so Space does not scroll and `/` does not open quick-find.

After each command, write its `message` into the live region and move DOM focus to the focused cell so the roving tabindex stays in step.

`apps/web/src/board/LiveRegion.tsx`:

```tsx
export function LiveRegion({ message }: { message: string }) {
  return (
    <p className="live" role="status" aria-live="polite">
      {message}
    </p>
  );
}
```

- [ ] **Step 5: Run them and watch them pass**

Run: `pnpm --filter @weavesmith/web test`
Expected: PASS, all files.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/board apps/web/test/board
git commit -m "feat(web): add keyboard editing with input parity"
```

---

## Task 7: Card editor

**Files:**
- Create: `apps/web/src/editor/CardEditor.tsx`, `apps/web/src/editor/palette.ts`
- Test: `apps/web/test/editor/cardEditor.test.tsx`
- Modify: `apps/web/src/board/CardChip.tsx`, `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `setHoleColor`, `setThreading`, `removeCard` from Task 3.
- Produces: `<CardEditor cardIndex={number | null} onClose={() => void} />`, `WOOL_PRESETS: string[]`

- [ ] **Step 1: Write the failing test**

`apps/web/test/editor/cardEditor.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CardEditor } from '../../src/editor/CardEditor.js';
import { useStore } from '../../src/state/store.js';

describe('CardEditor', () => {
  beforeEach(() => useStore.getState().reset());

  it('names the card it is editing', () => {
    render(<CardEditor cardIndex={2} onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('Card 3');
  });

  it('shows a row per hole, labelled A to D', () => {
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    for (const label of ['A', 'B', 'C', 'D']) {
      expect(screen.getByRole('button', { name: new RegExp(`hole ${label}`, 'i') }))
        .toBeInTheDocument();
    }
  });

  it('assigns a preset colour to the selected hole', async () => {
    const user = userEvent.setup();
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /hole A/i }));
    await user.click(screen.getByRole('button', { name: /set to #2F5F8F/i }));
    expect(useStore.getState().pattern.cards[1]!.colors[0])
      .toBe(useStore.getState().pattern.palette.indexOf('#2F5F8F'));
  });

  it('does not recolour other cards sharing that palette entry', async () => {
    const user = userEvent.setup();
    const shared = useStore.getState().pattern.cards[2]!.colors[0];
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /hole A/i }));
    await user.click(screen.getByRole('button', { name: /set to #2F5F8F/i }));
    expect(useStore.getState().pattern.cards[2]!.colors[0]).toBe(shared);
  });

  it('flips threading', async () => {
    const user = userEvent.setup();
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Z threaded/i }));
    expect(useStore.getState().pattern.cards[1]!.threading).toBe('Z');
  });

  it('disables delete at the minimum band width', async () => {
    while (useStore.getState().pattern.cards.length > 4) {
      const { pattern, apply } = useStore.getState();
      apply((draft) => {
        draft.cards.splice(1, 1);
        for (const row of draft.picks) row.splice(1, 1);
      }, 'trim');
      if (pattern.cards.length <= 4) break;
    }
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /delete card/i })).toBeDisabled();
  });

  it('closes on Done', async () => {
    const user = userEvent.setup();
    let closed = false;
    render(<CardEditor cardIndex={1} onClose={() => { closed = true; }} />);
    await user.click(screen.getByRole('button', { name: /done/i }));
    expect(closed).toBe(true);
  });
});
```

- [ ] **Step 2: Write the editor**

`apps/web/src/editor/palette.ts`:

```ts
/** The default band palette: dyed wool, which is what historical bands are. */
export const WOOL_PRESETS = [
  '#4B3826', // walnut
  '#B4402C', // madder
  '#2F5F8F', // woad
  '#D8A62B', // weld
  '#EADCC0', // undyed
];

export const WOOL_NAMES: Record<string, string> = {
  '#4B3826': 'walnut',
  '#B4402C': 'madder',
  '#2F5F8F': 'woad',
  '#D8A62B': 'weld',
  '#EADCC0': 'undyed',
};
```

`apps/web/src/editor/CardEditor.tsx`: a `<dialog>` opened with `showModal()`, containing the S/Z toggle, four hole rows (the selected one marked `aria-selected`), the wool presets, the colours already in the band, an `<input type="color">`, and Delete/Done. Every colour button's accessible name must include the hex — `Set hole A to #2F5F8F` — because that is how the tests find them and how a screen reader user distinguishes them.

Wire it up so it opens on: chip click, chip long-press (450ms `pointerdown` without movement), `E` from the keyboard, and automatically after `addCard`.

- [ ] **Step 3: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/web test cardEditor`
Expected: PASS, 7 tests.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/editor apps/web/test/editor apps/web/src/board/CardChip.tsx apps/web/src/App.tsx
git commit -m "feat(web): add the card editor with wool presets"
```

---

## Task 8: Band resizing

**Files:**
- Create: `apps/web/src/board/CardStepper.tsx`
- Test: `apps/web/test/board/stepper.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `addCard`, `removeCard` from Task 3.
- Produces: `<CardStepper onAdded={(index: number) => void} />`

- [ ] **Step 1: Write the failing test**

`apps/web/test/board/stepper.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CardStepper } from '../../src/board/CardStepper.js';
import { useStore } from '../../src/state/store.js';

describe('CardStepper', () => {
  beforeEach(() => useStore.getState().reset());

  it('shows the current card count', () => {
    render(<CardStepper onAdded={() => {}} />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('adds an S card', async () => {
    const user = userEvent.setup();
    render(<CardStepper onAdded={() => {}} />);
    await user.click(screen.getByRole('button', { name: /add an S-threaded card/i }));
    expect(useStore.getState().pattern.cards).toHaveLength(9);
  });

  it('opens the editor for the card it just added', async () => {
    const user = userEvent.setup();
    let opened: number | null = null;
    render(<CardStepper onAdded={(index) => { opened = index; }} />);
    await user.click(screen.getByRole('button', { name: /add a Z-threaded card/i }));
    expect(opened).not.toBeNull();
    expect(useStore.getState().pattern.cards[opened!]!.threading).toBe('Z');
  });

  it('disables removal at four cards', async () => {
    const user = userEvent.setup();
    render(<CardStepper onAdded={() => {}} />);
    const remove = screen.getByRole('button', { name: /remove a card/i });
    for (let i = 0; i < 4; i++) await user.click(remove);
    expect(useStore.getState().pattern.cards).toHaveLength(4);
    expect(remove).toBeDisabled();
  });

  it('disables adding at forty cards', async () => {
    const user = userEvent.setup();
    render(<CardStepper onAdded={() => {}} />);
    const add = screen.getByRole('button', { name: /add an S-threaded card/i });
    for (let i = 0; i < 40; i++) if (!(add as HTMLButtonElement).disabled) await user.click(add);
    expect(useStore.getState().pattern.cards).toHaveLength(40);
    expect(add).toBeDisabled();
  });
});
```

- [ ] **Step 2: Write the stepper**

`− | count cards | +S | +Z`, with `+S` and `+Z` tinted with their threading hues so the button says what it will produce. Each add calls `onAdded(index)` so the parent opens the editor.

- [ ] **Step 3: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/web test stepper`
Expected: PASS, 5 tests.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/board/CardStepper.tsx apps/web/test/board/stepper.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): add band resizing with threading chosen at creation"
```

---

## Task 9: Weave mode

**Files:**
- Create: `apps/web/src/weave/WeaveBar.tsx`, `apps/web/src/weave/position.ts`
- Test: `apps/web/test/weave/weave.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: store `mode`, `currentPick`.
- Produces: `<WeaveBar />`, `savePosition(patternName, pick)`, `loadPosition(patternName): number`

- [ ] **Step 1: Write the failing test**

`apps/web/test/weave/weave.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { WeaveBar } from '../../src/weave/WeaveBar.js';
import { useStore } from '../../src/state/store.js';

describe('WeaveBar', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.getState().reset();
    useStore.getState().setMode('weave');
  });

  it('shows the current pick, one-indexed', () => {
    render(<WeaveBar />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows an arrow per card', () => {
    render(<WeaveBar />);
    const cards = useStore.getState().pattern.cards.length;
    expect(screen.getAllByRole('img', { name: /turn/i })).toHaveLength(cards);
  });

  it('advances and goes back', async () => {
    const user = userEvent.setup();
    render(<WeaveBar />);
    await user.click(screen.getByRole('button', { name: /next pick/i }));
    expect(useStore.getState().currentPick).toBe(1);
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(useStore.getState().currentPick).toBe(0);
  });

  it('stops at the last pick', async () => {
    const user = userEvent.setup();
    const last = useStore.getState().pattern.picks.length - 1;
    useStore.getState().setCurrentPick(last);
    render(<WeaveBar />);
    await user.click(screen.getByRole('button', { name: /next pick/i }));
    expect(useStore.getState().currentPick).toBe(last);
  });

  it('remembers the position across a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<WeaveBar />);
    await user.click(screen.getByRole('button', { name: /next pick/i }));
    await user.click(screen.getByRole('button', { name: /next pick/i }));
    unmount();

    useStore.getState().setCurrentPick(0);
    render(<WeaveBar />);
    expect(useStore.getState().currentPick).toBe(2);
  });

  it('keeps position separate from the pattern, so editing does not lose your place', () => {
    useStore.getState().setCurrentPick(5);
    useStore.getState().apply((draft) => { draft.meta.name = 'edited'; }, 'rename');
    expect(useStore.getState().currentPick).toBe(5);
  });
});
```

- [ ] **Step 2: Write it**

Position is keyed by pattern name in `localStorage` under `weavesmith:position:<name>` — deliberately outside the `Pattern`, so sharing a pattern does not share where someone happens to be weaving.

The board renders weave state already (Task 4 passes `weaveState`); this task adds the bar and the auto-scroll: `cellEls[currentPick][0].scrollIntoView({ block: 'center', inline: 'center' })`.

- [ ] **Step 3: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/web test weave`
Expected: PASS, 6 tests.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/weave apps/web/test/weave apps/web/src/App.tsx
git commit -m "feat(web): add at-loom weave mode with saved position"
```

---

## Task 10: Chart and summary

**Files:**
- Create: `apps/web/src/chart/Chart.tsx`, `apps/web/src/chart/Summary.tsx`, `apps/web/src/styles/print.css`
- Test: `apps/web/test/chart/chart.test.tsx`
- Modify: `apps/web/src/App.tsx` (routing)

**Interfaces:**
- Consumes: `netTwist`, `threadCounts` from core.
- Produces: `<Chart />`, `<Summary />`

- [ ] **Step 1: Write the failing test**

`apps/web/test/chart/chart.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Chart } from '../../src/chart/Chart.js';
import { useStore } from '../../src/state/store.js';

describe('Chart', () => {
  beforeEach(() => useStore.getState().reset());

  it('renders a table row per pick', () => {
    render(<Chart />);
    const table = screen.getByRole('table', { name: /turning chart/i });
    expect(within(table).getAllByRole('row'))
      .toHaveLength(useStore.getState().pattern.picks.length + 1); // + header
  });

  it('shows an arrow per card per pick', () => {
    render(<Chart />);
    const table = screen.getByRole('table', { name: /turning chart/i });
    const firstBodyRow = within(table).getAllByRole('row')[1]!;
    expect(within(firstBodyRow).getAllByRole('cell'))
      .toHaveLength(useStore.getState().pattern.cards.length + 1); // + pick number
  });

  it('states direction as text, not colour alone', () => {
    render(<Chart />);
    expect(screen.getAllByTitle(/forward|backward/i).length).toBeGreaterThan(0);
  });

  it('summarises threads by colour', () => {
    render(<Chart />);
    const summary = screen.getByRole('region', { name: /summary/i });
    expect(summary).toHaveTextContent(/32 warp ends/i);
    expect(summary).toHaveTextContent(/8 cards/i);
  });

  it('warns about accumulated twist', () => {
    render(<Chart />);
    // The default band turns forward 24 times: every card is at +24.
    expect(screen.getByRole('region', { name: /summary/i })).toHaveTextContent(/24/);
  });
});
```

- [ ] **Step 2: Write it**

A real `<table>` — this is tabular data and it prints. Header row of card numbers with S/Z; body rows of pick number then ↑/↓ per card, each with a `title` giving the direction in words.

`print.css`:

```css
@media print {
  :root { color-scheme: light; }
  .topbar, .board-scroll, .weavebar, .hint { display: none; }
  .chart { break-inside: auto; }
  .chart thead { display: table-header-group; } /* repeat on every page */
  .chart tr { break-inside: avoid; }
}
```

Force the light theme for print by setting `data-theme="light"` while the print media query is active — dark backgrounds waste ink and print grey.

- [ ] **Step 3: Run it and watch it pass**

Run: `pnpm --filter @weavesmith/web test chart`
Expected: PASS, 5 tests.

- [ ] **Step 4: Check the print output**

Open `#/chart`, print to PDF, confirm the header repeats across pages and nothing is clipped.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/chart apps/web/src/styles/print.css apps/web/test/chart apps/web/src/App.tsx
git commit -m "feat(web): add printable turning chart and summary"
```

---

## Task 11: Persistence, import, export and share links

**Files:**
- Create: `apps/web/src/io/storage.ts`, `apps/web/src/io/share.ts`, `apps/web/src/io/FileMenu.tsx`
- Test: `apps/web/test/io/storage.test.ts`, `apps/web/test/io/share.test.ts`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `toJSON`, `fromJSON`, `gcPalette`, `PatternError` from core.
- Produces:
  - `autosave(pattern: Pattern): void`, `restore(): Pattern | null`
  - `listSaves(): string[]`, `save(name, pattern)`, `open(name): Pattern`
  - `encodePattern(pattern: Pattern): string`, `decodePattern(hash: string): Pattern`
  - `SHARE_LIMIT = 1800`

- [ ] **Step 1: Write the failing tests**

`apps/web/test/io/share.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PatternError } from '@weavesmith/core';
import { decodePattern, encodePattern, SHARE_LIMIT } from '../../src/io/share.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

describe('share links', () => {
  it('round-trips a pattern through the hash', () => {
    const pattern = defaultPattern();
    expect(decodePattern(encodePattern(pattern))).toEqual(pattern);
  });

  it('produces URL-safe output', () => {
    expect(encodePattern(defaultPattern())).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('compresses well below the raw JSON size', () => {
    const pattern = defaultPattern();
    expect(encodePattern(pattern).length).toBeLessThan(JSON.stringify(pattern).length);
  });

  it('keeps a default band under the share limit', () => {
    expect(encodePattern(defaultPattern()).length).toBeLessThan(SHARE_LIMIT);
  });

  it('rejects a corrupted hash with a PatternError', () => {
    expect(() => decodePattern('not-a-real-hash')).toThrow(PatternError);
  });
});
```

`apps/web/test/io/storage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { autosave, listSaves, open, restore, save } from '../../src/io/storage.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(restore()).toBeNull();
  });

  it('round-trips the autosave', () => {
    const pattern = defaultPattern();
    autosave(pattern);
    expect(restore()).toEqual(pattern);
  });

  it('ignores a corrupted autosave rather than crashing on load', () => {
    localStorage.setItem('weavesmith:autosave', '{ broken');
    expect(restore()).toBeNull();
  });

  it('lists named saves', () => {
    save('Snartemo', defaultPattern());
    save('Birka', defaultPattern());
    expect(listSaves().sort()).toEqual(['Birka', 'Snartemo']);
  });

  it('opens a named save', () => {
    const pattern = defaultPattern();
    save('Chevron', pattern);
    expect(open('Chevron')).toEqual(pattern);
  });
});
```

- [ ] **Step 2: Write share**

`apps/web/src/io/share.ts`:

```ts
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { fromJSON, gcPalette, PatternError, toJSON } from '@weavesmith/core';
import type { Pattern } from '@weavesmith/core';

/** Longest encoded pattern we will put in a URL. Beyond this, offer the file. */
export const SHARE_LIMIT = 1800;

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (text: string): Uint8Array => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

export function encodePattern(pattern: Pattern): string {
  // gcPalette throws PatternError on a corrupt palette or an out-of-range
  // colour index. Let it: a share link for a broken band is worse than a
  // refusal, and the caller has a PatternError path already.
  return toBase64Url(deflateSync(strToU8(toJSON(gcPalette(pattern))), { level: 9 }));
}

export function decodePattern(hash: string): Pattern {
  try {
    return fromJSON(strFromU8(inflateSync(fromBase64Url(hash))));
  } catch (error) {
    if (error instanceof PatternError) throw error;
    throw new PatternError(['this link is damaged or was not made by WeaveSmith']);
  }
}
```

- [ ] **Step 3: Write storage**

Keys: `weavesmith:autosave` and `weavesmith:save:<name>`. `restore()` and `open()` must never throw on damaged data — a corrupted autosave should lose the autosave, not the app. Debounce `autosave` to roughly 500ms so a drag does not write on every pointer move.

- [ ] **Step 4: Write the file menu**

Download as JSON (`toJSON` + a Blob URL), upload (a file input, `fromJSON`, showing `PatternError.problems` as a list if it fails), copy share link, and — when `encodePattern(...).length > SHARE_LIMIT` — say plainly that the pattern is too large for a link and offer the download instead.

**Wrap the share-link call in a `try`/`catch` for `PatternError`.** `encodePattern` runs `gcPalette`, which throws on a corrupt palette or an out-of-range colour index. Uncaught, that takes out the share button instead of telling the user what is wrong with their band — render `PatternError.problems` exactly as the upload path does. Add a test for it.

On boot, `App` reads `location.hash`: `#p=<encoded>` loads a shared pattern, otherwise `restore()`, otherwise `defaultPattern()`.

- [ ] **Step 5: Run and watch them pass**

Run: `pnpm --filter @weavesmith/web test io`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/io apps/web/test/io apps/web/src/App.tsx
git commit -m "feat(web): add persistence, JSON import/export and share links"
```

---

## Task 12: Image export

**Files:**
- Create: `apps/web/src/io/exportImage.ts`
- Test: `apps/web/test/io/exportImage.test.ts`

**Interfaces:**
- Consumes: `simulate` from core.
- Produces: `bandToSVG(pattern: Pattern, options?: { cell?: number }): string`, `svgToPNG(svg: string): Promise<Blob>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { bandToSVG } from '../../src/io/exportImage.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

describe('bandToSVG', () => {
  it('produces a standalone SVG document', () => {
    const svg = bandToSVG(defaultPattern());
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('sizes the canvas to the band', () => {
    const pattern = defaultPattern();
    const svg = bandToSVG(pattern, { cell: 10 });
    expect(svg).toContain(`width="${pattern.cards.length * 10}"`);
    expect(svg).toContain(`height="${pattern.picks.length * 10}"`);
  });

  it('draws one shape per cell', () => {
    const pattern = defaultPattern();
    const svg = bandToSVG(pattern);
    const shapes = svg.match(/<rect|<path/g) ?? [];
    expect(shapes.length).toBeGreaterThanOrEqual(pattern.cards.length * pattern.picks.length);
  });

  it('embeds the palette colours', () => {
    const pattern = defaultPattern();
    const svg = bandToSVG(pattern);
    expect(svg).toContain(pattern.palette[1]!);
  });

  it('escapes the pattern name in the title', () => {
    const pattern = { ...defaultPattern(), meta: { name: 'a <b> & c' } };
    const svg = bandToSVG(pattern);
    expect(svg).toContain('a &lt;b&gt; &amp; c');
    expect(svg).not.toContain('<b>');
  });
});
```

- [ ] **Step 2: Write it**

Build the SVG as a string — no DOM needed, so it is testable in Node. One `<rect>` per cell filled with its palette colour, plus a slanted `<path>` for the stitch lean. Include `<title>` with the pattern name, escaped.

`svgToPNG` draws the SVG into a canvas via a Blob URL and resolves `canvas.toBlob`. It needs a browser, so test it only for its interface, not its output.

- [ ] **Step 3: Run and commit**

Run: `pnpm --filter @weavesmith/web test exportImage`
Expected: PASS, 5 tests.

```bash
git add apps/web/src/io/exportImage.ts apps/web/test/io/exportImage.test.ts
git commit -m "feat(web): export the band as SVG and PNG"
```

---

## Task 13: PWA, deployment and the footer

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `apps/web/public/icon-192.png`, `icon-512.png`
- Modify: `apps/web/vite.config.ts`, `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: everything.
- Produces: a deployed site.

- [ ] **Step 1: Add the PWA plugin**

Install `vite-plugin-pwa` and configure it with `registerType: 'autoUpdate'`, a manifest naming the app WeaveSmith, `display: 'standalone'`, the dyed-wool theme colour `#14110E`, and both icons. Looms are not near wifi; the point is that the app opens offline.

- [ ] **Step 2: Write the footer**

A single line: the project name, a link to the GitHub repo, and a `https://buycoffee.to/...` link. Hosting is free, so this is goodwill, not cost recovery — keep it a link, not a banner.

- [ ] **Step 3: Write the deploy workflow**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm typecheck
      - run: pnpm --filter @weavesmith/core build
      - run: pnpm --filter @weavesmith/web build
      - uses: actions/upload-pages-artifact@v3
        with: { path: apps/web/dist }

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

The tests run before the build, so a red suite cannot deploy.

- [ ] **Step 4: Verify the production build**

Run: `pnpm --filter @weavesmith/web build && pnpm --filter @weavesmith/web preview`

Check: the app loads from a subpath, hash routes work, a share link opens the right pattern, and the service worker registers.

- [ ] **Step 5: Enable Pages and push**

In the repo settings, set Pages source to GitHub Actions. Then:

```bash
git add .github/workflows/deploy.yml apps/web
git commit -m "feat(web): add PWA support and Pages deployment"
git push
```

Confirm the workflow goes green and the site loads.

---

## Definition of done

- `pnpm test` and `pnpm typecheck` pass from the repo root.
- Every command works from pointer and keyboard, proven by `parity.test.tsx`.
- The board's DOM order is row-major in both orientations, proven by `board.test.tsx`.
- A pattern survives: design → JSON download → upload → identical band.
- A share link opens the same pattern in a fresh browser profile.
- The chart prints on paper with its header repeating.
- The site is live on GitHub Pages and works offline after one visit.

---

## Self-review notes

Checked against the spec, section by section:

- Data model, core engine → the core plan.
- Board, identity colour, landmarks, orientation → Tasks 4, 5, 6.
- Editing model and both bindings → Tasks 3, 5, 6, with parity tested.
- Card editor and palette → Task 7; the assign-versus-edit distinction is
  enforced by `setHoleColor` and tested.
- Resizing, boundary insertion → Tasks 3, 8.
- Weave mode → Task 9. Chart, summary, print → Task 10.
- Persistence, share links, JSON → Task 11. Image export → Task 12.
- PWA, hosting, footer → Task 13.
- Accessibility → Task 6, plus the row-major test in Task 4.

Not covered, deliberately, per the spec's non-goals: `.GTT` import, double-face,
twill, brocade, block patterns, and any solver over threading.
