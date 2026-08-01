# Implementation status

**Updated:** 2026-08-01

## Where things stand

| | Status | Tests |
|---|---|---|
| `@weavesmith/core` — the weaving engine | **Complete, merged to `main`** | 314 |
| `apps/web` — the app | **Tasks 1–7 of 13** | 127 |

441 tests pass from the repo root. `pnpm test`, `pnpm typecheck` and `pnpm -r build` are all green.

## The engine (done)

Zero runtime dependencies, no DOM, runs in Node and the browser unchanged.

| Module | What it does |
|---|---|
| `conventions.ts` | `holeAt`, `leanOf`, `advance` — the only place a weaving convention is decided |
| `simulate.ts` | pattern → woven band; total over valid patterns |
| `solve.ts` | band → turn sequence; exact per-card Viterbi, plus `targetOf` |
| `validate.ts` | `validatePattern`, never throws for any input |
| `serialise.ts` | `fromJSON`, `toJSON`, `PatternError`, `gcPalette` |
| `analyse.ts` | `netTwist`, `threadCounts` |

The result worth knowing: `holeAt` and `leanOf` were written from first principles and reproduce the **Narrow Oseberg Band** (c. 834 AD, transcribed from Shelagh Lewins' instruction sheet) with no changes. The library's model of tablet weaving is pinned against a real woven artifact, not against reasoning about one. See `packages/core/test/fixtures/`.

## The app (tasks 1–7 of 13)

**Done:**

1. **Scaffold** — React 19 + Vite, `base: './'` for the Pages subpath, dyed-wool design tokens with both themes.
2. **Store** — a single `Pattern`, a two-point selection, undo/redo. `apply` is the only write path; every pattern the store owns is deep-frozen, so a stray direct write throws instead of silently corrupting history.
3. **Commands** — `toggleTurn`, `setTurn`, `setHole`, `setThreading`, `addCard`, `removeCard`, `setHoleColor`. Pure functions over `(pattern, selection)`. This is *the* editing model.
4. **Board** — the fretboard. Row-major DOM with `display: contents`, orientation by grid placement only, identity colour on chrome only, 28px cell floor.
5. **Pointer binding** — click, drag-to-paint, shift-click, hover preview of the ripple. Token-guarded gestures so a drag is exactly one undo entry.
6. **Keyboard binding** — full keymap, roving tabindex, live region. **The parity test lives here**: a pointer drag and an equivalent keyboard sequence must produce byte-identical patterns.
7. **Card editor** — threading and per-hole colour, opened from chip click, long-press, or `E`.

**Remaining:**

8. **Card stepper** — `+S`/`+Z` add on the S/Z boundary; opens the editor on add.
9. **Weave mode** — at-loom tracker, current pick highlighted, position persisted per pattern.
10. **Chart** — printable turning chart, threading diagram, warp summary.
11. **Persistence and sharing** — localStorage autosave, JSON import/export, share links via deflate in the URL hash.
12. **Image export** — band as SVG and PNG.
13. **PWA and deploy** — offline support, GitHub Pages workflow, footer.

## Decisions taken during implementation

These were settled while building and are recorded so they are not relitigated. Fuller reasoning is in `CLAUDE.md` and the design spec.

- **Arrow keys are spatial; jump keys are semantic.** Arrows move where they point and swap axes with the layout — in the horizontal band, Down advances the *card*. PageUp/PageDown (five picks) and Home/End (first/last card) do not swap. An earlier draft had arrows follow the band; that was wrong, because pressing Down and watching the cursor go sideways is disorienting.
- **`setHole` must not route through `solveTurns`.** It looks like duplicated reachability logic and is not: the solver targets a *colour*, `setHole` targets a *hole*, and cards routinely carry the same colour twice.
- **Assigning a colour to a hole re-points it at a palette entry; it never edits the entry.** Editing would recolour every other card using it.
- **Rotation parity flips every pick.** Only two of a card's four holes are reachable at any pick, and *which* two alternates. This governs `setHole` refusals and the hover preview, and it caused four plan defects before it was written down.
- **Contracts are enforced structurally, not documented.** The store's deep freeze, the gesture token, and `validatePattern`'s outer guard all replace "don't do X" with "doing X throws at the offending line".

## Deferred, with rulings

Not blocking; recorded so they are not lost.

- `gcPalette` throws a raw `TypeError` for a pattern missing `palette`/`cards` entirely, rather than `PatternError`. Fine for TypeScript callers, sharp for JavaScript ones.
- `targetOf` has no direct unit test, only indirect coverage through call sites.
- `openGesture` is readable from store state, so same-bundle code could splice a mutation into an *open* gesture. The unrecoverable-edit class is closed (forged and stale tokens both throw); no adversary exists in a single-user offline app.
- `removeCard` does not bounds-check its index. Harmless while all callers are trusted.

## How to resume

Work runs task-by-task through `superpowers:subagent-driven-development`: a fresh implementer per task, then a task review (spec compliance plus quality), then a fix loop, then a whole-branch review at the end.

- Plan: `docs/superpowers/plans/2026-08-01-weavesmith-web.md` — Task 8 is next.
- Spec: `docs/superpowers/specs/2026-08-01-weavesmith-design.md`.
- Prototype: `docs/mockups/board.html` — a working single-file version of the board. It is the port source for CSS and interaction; read it before building UI.
- The execution ledger lives at `.superpowers/sdd/<plan>/progress.md` and is **gitignored scratch**. This file is the durable record; git history is the other one.

Three things reliably worth doing, learned the hard way on the engine:

1. **Have reviews verify by deletion**, not by reading. Remove the line the test supposedly covers and see whether anything screams. Several tests here passed for the wrong reason until that was done.
2. **Fix the plan, not just the code.** Six defects so far were in the plan rather than the implementation. Each was corrected in both places so the plan stops shipping the bug.
3. **Watch for tests that render fresh.** The card-editor state leak was invisible to seven passing tests because each one started from a clean mount, while real usage never does.
