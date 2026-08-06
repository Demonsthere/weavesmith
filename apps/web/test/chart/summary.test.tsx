import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
