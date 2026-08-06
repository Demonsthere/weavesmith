import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { simulate } from '@weavesmith/core';
import { Summary } from '../../src/chart/Summary.js';
import { useStore } from '../../src/state/store.js';

describe('Summary', () => {
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
