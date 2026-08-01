# WeaveSmith

A browser-based pattern designer for **tablet weaving** — the ancient craft of
weaving narrow decorative bands on square cards. Design a band, see it woven as
you work, and get the turning chart you follow at the loom.

Nothing to install, nothing to sign up for, no server. Open a page and weave.

It started as a present: I play guitar, my wife weaves, and this is her craft
laid out the way I read music. More on that [below](#where-the-fretboard-came-from).

> Status: **design complete, implementation not started.** See
> [the spec](docs/superpowers/specs/2026-08-01-weavesmith-design.md) and the
> [interactive board prototype](docs/mockups/board.html).

## What tablet weaving is

A band is woven on small square cards ("tablets"), each threaded with four warp
threads through holes at its corners. Turning the cards forward or backward
twists those threads into cords; the weft locks each twist in place. The pattern
that appears is a function of exactly three things:

- the colours threaded through each card's four holes,
- each card's threading direction — **S** or **Z**,
- which way every card turns on every pick.

In Polish the resulting bands are called *krajki*, which is where this repo got
its original name.

## Why this exists

The established tool for designing these patterns is
**[GTT — Guntram's Tabletweaving Thingy](https://www.guntram.co.za/tabletweaving/gtt.htm)**
by Eckhard "Guntram" Gartz. It is genuinely good software with a
[large community pattern archive](https://www.guntram.co.za/tabletweaving/patterns/patterns.html),
and most people learning tablet weaving are still pointed at it — including by
the Polish guide that started this project,
[WICI's tablet weaving primer](https://wici.org.pl/2020/04/tkactwo-tabliczkowe-przewodnik-cz-3-darmowe-materialy-do-nauki/).

It is also Windows-only, stuck at version 1.17, and unmaintained for around two
decades. You cannot run it on a Mac without Wine, and you certainly cannot open
it on the phone sitting next to your loom.

WeaveSmith rebuilds the part that matters most — designing threaded-in patterns
and reading the turning sequence — as a web page that runs anywhere, including
on the phone propped against the loom.

## Where the fretboard came from

I play guitar. My wife is learning tablet weaving. WeaveSmith is a gift for her,
built out of the only visual language I had to offer — so the band is laid out
the way I already know how to read one.

That turned out to be less of a stretch than it sounds.

- **[Guitar Hero](https://en.wikipedia.org/wiki/Guitar_Hero)** gave the shape:
  parallel lanes with notes running along them. Cards are the strings, picks are
  the frets.
- **[Rocksmith](https://en.wikipedia.org/wiki/Rocksmith)** gave the colour
  language: each string carries its own identity colour across the whole
  interface, so you always know which one you are looking at.

The analogy holds up because the physics matches. On a fretboard, only certain
notes are available at each position. In tablet weaving, a card can only show
one of its four hole colours, and only **two** are reachable from its current
rotation. Tapping a note cycles through what is actually possible — you cannot
draw an unweavable band.

Two places where weaving is *not* a guitar, both of which shaped the design:

- **Picks depend on the pick before them.** A card's rotation carries down the
  band, so changing one cell changes everything below it. WeaveSmith shows that
  ripple rather than hiding it — animated after the fact on touch, previewed on
  hover before you commit on desktop.
- **Identity colour encodes threading direction, not string number.** A rainbow
  hue per card reads beautifully at eight cards and becomes mud at forty. Hue is
  spent on S versus Z instead, which is information a weaver actually needs, and
  position is carried by landmarks every fifth card — the same inlay convention
  guitars use.

## What v1 does

- **Design** threaded-in patterns on a board that transposes for phone or
  desktop.
- **Simulate** the woven band live, with stitches leaning the way the twist
  actually falls.
- **Print** a turning chart, with a threading diagram and warp summary.
- **Weave** from it: an at-loom mode that walks pick by pick and remembers where
  you stopped.
- **Share** designs as plain JSON files or as a link, with no account and no
  server.
- **Work offline.** Looms are rarely near wifi.

Out of scope for v1, in likely order of arrival afterwards: importing legacy
`.GTT` files, double-face, 3/1 broken twill, brocade, and block patterns.

## Repository layout

```
docs/superpowers/specs/     the design spec
docs/superpowers/plans/     implementation plans, core and web
docs/mockups/board.html     working prototype of the board — open it in a browser
packages/core/              @weavesmith/core: weaving logic, zero dependencies
apps/web/                   the React app
```

`packages/core` is the durable part: a dependency-free TypeScript library that
simulates a band and solves turn sequences from a target. The app is a view over
it. If you want to build something else on top of tablet weaving, that package
is the interesting one.

## Development

Requires Node 22+ and pnpm 9+.

```bash
pnpm install
pnpm test          # everything
pnpm --filter @weavesmith/web dev
```

Implementation is test-driven: the weaving conventions are pinned by fixtures
transcribed from published historical bands, because they cannot be derived with
confidence. If a fixture and the code disagree, the code is wrong.

## Further reading on tablet weaving

- [WICI's guide, part 3](https://wici.org.pl/2020/04/tkactwo-tabliczkowe-przewodnik-cz-3-darmowe-materialy-do-nauki/) — Polish, and a good index of free learning material
- [Shelagh Lewins' tablet weaving pages](https://tabletweaving.shelaghlewins.com/) — historical patterns with woven photographs
- [GTT's pattern archive](https://www.guntram.co.za/tabletweaving/patterns/patterns.html) — decades of community patterns
- [Tablet weaving on Wikipedia](https://en.wikipedia.org/wiki/Tablet_weaving)

## Licence

Not yet chosen.
