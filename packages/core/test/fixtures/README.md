# Fixtures

Each fixture is a `Pattern` plus the band it is known to produce. They are the
only thing standing between us and a plausible-looking but wrong weave.

## Shape

`source` is a structured object, not a paragraph of prose — a paragraph
carrying five facts is unreadable and untestable, and JSON has no multiline
strings or comments to make it otherwise. Every prose-like fact (how
something was transcribed, what it was checked against, a confidence
assessment) is an array of strings, one line per fact, so a future edit
diffs as a single line, not a rewritten wall of text. The exact shape lives
in `../helpers/fixture.ts` (`Provenance`, `SourcedProvenance`,
`DerivedProvenance`, `Fixture`).

`source.kind` discriminates between the two kinds of fixture:

- **`"sourced"`** — transcribed from a real, published band. Must give
  `url` (and `documentUrl` when the source has a separate primary document,
  e.g. an instruction PDF apart from the page it's linked from), `author`,
  `patternName`, `weaveStructure`, `transcription`, `crossChecks`, and
  `confidence`. Optional: `context` (historical background) and
  `rejectedSources` (other sources considered and why they weren't used).
- **`"derived"`** — encodes something self-evident (a solid-colour card
  produces a solid column; mirrored S/Z threading produces a mirrored band).
  Has no URL or author — a derived fixture never had one. Must give `claim`,
  the self-evident property it's designed to encode. Optional:
  `corrections`, used only per rule 2 below.

`packages/core/test/fixtures.test.ts` loads every file in this directory and
enforces this shape mechanically: it discovers fixtures by reading the
directory, so a new fixture is covered the day it's added, and it fails
loudly if a fixture's `source` is missing a required field for its kind —
including the historical fields — so a future contributor cannot land an
unsourced fixture dressed up as historical.

## Rules

1. Every fixture records where its data came from, in the `source` field
   described above.
2. A **sourced** fixture is never edited to make a test pass. If simulation
   disagrees with it, the bug is in `src/conventions.ts`. This is absolute.
   A **derived** fixture encodes something self-evident, so the claim and the
   data can contradict each other — that's a bug in the fixture, not in the
   weave. When that contradiction is proven, not suspected, the data may be
   corrected to match the fixture's own stated claim. Record the correction
   in `source.corrections`, with the arithmetic that proves the original was
   impossible. A derived fixture may never be corrected to match the code's
   behaviour — only to match its own claim.
3. A "derived" fixture may only encode something self-evident (a solid-colour
   card produces a solid column). Anything requiring weaving knowledge must be
   sourced.

Sources worth using:

- https://www.guntram.co.za/tabletweaving/patterns/patterns.html — GTT's own
  pattern archive, with rendered charts.
- https://tabletweaving.shelaghlewins.com/ — patterns with woven photographs.
- The TWIST database (Tablet Weavers' International Studies and Techniques).
