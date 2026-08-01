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
