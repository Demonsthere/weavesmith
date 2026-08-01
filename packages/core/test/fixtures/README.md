# Fixtures

Each fixture is a `Pattern` plus the band it is known to produce. They are the
only thing standing between us and a plausible-looking but wrong weave.

Rules:

1. Every fixture records where its data came from, in a `source` field: a URL, a
   book with page number, or "derived" with an explanation.
2. A **sourced** fixture is never edited to make a test pass. If simulation
   disagrees with it, the bug is in `src/conventions.ts`. This is absolute.
   A **derived** fixture encodes something self-evident, so the claim and the
   data can contradict each other — that's a bug in the fixture, not in the
   weave. When that contradiction is proven, not suspected, the data may be
   corrected to match the fixture's own stated claim. Record the correction in
   `source`, with the arithmetic that proves the original was impossible. A
   derived fixture may never be corrected to match the code's behaviour —
   only to match its own claim.
3. A "derived" fixture may only encode something self-evident (a solid-colour
   card produces a solid column). Anything requiring weaving knowledge must be
   sourced.

Sources worth using:

- https://www.guntram.co.za/tabletweaving/patterns/patterns.html — GTT's own
  pattern archive, with rendered charts.
- https://tabletweaving.shelaghlewins.com/ — patterns with woven photographs.
- The TWIST database (Tablet Weavers' International Studies and Techniques).
