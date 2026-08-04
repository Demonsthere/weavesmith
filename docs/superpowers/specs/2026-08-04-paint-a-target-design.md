# Paint a target — reaching the inverse solver

Design, 2026-08-04. Closes issue #26 item 6, and the reachability half of item 3.

## Why

`solveTurns` is the engine's headline capability and the shipped app has never
called it. Cards being independent is what makes the inverse cheap — one
shortest path over four rotation states per card — and `packages/core` tests it
thoroughly, including a round-trip property. None of that reaches a weaver.

The interaction the solver exists for is: **paint the band you want, and get the
turn sequence that produces it** — with an honest account of the cells no turn
sequence can reach. That is plausibly the feature that beats GTT, which makes
you work forwards from turns only.

Two failures look identical on screen and are not the same thing:

- **unreachable** — no turn sequence shows that colour there. Solving again
  will not help; the fix is a different hole colour or a different threading.
- **unmet** — the band disagrees with the target, but a solve would fix it.
  You get here by editing turns in Design mode after a solve.

Naming both is most of the honesty this feature promises.

## Scope

In: a Paint screen mode, a target stored on the pattern, a Solve action, and a
visible mark on every cell where band and target disagree.

Out: solving over threading (a standing non-goal — see the main design spec's
Non-goals); target on the printed chart; importing an image as a target.

## Model

### `Pattern.target`

```ts
interface Pattern {
  version: 1;
  meta: PatternMeta;
  palette: string[];
  cards: Card[];
  picks: Turn[][];
  /** target[pick][card] — a palette index, or null for "any colour will do".
      Same dimensions as `picks`. Absent when nothing has been painted. */
  target?: (number | null)[][];
}
```

The target is **sparse in meaning, dense in storage**: every cell has an entry,
but `null` means "don't care". That is what `solveTurns` already accepts, and it
removes the staleness problem an eagerly-seeded target would have. Unpainted
cells cost the solver nothing and, because `options.previous` breaks ties toward
the turns the weaver already has, they keep exactly the turns they had. So a
solve is safe to run over the whole band rather than over "affected columns"
— there is no such thing as an affected column once unpainted means don't-care.

It lives on the pattern, not in the store, so it autosaves, exports, and travels
in a share link. A weaver can send someone "here is what I wanted, and here are
the three cells wool cannot do".

No version bump: `target` is optional, and every existing file stays valid.

### `validate`

`target` is optional. When present:

- rectangular, and its dimensions equal `picks`' dimensions exactly
- every entry is `null` or an integer index in range of `palette`
- sparse arrays rejected, via the `Array.from` treatment the existing element
  loops already use

The app never changes the pick count, so `addCard`/`removeCard` are the only
internal dimension coupling — but validation does not depend on that, because an
imported file can claim anything.

### `gcPalette`

A colour referenced only by `target` counts as live, **and target indices are
remapped along with card colours.** `gcPalette` renumbers the palette; a target
left holding pre-collection indices would silently repoint at different colours
on the next share or save. This is the sharpest failure mode in the change and
it gets its own test.

### `reportTarget(pattern) → TargetReport`

```ts
export interface TargetReport {
  unreachable: Unreachable[];  // no turn sequence can show this
  unmet: Unreachable[];        // band ≠ target, but Solve would fix it
}
export function reportTarget(pattern: Pattern): TargetReport;
```

Lives in `solve.ts`, beside `Unreachable` and `targetOf`. Runs `simulate` for
what the band shows now and `solveTurns` for what is achievable, then splits the
disagreements: a disagreement the solver also could not fix is unreachable,
anything else is unmet.

Linear in cells — 40 cards × 800 picks is a quarter-million operations — so the
web side recomputes it in a `useMemo` on every pattern change rather than
caching an answer that can go stale.

## Editing

### Commands

Three additions to `apps/web/src/state/commands.ts`, in the existing pure
`(pattern, …) → CommandResult` shape:

| Command | Effect |
|---|---|
| `paintTarget(pattern, selection, color)` | Sets every cell in the selection to `color`. Creates `target` lazily, filled with `null` |
| `clearTarget(pattern, selection)` | Sets them back to `null`. Drops `target` entirely once it holds no colours, so a cleared band saves clean |
| `solveTarget(pattern)` | `solveTurns(cards, target, { previous: picks })`, writes the result to `picks` |

`solveTarget` reports like `setHole` already does:
`"Solved 34 cells. 3 unreachable (card 7 picks 4–6)"`. With nothing painted it
is a no-op: `"Nothing painted yet"`.

One `apply`, so one undo entry. Undo restores the previous turns and leaves the
painting in place — the useful direction, because the reason to undo a solve is
to try a different threading, not to lose the painting.

`addCard` and `removeCard` splice `target` rows alongside `picks` rows.

### Brush

The brush is a palette index, or `null` for erase. Store state, alongside
`orientation`/`render`/`mode`; `reset` returns it to `0`.

Any palette colour can be painted on any cell. A colour the card does not carry
comes back as unreachable with the reason. Restricting the brush would not
remove unreachability anyway — the hard constraint is sequential: rotation must
change every pick, so the same hole two picks running is impossible unless
neighbouring holes happen to share a colour. Pre-censoring the brush would hide
that lesson while still leaving the failure.

### Bindings

`ScreenMode` gains `'paint'`. Both existing binding hooks branch on it; neither
is forked, and no capability is added to one binding alone.

| | Design (unchanged) | Paint |
|---|---|---|
| tap / click | `toggleTurn` | `paintTarget(brush)` |
| drag | `setTurn` run | `paintTarget` run, one gesture, one undo entry |
| hover preview | ripple outline | none — a target does not ripple |
| `1`–`9` | `1`–`4` are `setHole` A–D | choose brush |
| `Enter` / `Space` | `toggleTurn` | paint the selection |
| `Backspace` | — | `clearTarget` |
| `Ctrl`/`Cmd`+`Enter` | — | Solve |
| arrows, `Shift`+arrows, `Esc`, undo/redo | unchanged | same as Design |

Digits mean different things in different modes. That is a real cost, accepted
because the alternative runs out of both keys and muscle memory.

A swatch click sets the brush *and* paints the current selection, so a
select-then-colour user and a drag-with-a-brush user both get one gesture rather
than two.

## Rendering

**Mode toggle** becomes `[Design] [Paint] [Weave]`.

**`paint/BrushStrip.tsx`** — mounted only in Paint mode, the way `WeaveBar` is
mounted only in Weave mode, so it never holds state from a mode it is not in.
One swatch per palette entry, an erase swatch, and the Solve button.
`role="group"`, `aria-pressed` on the active brush.

**Board in Paint mode** (`board.paint`): painted cells draw the target colour
flat — no lean, no woven texture, because a target has no lean. Unpainted cells
draw the woven colour dimmed, so you can see the band you are painting over.
Design and Weave draw the band exactly as they do today.

**The mark** (`.cell.unmet`), in Design and Paint. Suppressed in Weave, where
the at-loom view should show only what is being woven:

```css
.cell.unmet .note   { filter: saturate(0.25) }   /* real colour still readable */
.cell.unmet::after  { /* diagonal slash, currentColor — prints black */ }
.cell.unmet::before { background: var(--wanted) } /* corner pip: what you asked for */
```

The scrim keeps the board truthful about what will come off the loom; the slash
survives a greyscale print and a colour-blind reader; the pip carries the wish.
The same information is in `aria-label` — `"…wanted red, unreachable — card 7
carries blue, white"` or `"…wanted red, press Solve"` — so the mark is never the
only channel.

**Summary** gains one line when a target exists: `"3 cells unreachable, 12
unmet"`.

The printed chart and the Chart route are unchanged. The printed sheet is what
you weave from, and it should show the band that will actually come off the
loom.

## Testing

TDD throughout: failing test, confirm the reason, then implement.

**Core**

- `validate`: absent target valid; rejects non-rectangular, dimension mismatch
  with `picks`, out-of-range index, non-integer, sparse array.
- `serialise`: round-trips a target; **`gcPalette` remaps target indices** and
  keeps a colour that only the target references.
- `reportTarget`:
  - all-`null` target → both lists empty
  - `targetOf(simulate(pattern))` as the target → both empty (leans on the
    existing round-trip property)
  - a colour the card does not carry → `unreachable`
  - the same hole two picks running → `unreachable`, pinning the sequential
    constraint
  - solve, then flip a turn → `unmet`, not `unreachable`

**Web**

- `commands`: lazy creation; `clearTarget` drops an emptied target;
  `solveTarget` writes picks and counts correctly; `addCard`/`removeCard` keep
  target dimensions locked to picks.
- `parity`: a per-mode reachability table — every paint command reachable from
  pointer, keyboard and touch. This generalises the gap issue #26 item 3
  found: the current test compares which commands each binding *dispatches*,
  not which it can *reach*.
- `Board`: unmet cells carry `.unmet` and the wanted colour in `aria-label`;
  Paint mode draws target colours; Weave mode carries no marks.
- `store`: `brush` default and `setBrush`; `mode: 'paint'`.
- `io`: autosave and share-link round-trips preserve the target.

No fixture is edited. `reportTarget` is pinned against simulation output and
hand-built cards, per `packages/core/test/fixtures/README.md`.

## Superseded

The main design spec (l.184) says each command produces a target for
`solveTurns`, which re-solves the affected columns. That line is superseded, not
implemented late: `setTurn`/`toggleTurn` target turns, and `setHole` targets a
*hole* — routing it through a colour solver would let the solver satisfy "show
hole B" by landing on hole A when a card carries the same colour twice, with the
opposite lean. See CLAUDE.md. This spec puts the solver behind the one
interaction that genuinely asks for a colour.
