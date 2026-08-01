import { HOLE_COUNT, HOLE_LABELS, MAX_CARDS, MIN_CARDS } from './types.js';

/**
 * Render an untrusted value for an error message. Never throws, even if the
 * value's `toString` or `Symbol.toPrimitive` does — validatePattern's whole
 * contract is that it returns problems instead of throwing, and these values
 * come straight from `JSON.parse` output or arbitrary in-memory objects, so
 * none of them can be trusted to stringify cleanly.
 */
function describe(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value) ?? Object.prototype.toString.call(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
  try {
    return String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/**
 * Check a value against the Pattern format.
 *
 * Returns every problem found, phrased for a person: 1-based indices, the
 * offending value quoted. An empty array means the value is a valid Pattern.
 */
export function validatePattern(value: unknown): string[] {
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
