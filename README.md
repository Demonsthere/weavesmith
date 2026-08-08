# WeaveSmith

[![Buy me a coffee](https://img.shields.io/badge/buycoffee.to-demonsthere-00874F?style=flat-square)](https://buycoffee.to/demonsthere)

**English** · [Polski](#polski)

A browser-based pattern designer for **tablet weaving** — the ancient craft of
weaving narrow decorative bands on square cards. Design a band, see it woven as
you work, and get the turning chart you follow at the loom.

Nothing to install, nothing to sign up for, no server. Open a page and weave.

It started as a present: I play guitar, my wife weaves, and this is her craft
laid out the way I read music. More on that [below](#where-the-fretboard-came-from).

> Status: **engine and app built.** See
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
- **Solve backwards.** Paint the band you want and get the turn sequence that
  produces it — with the cells the cards cannot deliver marked honestly rather
  than quietly approximated.
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
make install
make check         # typecheck + the whole test suite, what CI runs
make dev           # the app on a local dev server
```

`make` on its own lists every target. It is a thin wrapper over pnpm — drop to
`pnpm --filter @weavesmith/web …` whenever you need a flag it does not expose.

Implementation is test-driven: the weaving conventions are pinned by fixtures
transcribed from published historical bands, because they cannot be derived with
confidence. If a fixture and the code disagree, the code is wrong.

## Credits

This project stands on work other people did first.

**[Shelagh Lewins](https://www.shelaghlewins.com/tablet_weaving/patterns_past.php)**
— her documented historical patterns are what WeaveSmith's weaving conventions
are tested against. The
[Narrow Oseberg Band](https://www.shelaghlewins.com/tablet_weaving/Oseberg_narrow/Oseberg_narrow.pdf)
instruction sheet, reconstructing a band from the Oseberg ship burial
(c. 834 AD), is transcribed as a test fixture in
`packages/core/test/fixtures/oseberg-narrow.json`. Her threading chart is the
reason we know our simulation matches real weaving rather than merely being
self-consistent.

**Eckhard "Guntram" Gartz** — for
[GTT](https://www.guntram.co.za/tabletweaving/gtt.htm) and its
[pattern archive](https://www.guntram.co.za/tabletweaving/patterns/patterns.html),
which have served this craft for two decades and set the standard WeaveSmith is
trying to meet.

**[WICI](https://wici.org.pl/2020/04/tkactwo-tabliczkowe-przewodnik-cz-3-darmowe-materialy-do-nauki/)**
— whose Polish tablet weaving guide is where this project started.

Every fixture in `packages/core/test/fixtures/` records its origin in a `source`
field. If you contribute one drawn from someone else's published work, credit
them here too.

## Further reading on tablet weaving

- [WICI's guide, part 3](https://wici.org.pl/2020/04/tkactwo-tabliczkowe-przewodnik-cz-3-darmowe-materialy-do-nauki/) — Polish, and a good index of free learning material
- [Shelagh Lewins' tablet weaving pages](https://tabletweaving.shelaghlewins.com/) — historical patterns with woven photographs
- [GTT's pattern archive](https://www.guntram.co.za/tabletweaving/patterns/patterns.html) — decades of community patterns
- [Tablet weaving on Wikipedia](https://en.wikipedia.org/wiki/Tablet_weaving)

## Supporting this

WeaveSmith is free, has no accounts and no server, and is not trying to become a
business — it started as a present and stays one. Hosting costs nothing, so
there is nothing to recover. If it saved you an evening at the loom and you feel
like saying thanks, there is
[a coffee link](https://buycoffee.to/demonsthere). That is the whole ask.

## Licence

[MIT](LICENSE). Use it, fork it, build something else on
`@weavesmith/core` — commercially or otherwise. Keep the copyright notice
and you are fine.

Two things the licence does not stretch to, because they are not mine to
give away:

- **The test fixtures** in `packages/core/test/fixtures/` are transcribed
  from published patterns by the people named in [Credits](#credits), and
  each records its origin in a `source` field. The licence covers this
  project's code; those patterns belong to their authors, and anything you
  do with them is between you and them.
- **Third-party marks** — the buycoffee.to logo and QR code in
  `apps/web/public/` are their trademarks, used with their own share
  material. Trademarks travel on permission, not on this licence.

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
