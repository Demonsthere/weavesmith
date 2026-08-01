import { HOLE_LABELS } from './types.js';
import type { Pattern } from './types.js';
import { validatePattern } from './validate.js';

export class PatternError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Not a valid pattern:\n- ${problems.join('\n- ')}`);
    this.name = 'PatternError';
    this.problems = problems;
  }
}

/** Serialise a pattern as indented JSON, so saved files diff cleanly. */
export function toJSON(pattern: Pattern): string {
  return JSON.stringify(pattern, null, 2);
}

/** Parse and validate. Throws PatternError with every problem found. */
export function fromJSON(text: string): Pattern {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new PatternError([`not valid JSON: ${(error as Error).message}`]);
  }

  const problems = validatePattern(value);
  if (problems.length > 0) throw new PatternError(problems);

  return value as Pattern;
}

/**
 * Check the two things gcPalette itself depends on: every palette entry is a
 * string, and every card colour actually indexes into the palette. This is
 * deliberately narrower than `validatePattern` (it does not care about card
 * count, threading, picks, or meta) — gcPalette is called on plenty of
 * otherwise-incomplete in-memory patterns (tests build them with one or two
 * cards), and only the palette/colour relationship can corrupt its output.
 *
 * Without this, an out-of-range colour index survives straight through:
 * `kept.map(i => pattern.palette[i])` reads past the end of the array and
 * produces `undefined`/`null` palette entries that then read back as a
 * *shorter*, in-range palette — silently laundering a corrupt pattern into
 * one that validates clean.
 */
function paletteIntegrityProblems(pattern: Pattern): string[] {
  const problems: string[] = [];

  // Array.from, not a bare forEach: forEach skips holes in a sparse array
  // entirely, which would let a sparse palette or colours array through
  // both checks below unexamined. Array.from turns each hole into an
  // actual `undefined` element that the checks then reject. Same fix as
  // validate.ts's element loops, for the same reason.
  Array.from(pattern.palette).forEach((color, index) => {
    if (typeof color !== 'string') {
      problems.push(`palette entry ${index + 1} must be a string, found ${String(color)}`);
    }
  });

  pattern.cards.forEach((card, cardIndex) => {
    Array.from(card.colors).forEach((color, hole) => {
      if (!Number.isInteger(color) || color < 0 || color >= pattern.palette.length) {
        problems.push(
          `card ${cardIndex + 1}, hole ${HOLE_LABELS[hole]}: colour ${String(color)} is not in the palette`,
        );
      }
    });
  });

  return problems;
}

/**
 * Drop palette entries no card uses and renumber what remains.
 *
 * Recolouring a band leaves orphaned entries behind; this keeps saved files
 * honest about what the band actually contains.
 *
 * Refuses (throws PatternError) rather than skipping bad indices: gc runs on
 * every save, so a pattern that is already corrupt must fail loudly here
 * instead of being rewritten into a smaller, in-range palette that then
 * reads back as clean — that silent laundering is what let a corrupt band
 * become a file that reloads without complaint and renders a colourless
 * cell.
 */
export function gcPalette(pattern: Pattern): Pattern {
  const problems = paletteIntegrityProblems(pattern);
  if (problems.length > 0) throw new PatternError(problems);

  const used = new Set<number>();
  for (const card of pattern.cards) for (const color of card.colors) used.add(color);

  const kept = [...used].sort((a, b) => a - b);
  const remap = new Map(kept.map((oldIndex, newIndex) => [oldIndex, newIndex]));

  return {
    ...pattern,
    meta: { ...pattern.meta },
    palette: kept.map((index) => pattern.palette[index]!),
    cards: pattern.cards.map((card) => ({
      ...card,
      colors: card.colors.map((c) => remap.get(c)!) as [number, number, number, number],
    })),
    picks: pattern.picks.map((row) => [...row]),
  };
}
