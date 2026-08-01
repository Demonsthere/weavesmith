import { HOLE_COUNT, HOLE_LABELS, MAX_CARDS, MIN_CARDS } from './types.js';

/** Fallback text for a value that resists every attempt to render it. */
const UNPRINTABLE = '[unprintable value]';

/**
 * Render an untrusted value for an error message. Never throws, for any
 * input — validatePattern's whole contract is that it returns problems
 * instead of throwing, and these values come straight from `JSON.parse`
 * output or arbitrary in-memory objects, so none of them can be trusted to
 * stringify cleanly. A hostile Proxy can make essentially any property
 * access throw (including the `[[Get]]` for `toJSON` inside
 * `JSON.stringify`, or for `Symbol.toStringTag` inside
 * `Object.prototype.toString`), so the outer try/catch — not the individual
 * operations inside it — is what actually makes this total.
 */
function describe(value: unknown): string {
  try {
    if (typeof value === 'string') return JSON.stringify(value);
    if (value === null || value === undefined) return String(value);
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value) ?? UNPRINTABLE;
      } catch {
        return Object.prototype.toString.call(value);
      }
    }
    // Numbers, booleans, functions, symbols, bigints. JSON.stringify would
    // return undefined for a function or symbol, so fall through to String.
    return String(value);
  } catch {
    return UNPRINTABLE;
  }
}

/**
 * Check a value against the Pattern format.
 *
 * Returns every problem found, phrased for a person: 1-based indices, the
 * offending value quoted. An empty array means the value is a valid Pattern.
 * Never throws, for any input whatsoever — a revoked Proxy, a value with
 * hostile traps on every internal method, anything. `inspect` does the real
 * work; this function's only job is to be the guarantee.
 */
export function validatePattern(value: unknown): string[] {
  try {
    return inspect(value);
  } catch {
    return ['pattern could not be inspected'];
  }
}

/**
 * The actual Pattern-format checks. Not exported: `validatePattern` is the
 * total, never-throws boundary, and this is everything behind it — a bare
 * `Array.isArray` or property access here can still throw on a sufficiently
 * hostile value (e.g. a revoked Proxy), and that's fine, because the outer
 * function catches it.
 */
function inspect(value: unknown): string[] {
  const problems: string[] = [];

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['pattern must be an object'];
  }
  const pattern = value as Record<string, unknown>;

  if (pattern.version !== 1) {
    problems.push(`unsupported version ${describe(pattern.version)}, expected 1`);
  }

  const palette = Array.isArray(pattern.palette) ? (pattern.palette as unknown[]) : null;
  if (!palette) problems.push('palette must be an array of colours');

  const cards = Array.isArray(pattern.cards) ? (pattern.cards as unknown[]) : null;
  if (!cards) {
    problems.push('cards must be an array');
    return problems;
  }

  if (cards.length < MIN_CARDS) {
    problems.push(`a band needs at least ${MIN_CARDS} cards, found ${cards.length}`);
  }
  if (cards.length > MAX_CARDS) {
    problems.push(`a band takes at most ${MAX_CARDS} cards, found ${cards.length}`);
  }

  cards.forEach((raw, index) => {
    const label = `card ${index + 1}`;
    if (typeof raw !== 'object' || raw === null) {
      problems.push(`${label} must be an object`);
      return;
    }
    const card = raw as Record<string, unknown>;

    const colors = Array.isArray(card.colors) ? (card.colors as unknown[]) : null;
    if (!colors || colors.length !== HOLE_COUNT) {
      problems.push(`${label} must have ${HOLE_COUNT} holes, found ${colors?.length ?? 0}`);
    } else if (palette) {
      colors.forEach((color, hole) => {
        if (typeof color !== 'number' || color < 0 || color >= palette.length) {
          problems.push(
            `${label}, hole ${HOLE_LABELS[hole]}: colour ${describe(color)} is not in the palette`,
          );
        }
      });
    }

    if (card.threading !== 'S' && card.threading !== 'Z') {
      problems.push(`${label}: threading must be S or Z, found ${describe(card.threading)}`);
    }
    if (typeof card.start !== 'number' || card.start < 0 || card.start > 3) {
      problems.push(`${label}: start must be 0-3, found ${describe(card.start)}`);
    }
  });

  const picks = Array.isArray(pattern.picks) ? (pattern.picks as unknown[]) : null;
  if (!picks) {
    problems.push('picks must be an array');
    return problems;
  }

  picks.forEach((raw, pick) => {
    if (!Array.isArray(raw)) {
      problems.push(`pick ${pick + 1} must be an array of turns`);
      return;
    }
    if (raw.length !== cards.length) {
      problems.push(
        `pick ${pick + 1} has ${raw.length} turns but the band has ${cards.length} cards`,
      );
    }
    raw.forEach((turn, cardIndex) => {
      if (turn !== 1 && turn !== -1) {
        problems.push(
          `pick ${pick + 1}, card ${cardIndex + 1}: turn must be 1 or -1, found ${describe(turn)}`,
        );
      }
    });
  });

  return problems;
}
