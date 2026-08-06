import { advance, holeAt } from './conventions.js';
import { simulate } from './simulate.js';
import { HOLE_COUNT } from './types.js';
import type { Card, Cell, Pattern, Rotation, TargetGrid, Turn } from './types.js';

/**
 * Turn a simulated band into a solver target.
 *
 * A target encodes colour only — lean is an output of weaving (it falls out
 * of threading and turn direction), never something a caller asks for. This
 * is the conversion every caller feeding `simulate`'s output back into
 * `solveTurns` needs, so it exists once instead of as a `.map((row) =>
 * row.map((cell) => cell.color))` repeated at every call site.
 */
export function targetOf(grid: Cell[][]): TargetGrid {
  return grid.map((row) => row.map((cell) => cell.color));
}

/**
 * `card` and `pick` are 0-based, for code — contrast with validatePattern's
 * 1-based prose, which is for people. Don't "fix" one to match the other.
 */
export interface Unreachable {
  card: number;
  pick: number;
  wanted: number;
}

export interface SolveResult {
  picks: Turn[][];
  unreachable: Unreachable[];
}

export interface SolveOptions {
  /** Existing turns, used to break ties toward the pattern the user already has. */
  previous?: Turn[][];
}

const TURNS: Turn[] = [1, -1];

/**
 * A mismatch always outweighs any number of tie-break penalties: the
 * tie-break adds at most 1 per pick, so this only needs to exceed the
 * longest band anyone will ever solve. It holds below 1,000,000 picks.
 */
const MISMATCH = 1_000_000;

/**
 * Find the turn sequence that produces `target`, with threading held fixed.
 *
 * Cards do not interact in threaded-in weaving, so this decomposes into one
 * independent problem per card: a shortest path over 4 rotation states by
 * however many picks, two edges out of each state. Exact, and linear in picks.
 */
export function solveTurns(
  cards: Card[],
  target: TargetGrid,
  options: SolveOptions = {},
): SolveResult {
  const pickCount = target.length;
  const picks: Turn[][] = Array.from({ length: pickCount }, () =>
    cards.map(() => 1 as Turn),
  );
  const unreachable: Unreachable[] = [];

  cards.forEach((card, cardIndex) => {
    const solved = solveCard(card, cardIndex, target, options.previous);
    solved.turns.forEach((turn, pick) => {
      picks[pick]![cardIndex] = turn;
    });
    unreachable.push(...solved.unreachable);
  });

  return { picks, unreachable };
}

interface CardSolution {
  turns: Turn[];
  unreachable: Unreachable[];
}

function solveCard(
  card: Card,
  cardIndex: number,
  target: TargetGrid,
  previous?: Turn[][],
): CardSolution {
  const pickCount = target.length;
  if (pickCount === 0) return { turns: [], unreachable: [] };

  // cost[r] = best cost of arriving at rotation r after the current pick.
  let cost: number[] = new Array(HOLE_COUNT).fill(Number.POSITIVE_INFINITY);
  const from: Array<Array<Rotation | null>> = [];
  const via: Array<Array<Turn | null>> = [];

  // Seed from the card's fixed start rotation.
  const seedCost: number[] = new Array(HOLE_COUNT).fill(Number.POSITIVE_INFINITY);
  const seedFrom: Array<Rotation | null> = new Array(HOLE_COUNT).fill(null);
  const seedVia: Array<Turn | null> = new Array(HOLE_COUNT).fill(null);

  for (const turn of TURNS) {
    const next = advance(card.start, turn);
    const c = stepCost(card, cardIndex, 0, next, turn, target, previous);
    if (c < seedCost[next]!) {
      seedCost[next] = c;
      seedFrom[next] = card.start;
      seedVia[next] = turn;
    }
  }
  cost = seedCost;
  from.push(seedFrom);
  via.push(seedVia);

  for (let pick = 1; pick < pickCount; pick++) {
    const nextCost: number[] = new Array(HOLE_COUNT).fill(Number.POSITIVE_INFINITY);
    const nextFrom: Array<Rotation | null> = new Array(HOLE_COUNT).fill(null);
    const nextVia: Array<Turn | null> = new Array(HOLE_COUNT).fill(null);

    for (let r = 0; r < HOLE_COUNT; r++) {
      if (!Number.isFinite(cost[r]!)) continue;
      for (const turn of TURNS) {
        const next = advance(r as Rotation, turn);
        const c = cost[r]! + stepCost(card, cardIndex, pick, next, turn, target, previous);
        if (c < nextCost[next]!) {
          nextCost[next] = c;
          nextFrom[next] = r as Rotation;
          nextVia[next] = turn;
        }
      }
    }
    cost = nextCost;
    from.push(nextFrom);
    via.push(nextVia);
  }

  // Backtrack from the cheapest final rotation.
  let best: Rotation = 0;
  for (let r = 1; r < HOLE_COUNT; r++) {
    if (cost[r]! < cost[best]!) best = r as Rotation;
  }

  const turns: Turn[] = new Array(pickCount);
  let rotation = best;
  for (let pick = pickCount - 1; pick >= 0; pick--) {
    turns[pick] = via[pick]![rotation]!;
    rotation = from[pick]![rotation]!;
  }

  // Report what the winning path could not match.
  const unreachable: Unreachable[] = [];
  let pos: Rotation = card.start;
  for (let pick = 0; pick < pickCount; pick++) {
    pos = advance(pos, turns[pick]!);
    const wanted = target[pick]![cardIndex];
    if (wanted === null || wanted === undefined) continue;
    if (card.colors[holeAt(pos, card.threading)] !== wanted) {
      unreachable.push({ card: cardIndex, pick, wanted });
    }
  }

  return { turns, unreachable };
}

function stepCost(
  card: Card,
  cardIndex: number,
  pick: number,
  rotation: Rotation,
  turn: Turn,
  target: TargetGrid,
  previous?: Turn[][],
): number {
  const wanted = target[pick]?.[cardIndex];
  let cost = 0;
  if (wanted !== null && wanted !== undefined) {
    if (card.colors[holeAt(rotation, card.threading)] !== wanted) cost += MISMATCH;
  }
  const previousTurn = previous?.[pick]?.[cardIndex];
  if (previousTurn !== undefined && previousTurn !== turn) {
    cost += 1;
  }
  return cost;
}

export interface TargetReport {
  /**
   * Cells the card's minimum-mismatch turn sequence does not satisfy —
   * either the card carries no hole in that colour, or showing it here
   * would cost a mismatch at another painted pick on the same card and the
   * solver took the cheaper trade. This is a claim about the column, not
   * about the cell in isolation: in the second case the colour *is*
   * showable there, just not alongside everything else asked of that card.
   * Re-solving will not help either way; the fix is a different hole
   * colour, a different threading, or asking for less.
   */
  unreachable: Unreachable[];
  /** Cells where the band simply disagrees with the target. Solve fixes these. */
  unmet: Unreachable[];
}

/**
 * Split every band-vs-target disagreement into the two kinds a weaver can
 * act on.
 *
 * The two look identical on the board and are not the same problem: after a
 * solve they coincide, but flipping a turn in Design mode afterwards makes a
 * cell unmet without making it unreachable. Linear in cells, so callers
 * recompute it rather than caching an answer that can go stale.
 */
export function reportTarget(pattern: Pattern): TargetReport {
  const target = pattern.target;
  if (target === undefined) return { unreachable: [], unmet: [] };

  const band = simulate(pattern);
  const solved = solveTurns(pattern.cards, target, { previous: pattern.picks });
  const blocked = new Set(solved.unreachable.map((cell) => `${cell.pick}:${cell.card}`));

  const unmet: Unreachable[] = [];
  target.forEach((row, pick) => {
    row.forEach((wanted, card) => {
      if (wanted === null) return;
      if (blocked.has(`${pick}:${card}`)) return;
      if (band[pick]?.[card]?.color === wanted) return;
      unmet.push({ card, pick, wanted });
    });
  });

  return { unreachable: solved.unreachable, unmet };
}
