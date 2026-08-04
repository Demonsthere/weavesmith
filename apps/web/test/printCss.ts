// Typed by ./nodeBuiltins.d.ts — this project has no `@types/node`
// dependency, see that file for why.
import { readFileSync } from 'node:fs';

/*
 * Resolved from the package root rather than from `import.meta.url`.
 *
 * Under `environment: 'jsdom'` the global `URL` is jsdom's, and
 * `new URL('../src/…', import.meta.url)` resolves against the document's
 * base — it returns `http://localhost:3000/src/…`, and `fileURLToPath`
 * then rejects it with "The URL must be of scheme file", a message that
 * points at the scheme rather than at the resolution. Other tests in this
 * suite do use the `import.meta.url` form and work; I could not pin down
 * what differs, and chose a resolution with no moving parts over an
 * explanation.
 *
 * `process.cwd()` is the package root here: each workspace package runs its
 * own `vitest` from its own directory, locally and in CI alike.
 */
const PRINT_CSS = readFileSync(`${process.cwd()}/src/styles/print.css`, 'utf8');

/**
 * The print stylesheet's text, and just its `@media print` block.
 *
 * This project's vitest config stubs CSS imports to `""`, so print rules
 * are not observable through the DOM at all — the stylesheet's source is
 * the only thing there is to assert against.
 *
 * Shared rather than repeated: three test files wanted the print block, and
 * each hand-rolled `slice(indexOf('@media print'))` without checking the
 * block was there. That returns -1, slices the last character, and fails on
 * a regex that says nothing about the real cause. It fails here instead,
 * once, with a sentence naming the problem.
 */
export function printCss(): { all: string; printBlock: string } {
  const start = PRINT_CSS.indexOf('@media print');
  if (start === -1) {
    throw new Error('print.css no longer contains an `@media print` block.');
  }
  return { all: PRINT_CSS, printBlock: PRINT_CSS.slice(start) };
}
