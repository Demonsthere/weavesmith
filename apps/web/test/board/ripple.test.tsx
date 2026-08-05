import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Cell } from '@weavesmith/core';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';
import { rippleCells, RIPPLE_MS, STAGGER_MS } from '../../src/board/useRipple.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

const cell = (pick: number, card: number) =>
  screen.getByLabelText(new RegExp(`Card ${card + 1}, pick ${pick + 1},`));

/** A band of `picks` × `cards` identical cells, to diff against. */
const band = (picks: number, cards: number): Cell[][] =>
  Array.from({ length: picks }, () =>
    Array.from({ length: cards }, () => ({ color: 0, lean: '/' }) as Cell));

describe('rippleCells', () => {
  it('marks nothing when the band did not change', () => {
    expect(rippleCells(band(4, 3), band(4, 3)).size).toBe(0);
  });

  it('marks a changed cell, and staggers by distance from the first change', () => {
    const before = band(4, 3);
    const after = band(4, 3);
    // A flip at pick 1 of card 1: that cell's lean turns over, and two
    // cells further down show a different thread.
    after[1]![1] = { color: 0, lean: '\\' };
    after[2]![1] = { color: 2, lean: '/' };
    after[3]![1] = { color: 3, lean: '/' };

    const ripple = rippleCells(before, after);
    expect([...ripple.keys()].sort()).toEqual(['1:1', '2:1', '3:1']);
    expect(ripple.get('1:1')).toBe(0);
    expect(ripple.get('2:1')).toBe(STAGGER_MS);
    expect(ripple.get('3:1')).toBe(STAGGER_MS * 2);
  });

  it('staggers each column from its own first change', () => {
    const before = band(4, 3);
    const after = band(4, 3);
    after[0]![0] = { color: 1, lean: '/' };
    after[2]![2] = { color: 1, lean: '/' };
    after[3]![2] = { color: 1, lean: '/' };

    const ripple = rippleCells(before, after);
    expect(ripple.get('0:0')).toBe(0);
    expect(ripple.get('2:2')).toBe(0);
    expect(ripple.get('3:2')).toBe(STAGGER_MS);
  });

  it('marks nothing when the band changed shape', () => {
    // Adding or removing a card renumbers every column after it, so a
    // cell-by-cell diff would claim half the board changed. It did not —
    // the band was rebuilt, which is not a ripple.
    expect(rippleCells(band(4, 3), band(4, 4)).size).toBe(0);
    expect(rippleCells(band(4, 3), band(5, 3)).size).toBe(0);
  });
});

describe('the ripple on the board', () => {
  // Real timers throughout: the pulse is 260ms plus its stagger, so waiting
  // it out costs less than a second, and userEvent's own timing does not
  // have to be reconciled with a fake clock.
  beforeEach(() => useStore.getState().reset());

  it('pulses the edited cell and its column below it', async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.click(cell(2, 1));

    expect(cell(2, 1)).toHaveClass('rippling');
    // Untouched columns stay still — the ripple runs down one card.
    expect(cell(2, 2)).not.toHaveClass('rippling');
  });

  it('delays each cell so the pulse travels down the band', async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.click(cell(0, 1));

    expect(cell(0, 1).querySelector('.note')).toHaveStyle({ animationDelay: '0ms' });
  });

  it('stops rippling once the pulse is over, so the next edit animates too', async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.click(cell(2, 1));
    expect(cell(2, 1)).toHaveClass('rippling');

    await waitFor(
      () => expect(cell(2, 1)).not.toHaveClass('rippling'),
      { timeout: RIPPLE_MS + STAGGER_MS * 40 + 500 },
    );
  });

  it('does not pulse when a different document is loaded', async () => {
    render(<Board />);

    const other = defaultPattern();
    other.picks = other.picks.map((row) => row.map((turn) => -turn as typeof turn));
    await act(async () => {
      useStore.getState().load(other);
    });

    expect(cell(2, 1)).not.toHaveClass('rippling');
  });

  it('drops a ripple still in flight when a different document is loaded', async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.click(cell(2, 1));
    expect(cell(2, 1)).toHaveClass('rippling');

    const other = defaultPattern();
    other.picks = other.picks.map((row) => row.map((turn) => -turn as typeof turn));
    await act(async () => {
      useStore.getState().load(other);
    });

    // Nothing left marked: the cells belong to a different band now, and a
    // class that never came off would stop the *next* edit animating them.
    expect(cell(2, 1)).not.toHaveClass('rippling');
  });

  it('drops a ripple still in flight when the band changes shape', async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.click(cell(2, 1));
    expect(cell(2, 1)).toHaveClass('rippling');

    await act(async () => {
      useStore.getState().apply((draft) => {
        draft.cards.splice(1, 0, structuredClone(draft.cards[1]!));
        for (const row of draft.picks) row.splice(1, 0, 1);
      }, 'Add card');
    });

    expect(cell(2, 1)).not.toHaveClass('rippling');
  });
});
