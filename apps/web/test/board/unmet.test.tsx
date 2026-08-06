import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulate } from '@weavesmith/core';
import type { Turn } from '@weavesmith/core';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

const cell = (pick: number, card: number) =>
  screen.getByLabelText(new RegExp(`Card ${card + 1}, pick ${pick + 1},`));

const MADDER = 1;

/**
 * Ask for madder on card 0, which is threaded all-walnut — so this is
 * unreachable by construction, not by luck.
 */
function paintUnreachable() {
  useStore.getState().apply((draft) => {
    draft.target = draft.picks.map(() => draft.cards.map(() => null));
    draft.target[0]![0] = MADDER;
  }, 'test');
}

/**
 * Ask card 3 (four distinct colours) for the colour the *other* turn at pick
 * 1 would show, without changing the turns. Reachable, and not what the band
 * currently shows — so it is unmet-but-solvable.
 */
function paintUnmet() {
  const before = useStore.getState().pattern;
  const flipped = structuredClone(before);
  flipped.picks[1]![3] = -flipped.picks[1]![3]! as Turn;
  const wanted = simulate(flipped)[1]![3]!.color;
  expect(wanted).not.toBe(simulate(before)[1]![3]!.color);

  useStore.getState().apply((draft) => {
    draft.target = draft.picks.map(() => draft.cards.map(() => null));
    draft.target[1]![3] = wanted;
  }, 'test');
  return wanted;
}

describe('unmet cells', () => {
  beforeEach(() => useStore.getState().reset());

  it('marks an unreachable cell and names it for a screen reader', () => {
    paintUnreachable();
    render(<Board />);

    expect(cell(0, 0).className).toContain('unmet');
    expect(cell(0, 0).getAttribute('aria-label')).toMatch(/wanted .*unreachable/i);
  });

  it('tells a solvable disagreement apart from an unreachable one', () => {
    paintUnmet();
    render(<Board />);

    expect(cell(1, 3).className).toContain('unmet');
    expect(cell(1, 3).getAttribute('aria-label')).toMatch(/press Solve/i);
    expect(cell(1, 3).getAttribute('aria-label')).not.toMatch(/unreachable/i);
  });

  it('carries no marks in weave mode', () => {
    paintUnreachable();
    useStore.getState().setMode('weave');
    render(<Board />);

    expect(cell(0, 0).className).not.toContain('unmet');
  });

  it('draws the painted colour in paint mode', () => {
    paintUnreachable();
    useStore.getState().setMode('paint');
    render(<Board />);

    const { palette } = useStore.getState().pattern;
    const note = cell(0, 0).querySelector('.note') as HTMLElement;
    // jsdom normalises a hex background to rgb(), so compare loosely: the
    // note must not be showing walnut, which is what the band weaves there.
    expect(note.style.background).not.toBe(palette[0]);
    expect(cell(0, 0).className).toContain('painted');
    expect(cell(0, 1).className).toContain('unpainted');
  });
});
