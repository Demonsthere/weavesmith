import { describe, expect, it } from 'vitest';
import { simulate, validatePattern } from '@weavesmith/core';
import type { Card, Threading, Turn } from '@weavesmith/core';
import {
  addCard, clearTarget, paintTarget, removeCard, removalIndex, runCommand, setHole, setHoleColor,
  setThreading, setTurn, solveTarget, toggleTurn,
} from '../../src/state/commands.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

const cell = (pick: number, card: number) => ({ focus: { pick, card }, anchor: { pick, card } });
const rect = (t0: number, c0: number, t1: number, c1: number) =>
  ({ focus: { pick: t1, card: c1 }, anchor: { pick: t0, card: c0 } });

describe('toggleTurn', () => {
  it('flips one cell', () => {
    const pattern = defaultPattern();
    const before = pattern.picks[3]![2]!;
    const { pattern: after } = toggleTurn(pattern, cell(3, 2));
    expect(after.picks[3]![2]).toBe(-before);
  });

  it('flips every cell in a rectangle', () => {
    const pattern = defaultPattern();
    const { pattern: after } = toggleTurn(pattern, rect(1, 1, 3, 3));
    for (let t = 1; t <= 3; t++) {
      for (let c = 1; c <= 3; c++) expect(after.picks[t]![c]).toBe(-pattern.picks[t]![c]!);
    }
  });

  it('leaves cells outside the selection alone', () => {
    const pattern = defaultPattern();
    const { pattern: after } = toggleTurn(pattern, cell(3, 2));
    expect(after.picks[3]![1]).toBe(pattern.picks[3]![1]);
    expect(after.picks[4]![2]).toBe(pattern.picks[4]![2]);
  });
});

describe('setTurn', () => {
  it('is idempotent', () => {
    const pattern = defaultPattern();
    const once = setTurn(pattern, rect(0, 0, 5, 3), -1).pattern;
    const twice = setTurn(once, rect(0, 0, 5, 3), -1).pattern;
    expect(twice.picks).toEqual(once.picks);
  });

  it('reports how many cells it changed', () => {
    const pattern = defaultPattern();
    const { message } = setTurn(pattern, rect(0, 0, 1, 1), -1);
    expect(message).toMatch(/4 cells/);
  });
});

describe('setHole', () => {
  it('shows the requested hole when it is reachable', () => {
    const pattern = defaultPattern();
    // From start 0, one turn reaches rotation 1 (hole B) or 3 (hole D).
    const { pattern: after } = setHole(pattern, cell(0, 1), 1);
    const band = simulate(after);
    expect(band[0]![1]!.color).toBe(after.cards[1]!.colors[1]);
  });

  it('refuses by name when the hole is unreachable', () => {
    const pattern = defaultPattern();
    // Hole C is two turns away from rotation 0: unreachable on the first pick.
    const { message } = setHole(pattern, cell(0, 1), 2);
    expect(message).toMatch(/unreachable/i);
    expect(message).toMatch(/card 2/);
  });

  it('applies to the reachable cells even when some are refused', () => {
    const pattern = defaultPattern();
    const { pattern: after, message } = setHole(pattern, rect(0, 1, 3, 3), 1);
    expect(after).not.toEqual(pattern);
    expect(message).toMatch(/set to hole B/);
  });
});

describe('setThreading', () => {
  it('sets every selected card', () => {
    const pattern = defaultPattern();
    const { pattern: after } = setThreading(pattern, rect(0, 0, 0, 3), 'Z');
    expect(after.cards.slice(0, 4).every((c) => c.threading === 'Z')).toBe(true);
  });
});

describe('addCard', () => {
  it('lands an S card at the end of the S block', () => {
    const pattern = defaultPattern();
    const { result, index } = addCard(pattern, 'S');
    expect(result.pattern.cards[index]!.threading).toBe('S');
    expect(result.pattern.cards[index - 1]!.threading).toBe('S');
  });

  it('lands a Z card at the start of the Z block', () => {
    const pattern = defaultPattern();
    const { result, index } = addCard(pattern, 'Z');
    expect(result.pattern.cards[index]!.threading).toBe('Z');
    expect(result.pattern.cards[index + 1]!.threading).toBe('Z');
  });

  it('keeps the pick matrix rectangular', () => {
    const { result } = addCard(defaultPattern(), 'S');
    for (const row of result.pattern.picks) {
      expect(row).toHaveLength(result.pattern.cards.length);
    }
  });

  it('inherits colours from its neighbour rather than arriving blank', () => {
    const pattern = defaultPattern();
    const { result, index } = addCard(pattern, 'S');
    expect(result.pattern.cards[index]!.colors).toEqual(pattern.cards[index - 1]!.colors);
  });

  it('refuses past forty cards', () => {
    let pattern = defaultPattern();
    while (pattern.cards.length < 40) pattern = addCard(pattern, 'S').result.pattern;
    const { result } = addCard(pattern, 'S');
    expect(result.pattern.cards).toHaveLength(40);
    expect(result.message).toMatch(/at most 40/);
  });
});

describe('removeCard', () => {
  it('removes the card and its column of turns', () => {
    const pattern = defaultPattern();
    const { pattern: after } = removeCard(pattern, 2);
    expect(after.cards).toHaveLength(pattern.cards.length - 1);
    for (const row of after.picks) expect(row).toHaveLength(after.cards.length);
  });

  it('refuses below four cards', () => {
    let pattern = defaultPattern();
    while (pattern.cards.length > 4) pattern = removeCard(pattern, 1).pattern;
    const { pattern: after, message } = removeCard(pattern, 1);
    expect(after.cards).toHaveLength(4);
    expect(message).toMatch(/at least 4/);
  });
});

describe('removalIndex', () => {
  const bandOf = (threadings: Threading[]): Card[] =>
    threadings.map((threading) => ({ colors: [0, 0, 0, 0], threading, start: 0 }));

  it('on an all-S band, takes from just inside the trailing edge, never the border card', () => {
    const cards = bandOf(['S', 'S', 'S', 'S', 'S']);
    const index = removalIndex(cards);
    expect(index).toBe(3);
    expect(index).not.toBe(0);
    expect(index).not.toBe(cards.length - 1);
  });

  it('on a mirrored S-then-Z band, takes from just inside the S/Z boundary', () => {
    // Mirrors defaultPattern(): 4 S cards then 4 Z cards, boundary at index 4.
    const cards = bandOf(['S', 'S', 'S', 'S', 'Z', 'Z', 'Z', 'Z']);
    expect(removalIndex(cards)).toBe(4);
  });

  it('never removes a border card, across every S/Z split and band length', () => {
    for (let length = 5; length <= 12; length++) {
      for (let split = 0; split <= length; split++) {
        const threadings: Threading[] = Array.from(
          { length },
          (_, i) => (i < split ? 'S' : 'Z'),
        );
        const cards = bandOf(threadings);
        const index = removalIndex(cards);
        expect(index).toBeGreaterThan(0);
        expect(index).toBeLessThan(cards.length - 1);
      }
    }
  });
});

describe('setHoleColor', () => {
  it('points the hole at an existing palette entry rather than adding a duplicate', () => {
    const pattern = defaultPattern();
    const hex = pattern.palette[2]!;
    const { pattern: after } = setHoleColor(pattern, 1, 0, hex);
    expect(after.palette).toHaveLength(pattern.palette.length);
    expect(after.cards[1]!.colors[0]).toBe(2);
  });

  it('adds a new palette entry for a colour the band does not have', () => {
    const pattern = defaultPattern();
    const { pattern: after } = setHoleColor(pattern, 1, 0, '#123456');
    expect(after.palette).toContain('#123456');
    expect(after.cards[1]!.colors[0]).toBe(after.palette.indexOf('#123456'));
  });

  it('never recolours another card that shares the entry', () => {
    const pattern = defaultPattern();
    const sharedBefore = pattern.cards[2]!.colors[0];
    const { pattern: after } = setHoleColor(pattern, 1, 0, '#123456');
    expect(after.cards[2]!.colors[0]).toBe(sharedBefore);
    expect(after.palette[sharedBefore!]).toBe(pattern.palette[sharedBefore!]);
  });
});

// --- Extra verification beyond the brief's own tests ---------------------
//
// Hand-worked parity check: every card in defaultPattern() starts at
// rotation 0. rotationBefore(pattern, pick, card) is the rotation *before*
// the turn at `pick` is applied.
//
//   pick 0: rotationBefore = 0 (the start). advance(0, +1) = 1, advance(0, -1) = 3.
//           Reachable holes for an S card: holeAt(1,'S')=1 (B), holeAt(3,'S')=3 (D).
//           So {B, D} reachable, {A, C} refused.
//   pick 1: with turn +1 at pick 0, rotationBefore = 1. advance(1,+1)=2, advance(1,-1)=0.
//           Reachable holes: holeAt(2,'S')=2 (C), holeAt(0,'S')=0 (A).
//           So {A, C} reachable, {B, D} refused — parity has flipped from pick 0.
describe('setHole parity (hand-worked)', () => {
  it('pick 0 on card 1 (S-threaded) reaches only B and D', () => {
    const pattern = defaultPattern();
    for (const hole of [1, 3] as const) {
      const { message } = setHole(pattern, cell(0, 1), hole);
      expect(message).not.toMatch(/unreachable/i);
    }
    for (const hole of [0, 2] as const) {
      const { message } = setHole(pattern, cell(0, 1), hole);
      expect(message).toMatch(/unreachable/i);
      expect(message).toMatch(/card 2/);
    }
  });

  it('pick 1 on card 1 reaches only A and C — the opposite parity from pick 0', () => {
    const pattern = defaultPattern();
    for (const hole of [0, 2] as const) {
      const { message } = setHole(pattern, cell(1, 1), hole);
      expect(message).not.toMatch(/unreachable/i);
    }
    for (const hole of [1, 3] as const) {
      const { message } = setHole(pattern, cell(1, 1), hole);
      expect(message).toMatch(/unreachable/i);
      expect(message).toMatch(/card 2/);
    }
  });
});

describe('boundary refusals return the pattern unchanged', () => {
  it('addCard at 40 cards returns the same pattern value, not a mutated clone', () => {
    let pattern = defaultPattern();
    while (pattern.cards.length < 40) pattern = addCard(pattern, 'S').result.pattern;
    const { result } = addCard(pattern, 'S');
    expect(result.pattern).toEqual(pattern);
    expect(result.pattern).toBe(pattern);
  });

  it('removeCard at 4 cards returns the same pattern value, not a mutated clone', () => {
    let pattern = defaultPattern();
    while (pattern.cards.length > 4) pattern = removeCard(pattern, 1).pattern;
    const { pattern: after } = removeCard(pattern, 1);
    expect(after).toEqual(pattern);
    expect(after).toBe(pattern);
  });
});

describe('every command leaves the pattern valid', () => {
  it('toggleTurn, setTurn, setHole, setThreading, addCard, removeCard, setHoleColor', () => {
    const base = defaultPattern();

    expect(validatePattern(toggleTurn(base, rect(0, 0, 3, 3)).pattern)).toEqual([]);
    expect(validatePattern(setTurn(base, rect(0, 0, 3, 3), -1).pattern)).toEqual([]);
    expect(validatePattern(setHole(base, rect(0, 0, 3, 3), 1).pattern)).toEqual([]);
    expect(validatePattern(setThreading(base, rect(0, 0, 0, 3), 'Z').pattern)).toEqual([]);
    expect(validatePattern(addCard(base, 'S').result.pattern)).toEqual([]);
    expect(validatePattern(removeCard(base, 2).pattern)).toEqual([]);
    expect(validatePattern(setHoleColor(base, 1, 0, '#123456').pattern)).toEqual([]);

    // Also valid at the boundaries, where these commands refuse and hand
    // back the pattern unchanged.
    let big = defaultPattern();
    while (big.cards.length < 40) big = addCard(big, 'S').result.pattern;
    expect(validatePattern(addCard(big, 'S').result.pattern)).toEqual([]);

    let small = defaultPattern();
    while (small.cards.length > 4) small = removeCard(small, 1).pattern;
    expect(validatePattern(removeCard(small, 1).pattern)).toEqual([]);
  });
});

const MADDER = 1;

describe('paintTarget', () => {
  it('creates the target lazily, filled with null', () => {
    const before = defaultPattern();
    expect(before.target).toBeUndefined();

    const { pattern: after, message } = paintTarget(before, cell(1, 2), MADDER);

    expect(after.target).toHaveLength(before.picks.length);
    expect(after.target![0]!).toHaveLength(before.cards.length);
    expect(after.target![1]![2]).toBe(MADDER);
    expect(after.target![0]![0]).toBeNull();
    expect(message).toBe('Painted 1 cell');
    // The command is pure: the pattern it was handed is untouched.
    expect(before.target).toBeUndefined();
  });

  it('paints every cell in the selection', () => {
    const { pattern: after } = paintTarget(defaultPattern(), rect(0, 0, 1, 1), MADDER);
    expect(after.target![0]![0]).toBe(MADDER);
    expect(after.target![0]![1]).toBe(MADDER);
    expect(after.target![1]![0]).toBe(MADDER);
    expect(after.target![1]![1]).toBe(MADDER);
  });
});

describe('clearTarget', () => {
  it('clears the selection back to null', () => {
    const painted = paintTarget(defaultPattern(), rect(0, 0, 1, 1), MADDER).pattern;
    const { pattern: after, message } = clearTarget(painted, cell(0, 0));
    expect(after.target![0]![0]).toBeNull();
    expect(after.target![1]![1]).toBe(MADDER);
    expect(message).toBe('Cleared 1 cell');
  });

  it('drops the target entirely once nothing is painted', () => {
    const painted = paintTarget(defaultPattern(), cell(0, 0), MADDER).pattern;
    const { pattern: after } = clearTarget(painted, cell(0, 0));
    expect(after.target).toBeUndefined();
  });

  it('is a no-op when nothing was ever painted', () => {
    const { pattern: after } = clearTarget(defaultPattern(), cell(0, 0));
    expect(after.target).toBeUndefined();
  });

  it('says nothing was painted rather than claiming to have cleared', () => {
    const { message } = clearTarget(defaultPattern(), cell(0, 0));
    expect(message).toBe('Nothing painted yet');
  });

  // Counts what changed, not what was selected — the same contract setTurn
  // reports against. A selection that is mostly bare should not read as work.
  it('counts only the cells that were actually painted', () => {
    const painted = paintTarget(defaultPattern(), cell(0, 0), MADDER).pattern;
    const { message } = clearTarget(painted, rect(0, 0, 1, 1));
    expect(message).toBe('Cleared 1 cell');
  });

  // Object.assign copies keys, it cannot remove one — so a command that drops
  // an optional field needs runCommand's help, or an erase gesture silently
  // leaves the old painting in the draft the bindings are editing.
  it('drops the target through runCommand too, not only when called directly', () => {
    const draft = paintTarget(defaultPattern(), cell(0, 0), MADDER).pattern;
    runCommand(draft, clearTarget, cell(0, 0));
    expect(draft.target).toBeUndefined();
  });
});

describe('solveTarget', () => {
  it('says so when nothing is painted', () => {
    const before = defaultPattern();
    const { pattern: after, message } = solveTarget(before);
    expect(message).toBe('Nothing painted yet');
    expect(after.picks).toEqual(before.picks);
  });

  it('writes the turns that produce the painted colour', () => {
    const before = defaultPattern();
    // The colour card 3 would show at pick 1 if that turn were the other
    // way. Reachable by construction — no assumption about which hole is
    // where — and different from what the band shows now, because card 3
    // carries four distinct colours.
    const flipped = structuredClone(before);
    flipped.picks[1]![3] = -flipped.picks[1]![3]! as Turn;
    const wanted = simulate(flipped)[1]![3]!.color;
    expect(wanted).not.toBe(simulate(before)[1]![3]!.color);

    const { pattern: after, message } = solveTarget(
      paintTarget(before, cell(1, 3), wanted).pattern,
    );

    expect(simulate(after)[1]![3]!.color).toBe(wanted);
    expect(message).toMatch(/^Solved 1 cell/);
  });

  it('names the cells it could not reach', () => {
    // Card 0 is all walnut (palette 0), so madder can never show on it.
    const painted = paintTarget(defaultPattern(), cell(0, 0), MADDER).pattern;

    const { message } = solveTarget(painted);

    expect(message).toContain('1 unreachable');
    expect(message).toContain('card 1 pick 1');
    expect(message).toMatch(/^Solved 0 cells/);
  });
});

describe('card add/remove with a target', () => {
  it('keeps target rows the same width as pick rows', () => {
    const painted = paintTarget(defaultPattern(), cell(0, 0), MADDER).pattern;

    const grown = addCard(painted, 'S').result.pattern;
    expect(grown.target![0]!).toHaveLength(grown.picks[0]!.length);

    const shrunk = removeCard(grown, removalIndex(grown.cards)).pattern;
    expect(shrunk.target![0]!).toHaveLength(shrunk.picks[0]!.length);
  });

  // An all-null grid and no grid mean the same thing, and only one of them
  // belongs in a saved file — the invariant paintTarget states and clearTarget
  // maintains. Removing the last painted column has to honour it too, or an
  // empty painting rides along in every autosave and share link.
  it('drops the target when removing a card empties it', () => {
    const painted = paintTarget(defaultPattern(), cell(0, 1), MADDER).pattern;

    const after = removeCard(painted, 1).pattern;

    expect(after.target).toBeUndefined();
  });

  it('keeps the target when removing a card leaves something painted', () => {
    let painted = paintTarget(defaultPattern(), cell(0, 1), MADDER).pattern;
    painted = paintTarget(painted, cell(0, 3), MADDER).pattern;

    const after = removeCard(painted, 1).pattern;

    expect(after.target![0]![2]).toBe(MADDER);
  });
});
