# CLAUDE.md — WeaveSmith

Guidance for Claude Code working in this repo.

## What this is

A browser-based pattern designer for **tablet weaving**, replacing
[GTT](https://www.guntram.co.za/tabletweaving/gtt.htm) — the established tool,
which is Windows-only and unmaintained for ~20 years.

It is a personal project: Jakub plays guitar, his wife is learning tablet
weaving, and the app is a gift for her. That is why the interface is a
fretboard. Keep that framing in user-facing text; favour what a weaver at a
loom would enjoy using over generality or feature count.

The local directory is `krajki` (Polish for woven bands); the repo is
`weavesmith`. Same project.

## Domain model — read this before touching anything

A band is woven on square cards ("tablets"), each with a warp thread through
four corner holes labelled **A, B, C, D** (indices 0–3).

- Each card is threaded **S** or **Z** — mirror images of each other.
- Every **pick**, each card turns **forward (`1`)** or **backward (`-1`)**.
- Turning brings a different hole to the face, so a different thread shows.
- The pattern is a pure function of: hole colours, threading direction, and the
  turn sequence. Nothing else.

Two consequences that shape the whole codebase:

1. **A card can only show one of its four colours, and only two are reachable
   from its current rotation** (±1 step). This is why editing is constrained
   rather than free-form painting, and why `setHole` refuses per-cell.
2. **Pick *t* depends on pick *t−1*** — rotation carries down the band. Editing
   one cell changes everything below it in that column. The UI shows this
   ripple deliberately.

Cards are **independent of each other** in threaded-in weaving. That is what
makes the inverse solver cheap: one shortest path over four rotation states per
card, not a search.

**Scope is threaded-in patterns only.** Double-face, 3/1 broken twill, brocade
and block patterns are different weave structures and are explicitly out of
scope for v1 — do not add them opportunistically.

## Architecture

```
packages/core/    @weavesmith/core — zero-dependency TS. Model, simulate,
                  solveTurns, validate, serialise, analyse. No DOM.
apps/web/         React + Vite. A view over core, nothing more.
docs/mockups/     board.html — working prototype. Load-bearing: the web plan
                  says to port CSS from it rather than retype it.
```

Core is the durable asset; the UI is replaceable. If the app needs to know how
a card rotates, that is a missing core function, not a component helper.

### `src/conventions.ts` is special

`holeAt` and `leanOf` are the **only** place a weaving convention is decided.
They are pinned by `test/bands.test.ts` against a band transcribed from a
published source.

**If a fixture and the code disagree, the code is wrong.** Never edit a fixture
to make a test pass. Fixtures record provenance in a `source` field; the rules
are in `packages/core/test/fixtures/README.md`.

**Credit third-party sources in the repo README, not only in the `source`
field.** A fixture transcribed from someone's published pattern is use of their
work. The `source` field is the audit trail; the README's Credits section is the
acknowledgement, and both are required. This applies to anything drawn from
outside the repo — patterns, data, research, prior art.

## Working agreements

- **TDD, always.** Write the failing test, run it, confirm it fails for the
  expected reason, then implement. Jakub asked for this explicitly, and the
  convention-heavy core is why it matters.
- **Core has zero runtime dependencies.** If something seems to need one, write
  the code instead.
- **One editing model, three bindings.** Pointer, keyboard and touch all
  dispatch into the same command set (`apps/web/src/state/commands.ts`). Never
  add a capability to one binding alone — there is a parity test that will
  catch it, and it exists because that drift is the easy mistake.
- **Board DOM is row-major** (one element per pick, `display: contents`
  wrappers, orientation via grid placement). Column-major draws identically and
  transposes the band for screen readers.
- **Identity colour never touches a note face.** Note faces are thread colours.
  Card identity colour lives on chrome only and encodes threading direction,
  not card index.
- Commits: Conventional Commits. Explain *why* in the body when it isn't
  obvious; the reasoning behind a weaving decision is usually the valuable part.

## Commands

```bash
pnpm install
pnpm test                              # whole workspace
pnpm typecheck
pnpm --filter @weavesmith/core test
pnpm --filter @weavesmith/web dev
```

Node ≥22, pnpm ≥9. Note Node 26 no longer ships corepack, so pnpm is a plain
global install on this machine.

## Where the decisions live

- `docs/superpowers/specs/2026-08-01-weavesmith-design.md` — the design, with
  reasoning and the resolved/open questions. Read before proposing UI changes;
  several obvious-looking ideas were considered and rejected there for reasons.
- `docs/superpowers/plans/2026-08-01-weavesmith-core.md` — engine, 9 tasks.
- `docs/superpowers/plans/2026-08-01-weavesmith-web.md` — app, 13 tasks.
- `.superpowers/sdd/<plan>/progress.md` — execution ledger, git-ignored. Trust
  it and `git log` over recollection.

## Things already tried and rejected

Don't re-propose these without new information:

- **A hue per card** (the Rocksmith scheme). Reads well to ~12 cards, becomes
  indistinguishable by 40. Hue now encodes S/Z; position is carried by
  landmarks every fifth card.
- **A solver that derives threading from a painted band.** Combinatorial,
  frequently unsatisfiable. v1 solves turns only, with threading held fixed.
- **Shrinking cells indefinitely on phones.** There is a 28px floor; past that
  the board scrolls. A native app is the escalation, not a more contorted
  layout.
- **Editing a palette entry in place from the hole picker.** Assigning a colour
  to a hole re-points it at an entry; it never edits the entry, because that
  would recolour every other card using it. Both operations are wanted, but
  they must not share a gesture.
