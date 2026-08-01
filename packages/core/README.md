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
