# WeaveSmith — Design

**Date:** 2026-08-01
**Status:** Accepted (design); implementation plan not yet written
**Repo:** `krajki`
**Interactive mockup:** https://claude.ai/code/artifact/6700d4c5-7746-42a6-9994-13978d7154ee

## Context

Tablet weaving produces narrow decorative bands ("krajki") on square cards threaded
with four warp threads each. Turning the cards forward or backward twists the warp
into cords; the weft locks each twist in place. The pattern is a function of three
things: the colours threaded through each card's holes, each card's threading
direction (S or Z), and the direction every card turns on every pick.

The established design tool for this is **GTT (Guntram's Tabletweaving Thingy)** by
Eckhard Gartz — Windows-only, version 1.17, unmaintained for roughly two decades.
It remains the reference implementation and a large community pattern corpus exists
in its file format. Its practical problems are that it does not run on modern
machines without Wine, and it is unavailable to anyone on a phone or tablet at their
loom.

WeaveSmith is a browser-based replacement for the part of GTT that matters most:
designing threaded-in patterns and reading the resulting turning sequence.

## Goals

1. Design a threaded-in pattern visually and get a turning chart out of it.
2. Import and export designs as plain JSON.
3. Run entirely in a browser, responsive from phone to desktop, hosted free on
   GitHub Pages or Cloudflare Pages.

## Non-goals for v1

Double-face, 3/1 broken twill, brocade, block patterns, multi-colour doubleface,
selvedge generation, `.GTT` file import, and any solver that derives *threading*
from a painted band. Each is listed under Future work with the reason it was cut.

## Scope: threaded-in only

Threaded-in (twist-patterned) weaving is the simplest model — every card carries
four fixed colours and the pattern emerges from turn directions alone. It covers
most historical Slavic and Viking bands, needs exactly one designer and one data
model, and is the foundation the other techniques build on.

---

## Data model

This is both the in-memory model and the on-disk JSON format. No separate
serialisation layer.

```ts
type Threading = 'S' | 'Z';
type Turn = 1 | -1;              // forward | backward

interface Card {
  colors: [number, number, number, number];  // palette indices for holes A,B,C,D
  threading: Threading;
  start: 0 | 1 | 2 | 3;                      // initial rotation
}

interface Pattern {
  version: 1;
  meta: { name: string; author?: string; notes?: string };
  palette: string[];             // hex colours
  cards: Card[];
  picks: Turn[][];               // picks[t][cardIndex]
}
```

Constraints: 4–40 cards; `picks[t].length === cards.length` for every `t`; every
colour index within `palette` bounds. Validation lives in core and runs on import.

`version` exists so a future format change can migrate rather than break saved
files. Unknown future fields are preserved on round-trip where practical.

## Core engine

Four pure functions. No DOM, no dependencies.

### `simulate(pattern) → Cell[][]`

Forward simulation, always total — every valid `Pattern` produces a band.

```ts
interface Cell { color: number; lean: '/' | '\\' }
```

Per card, rotation advances `pos ← (pos + turn) mod 4` at each pick. The visible
thread is `colors[holeAt(pos, threading)]`, and the stitch leans according to
`leanOf(threading, turn)`.

`holeAt` and `leanOf` are the two convention functions. **They are not to be
derived from first principles and trusted.** They get pinned by tests against
published historical bands (see Testing).

### `solveTurns(cards, targetGrid, options) → { picks, unreachable }`

The inverse direction, with threading held fixed. Cards do not interact in
threaded-in weaving, so this decomposes into one independent problem per card.

For each card it is a Viterbi pass over 4 rotation states × T picks. Each state has
two outgoing edges (turn +1 or −1); an edge costs 0 if the resulting visible colour
matches the target and 1 if it does not. Backtracking the minimum-cost path yields
the turn sequence and the exact set of picks that could not be matched. Complexity
is O(4 · 2 · T · N) — instant at any realistic band size.

`options` carries the previous turn sequence so ties break toward what the user
already had. Without this, a single edit reshuffles the whole column and the ripple
becomes unreadable.

`unreachable` is a list of `{ card, pick, wantedColor }`. The UI reports these
rather than silently substituting something.

### `netTwist(pattern) → number[]`

Accumulated turn count per card. Drives untwist warnings and home-position markers.

### `threadCounts(pattern) → { perColor: Record<number, number>, cards: number }`

Warp setup information for the summary sheet.

---

## Interface

The central idea: **the board is a fretboard.** Columns are cards, rows are picks.
This came out of the Guitar Hero / Rocksmith comparison and it holds up because the
physical constraint matches — a card at any pick can only show one of its four hole
colours, and only two are reachable from its current rotation.

### The board

- **Chips** across the top are cards: number, S/Z, and a swatch per hole. Tapping a
  chip opens that card's threading editor. This replaces a separate threading pane.
- **Rows** are picks, numbered down the left gutter, with inlay markers every fifth
  pick.
- **Cells** show the thread on the band's face at that card and pick, leaning `/` or
  `\` with the twist.

Two render modes:

- **Woven (default)** — contiguous stitches, no gaps. The actual band.
- **Dots** — separated notes with the strings visible. Easier to aim at while
  editing.

### Card identity colour

Each card carries an identity colour on its chrome — string line, chip underline,
card number, the rail at the foot of its column, its arrow in the weave bar.

**The identity colour never touches the note face.** Note faces are thread colours,
which are real information about the band; mixing the two systems would make the
chrome unreadable as fabric and vice versa.

Hue encodes **threading direction**, not card index: S cards teal, Z cards orchid,
both chosen to sit outside any plausible wool palette. A per-card hue spread (the
Rocksmith scheme) was built and tested first; it reads well up to about 12 cards and
becomes indistinguishable by 40, and it spends colour on an arbitrary index rather
than on information. S/Z blocks read as solid regions, which is how chevron patterns
are actually structured.

Position is carried by **landmarks** instead: every fifth card gets a heavier rail,
a tinted chip and a bolder number — the same inlay convention already running down
the pick axis. Both axes use one visual grammar.

### Editing

There is one editing model, not one per input device: a **selection** (a rectangle
of cards × picks, minimum one cell) and a small set of **commands** that apply to
it. Touch, mouse and keyboard are three bindings onto that model, and every command
is reachable from all three. Nothing is drag-only.

**Commands**

| Command | Effect |
|---|---|
| `toggleTurn` | Flip turn direction on every cell in the selection |
| `setTurn(forward \| backward)` | Set an explicit direction — idempotent, unlike toggle, so it is the right command for painting a run |
| `setHole(A–D)` | Show a specific hole's thread. Refused per-cell where that hole is not reachable from the card's current rotation |
| `undo` / `redo` | Snapshot stack |

Each command produces a target for `solveTurns`, which re-solves the affected
columns from the earliest edited pick downward with minimum change. Affected cells
pulse so the ripple is visible.

**Pointer (mouse, touch and pen share one implementation via Pointer Events)**

- Click or tap a cell — selects it and applies `toggleTurn`.
- Press and drag — extends the selection as you move and applies `setTurn` to the
  run, direction taken from the first cell. Dragging down a string paints a run of
  picks; dragging across strings applies to a span of cards. This is the most
  common real editing action and it works identically with a mouse.
- Shift-click extends the selection from the anchor without dragging, for long runs
  where dragging across a scrolling board is awkward.
- Hover previews the result: the cell ghosts to what it would become, and the cells
  below it that would change are outlined. The ripple is visible *before* you
  commit, which no touch device can offer and which is the main reason desktop
  editing feels better here.
- Right-click opens a context menu with the full command set, including the four
  `setHole` entries with their colours.

**Keyboard**

The board is a `role="grid"` and behaves like a spreadsheet. Roving `tabindex` makes
the whole grid a single tab stop — Tab moves between board, chips and controls, not
across eight hundred cells.

This forces a **row-major DOM**: one element per pick containing its cells, with CSS
grid producing the columns. The obvious column-major structure (one element per
card, cells stacked inside) draws identically but presents the band transposed to a
screen reader and cannot carry valid `role="row"` semantics. The prototype was built
column-major and would have to be inverted.

| Key | Action |
|---|---|
| Arrows | Move focus one cell |
| Shift + arrows | Extend the selection |
| Page Up / Page Down | Jump five picks, landing on landmark rows |
| Home / End | First / last card in the row |
| Space or Enter | `toggleTurn` on the selection |
| `F` / `B` | `setTurn` forward / backward — deterministic, and what you want when painting |
| `1`–`4` | `setHole` A–D |
| `S` / `Z` | Flip the focused card's threading (also works from its chip) |
| `Esc` | Collapse the selection to the focused cell |
| Ctrl/Cmd + Z, Shift + Ctrl/Cmd + Z | Undo, redo |

Focus and selection are always drawn, so a keyboard user can see the same state a
pointer user infers from their cursor.

**Refusals.** Unreachable colours are refused with an explanation and never silently
approximated. Where a command is refused for only part of a selection, the reachable
cells still change and the refused ones are listed.

The downward ripple is the one genuine departure from a fretboard: pick *t* depends
on pick *t−1* because rotation state carries. Making that ripple visible — as an
animation after the fact on touch, and as a hover preview before the fact on
desktop — is a deliberate teaching device, not a side effect.

### Orientation

The board transposes. **Vertical** runs picks downward and cards across — the
desktop layout, and the one that matches how the band leaves the loom. **Horizontal**
puts every card down the side and grows the pattern to the right.

Horizontal is the default on narrow screens. A phone is tall and thin, so laying
cards along the *long* axis keeps the whole band width on screen and turns the only
scrolling axis into "further along the pattern" — which is also the direction the
work progresses. The vertical layout on a phone forces horizontal scrolling to see
your own band, which is the wrong thing to hide.

Both orientations are one component: DOM order is fixed and only grid placement
changes. Cell lean and the woven-mode stitch angle rotate 90° with the layout so the
fabric still reads correctly. Arrow keys follow the *band*, not the screen — Down is
always "next pick" — so muscle memory survives the flip.

Orientation is chosen automatically from viewport width and can be overridden; the
override sticks.

Cells shrink to fit the band on screen down to a **28px floor**, and past that the
board scrolls on both axes rather than degrading further. 28px is below the usual
44px touch-target guidance, and that is a deliberate trade: a mistap costs one tap
to undo, precision work has the keyboard, and the alternative — cells too small to
hit at all — is worse. Bands wide enough to hit the floor are uncommon; if they turn
out not to be, the answer is a native app, not a more contorted web layout.

### Card editor and palette

`Pattern.palette` is a list of hex colours; cards hold indices into it. The default
palette is a dyed-wool set — madder, woad, weld, walnut, undyed cream — which is
what most historical bands are actually made of.

The editor opens from a card's chip (click, or long-press on touch, or `E` from the
keyboard) and **automatically when a card is added**, so a new card is never left
with someone else's colours by accident. A new card inherits its neighbour's holes
as a starting point rather than arriving blank.

It offers three ways to set a hole's colour, in order of how often they are used:
the wool presets, the colours already in this band, and a colour picker for anything
else.

**Assigning a colour to a hole points that hole at a palette entry; it never edits
the entry in place.** Editing an entry would recolour every other card using it.
Both operations are wanted — "make this hole green" and "make every red in this band
a darker red" — but they are different commands and must not be reachable by the
same gesture. Only the first is in v1.

Unused palette entries are garbage-collected on save so a band that has been
recoloured a few times does not accumulate dead colours in its JSON.

### Resizing the band

4–40 cards. Separate **`+S`** and **`+Z`** buttons, each tinted with its threading
hue, so the threading is chosen at creation rather than fixed afterwards.

A new card lands on the S/Z boundary: an S card joins the end of the S block, a Z
card joins the start of the Z block. Blocks stay contiguous and border cards stay at
the edges. On a mirrored band — which most threaded-in patterns are — that boundary
is the centre. Removal takes from just inside the boundary and never removes a
border card.

Columns narrow (42 → 36 → 30 → 24px) past 12, 18 and 28 cards before the board
begins to scroll horizontally.

### Screens

**Board** and **Chart** only.

- **Board** — everything above. `mode="weave"` turns it into the at-loom tracker:
  current fret highlighted, completed picks dimmed, per-card ↑/↓ arrows in a bar,
  tap to advance, position persisted separately from the pattern so reopening
  resumes where you stopped. It is the same component, not a third screen.
- **Chart** — the printable sheet: monochrome picks × cards grid with ↑/↓, threading
  diagram, and the summary sheet from `threadCounts`/`netTwist`. Print stylesheet;
  screen and paper share one component.

### Outputs

Printable turning chart, mobile pick-by-pick tracker, PNG/SVG export of the band
preview, and the summary sheet. All four are thin views over the core functions.

### Visual direction

Dark ground by default with a dyed-wool palette — madder, woad, weld, walnut,
undyed cream — and a brass accent. Light theme for printing and for viewers who
prefer it; both themes are token-defined so `prefers-color-scheme` and the explicit
`data-theme` toggle both work.

---

## Architecture

pnpm workspaces:

```
packages/core     @weavesmith/core   zero-dep TS: model, simulate, solveTurns, validate
apps/web          React + Vite + TS: board, chart, persistence, sharing
```

The core is the durable asset and the UI is replaceable, so the boundary is
physical rather than a lint rule. A `.GTT` importer later becomes a third package
that depends only on core.

State is a single `Pattern` in a small store (zustand). Undo/redo is a snapshot
stack — patterns are a few KB, so structural sharing is unnecessary.

### Persistence and sharing

- Autosave the working pattern to `localStorage`, plus a named-saves list.
- JSON download and upload.
- Share links: `#p=` + deflate (fflate) + base64url in the URL hash. Above ~1.8 KB
  encoded, the UI says the pattern is too large for a link and offers the JSON
  download instead. No server, no accounts.
- Hash routing so GitHub Pages needs no SPA rewrite rules.
- PWA via `vite-plugin-pwa`, offline-capable — looms are not near wifi.

### Hosting

Static build to GitHub Pages or Cloudflare Pages. No backend, no ops, no running
cost. A `buycoffee.to` link sits in the footer; since hosting is free, it is
goodwill rather than cost recovery.

---

## Testing

**Implementation is test-driven throughout**: write the failing test, watch it fail,
write the minimum code to pass, refactor. This is not optional here — the core is
convention-heavy, and `holeAt`/`leanOf` cannot be derived with confidence, only
pinned.

- **Convention fixtures.** Published historical bands (Snartemo, a Birka band, and
  at least one pattern with a documented GTT chart) are encoded as `Pattern` JSON
  with their known woven output. These tests define what "correct" means for
  `holeAt` and `leanOf`. They are written before the functions exist.
- **Round-trip property.** For randomly generated patterns,
  `solveTurns(cards, simulate(pattern))` reproduces the original band. Any band
  produced by simulation is by construction reachable, so `unreachable` must be
  empty — a strong invariant that catches most inverse-solver bugs.
- **Minimum-change property.** A single-cell edit changes turns only at and below
  that pick, and only in that card's column.
- **Validation.** Malformed JSON — ragged `picks` rows, out-of-range colour indices,
  card counts outside 4–40 — is rejected with a specific message, not a crash.
- **UI tests** cover the board's interaction contract (an edit changes the expected
  cell, ripple bounds, add/remove keeps `picks` rectangular), not pixels.
- **Input parity.** The command set is tested once against the model, then each
  binding is tested to dispatch the right command: pointer drag and
  `Shift`+`ArrowDown` followed by `F` must produce byte-identical patterns. This is
  the test that keeps the three input paths from drifting apart.

## Accessibility

The board is a `role="grid"` with row and column indices, navigated like a
spreadsheet and reachable in a single tab stop via roving `tabindex`. Every cell and
chip is a real control with a meaningful label ("Card 3, pick 7, turning forward").
Selection changes and refusals are announced through a live region, so a screen
reader user learns that four cells changed and one was unreachable.

Visible focus and selection states throughout — never inferred from a cursor.
`prefers-reduced-motion` disables the ripple animation without disabling the
feedback; affected cells still change state, they just do not animate.

Colour is never the only channel: threading is also the "S"/"Z" glyph on the chip,
turn direction is also an arrow, and thread identity is available as text.

Every command in the editing model is bound to a key. There is no pointer-only
capability.

## Open questions

Deliberately unresolved; decide with a woven band in hand rather than now.

1. **Tracing one column through 40 cards of fabric.** S/Z hue plus landmarks may not
   be enough. The likely answer is a hover/tap "highlight this card" state rather
   than reverting to per-card hues.
2. **Palette entry editing.** v1 assigns colours to holes only. Editing a palette
   entry in place — recolouring every card that uses it — is clearly wanted and
   clearly a separate command; where it lives in the interface is unsettled.

Resolved during design, recorded here because the reasoning matters:

- **Phone layout** (was: designer ergonomics on a phone) — resolved by transposing
  the board rather than shrinking the desktop one. See Orientation.
- **Palette** (was: hardcoded colours) — resolved as wool presets plus a picker in
  the card editor, opening automatically on card creation. See Card editor and
  palette.
- **Very wide bands on a phone** — resolved as a 28px cell floor and scrolling past
  it. A dedicated mobile app is the escalation if that ever proves insufficient; it
  is not a v1 concern and does not shape the v1 design.

## Future work

In rough order of value:

1. **`.GTT` import** for threaded-in patterns — unlocks the existing community
   corpus. Deferred because the JSON model must prove itself first; nothing in this
   design blocks it, since the format is a superset of the threaded-in fields.
2. **Double-face**, then **3/1 broken twill**, then brocade and block patterns. Each
   needs its own designer and its own data model extension.
3. **Threading suggestion** from a painted band — heuristic, best-effort, always
   user-editable. A full search-based solver over threading *and* turning is a
   research project and is not planned.
