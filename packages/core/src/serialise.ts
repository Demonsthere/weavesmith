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
 * Drop palette entries no card uses and renumber what remains.
 *
 * Recolouring a band leaves orphaned entries behind; this keeps saved files
 * honest about what the band actually contains.
 */
export function gcPalette(pattern: Pattern): Pattern {
  const used = new Set<number>();
  for (const card of pattern.cards) for (const color of card.colors) used.add(color);

  const kept = [...used].sort((a, b) => a - b);
  const remap = new Map(kept.map((oldIndex, newIndex) => [oldIndex, newIndex]));

  return {
    ...pattern,
    palette: kept.map((index) => pattern.palette[index]!),
    cards: pattern.cards.map((card) => ({
      ...card,
      colors: card.colors.map((c) => remap.get(c)!) as [number, number, number, number],
    })),
  };
}
