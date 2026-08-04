import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Chart } from '../../src/chart/Chart.js';
import { useStore } from '../../src/state/store.js';

describe('Chart', () => {
  beforeEach(() => useStore.getState().reset());

  it('renders a table row per pick', () => {
    render(<Chart />);
    const table = screen.getByRole('table', { name: /turning chart/i });
    expect(within(table).getAllByRole('row')).toHaveLength(
      useStore.getState().pattern.picks.length + 1,
    ); // + header
  });

  it('shows an arrow per card per pick', () => {
    render(<Chart />);
    const table = screen.getByRole('table', { name: /turning chart/i });
    const firstBodyRow = within(table).getAllByRole('row')[1]!;
    expect(within(firstBodyRow).getAllByRole('cell')).toHaveLength(
      useStore.getState().pattern.cards.length + 1,
    ); // + pick number
  });

  it('states direction as text, not colour alone', () => {
    render(<Chart />);
    expect(screen.getAllByTitle(/forward|backward/i).length).toBeGreaterThan(0);
  });

  it('summarises threads by colour', () => {
    render(<Chart />);
    const summary = screen.getByRole('region', { name: /summary/i });
    expect(summary).toHaveTextContent(/32 warp ends/i);
    expect(summary).toHaveTextContent(/8 cards/i);
  });

  it('warns about accumulated twist', () => {
    render(<Chart />);
    // The default band turns forward 24 times: every card is at +24.
    expect(screen.getByRole('region', { name: /summary/i })).toHaveTextContent(/24/);
  });
});
