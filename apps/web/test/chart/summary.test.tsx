import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { simulate } from '@weavesmith/core';
import { Summary } from '../../src/chart/Summary.js';
import { useStore } from '../../src/state/store.js';

describe('Summary', () => {
  // Regression: the translated `summary.counts` key used to flatten both
  // counted phrases into one plain string, silently dropping the <strong>
  // that distinguishes "measure these two numbers" from the surrounding
  // prose on the printed sheet's first, most load-bearing line. Nothing
  // asserted on the markup before, only the text, which is exactly how that
  // went unnoticed.
  it('bolds the two counted numbers on the summary line', () => {
    useStore.getState().reset();
    render(<Summary />);
    expect(screen.getByText('8 cards', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('32 warp ends', { selector: 'strong' })).toBeInTheDocument();
  });

  // The twist figure is a number of turns, and the sentence has to say so —
  // the Polish rendering had no word for it at all, because the noun was
  // hard-coded into the English sentence and `summary.turns`, which carries
  // the three Polish forms, was used nowhere.
  it('names what the twist figure counts', () => {
    useStore.getState().reset();
    render(<Summary />);
    // The default band turns forward on all 24 picks: every card is at +24.
    expect(screen.getByText('Every card ends at +24 turns after 24 picks.')).toBeInTheDocument();
  });

  it('keeps the sign and still inflects the noun when the twist is negative', () => {
    useStore.getState().reset();
    useStore.getState().apply((draft) => {
      draft.picks = [draft.cards.map(() => -1 as const), draft.cards.map(() => -1 as const)];
    }, 'test');
    render(<Summary />);
    expect(screen.getByText('Every card ends at -2 turns after 2 picks.')).toBeInTheDocument();
  });

  it('counts the turns on each card when the twist is not uniform', () => {
    useStore.getState().reset();
    useStore.getState().apply((draft) => {
      draft.picks = [draft.cards.map((_, card) => (card === 0 ? -1 : 1) as -1 | 1)];
    }, 'test');
    render(<Summary />);
    expect(screen.getByText('Card 1: -1 turn')).toBeInTheDocument();
    expect(screen.getByText('Card 2: +1 turn')).toBeInTheDocument();
  });

  it('counts unreachable and unmet cells when a target exists', () => {
    useStore.getState().reset();
    // Madder on card 0, which is threaded all-walnut: unreachable by
    // construction.
    useStore.getState().apply((draft) => {
      draft.target = draft.picks.map(() => draft.cards.map(() => null));
      draft.target[0]![0] = 1;
    }, 'test');

    render(<Summary />);

    expect(screen.getByText(/1 cell unreachable/)).toBeInTheDocument();
  });

  it('says nothing about targets when nothing is painted', () => {
    useStore.getState().reset();
    render(<Summary />);
    expect(screen.queryByText(/unreachable/)).not.toBeInTheDocument();
  });

  // A painting the band already satisfies still has something to say: "all of
  // it" is the answer a weaver is looking for after a Solve, and a section
  // that vanishes reads exactly like the one that was never painted.
  it('still reports when the band already matches the target', () => {
    useStore.getState().reset();
    useStore.getState().apply((draft) => {
      const band = simulate(draft);
      draft.target = draft.picks.map(() => draft.cards.map(() => null));
      draft.target[0]![0] = band[0]![0]!.color;
    }, 'test');

    render(<Summary />);

    expect(screen.getByText(/0 cells unreachable/)).toBeInTheDocument();
    expect(screen.getByText(/0 cells unmet/)).toBeInTheDocument();
  });
});
