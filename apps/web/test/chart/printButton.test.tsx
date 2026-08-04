import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chart } from '../../src/chart/Chart.js';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';
import { printCss } from '../printCss.js';

const printButton = () => screen.getByRole('button', { name: /print|pdf/i });

describe('the print button', () => {
  beforeEach(() => useStore.getState().reset());
  afterEach(() => vi.restoreAllMocks());

  it('is on the chart screen', () => {
    // Hunting through a browser menu for "print to PDF" is awkward on a
    // phone, which is exactly where a weaver is most likely to want the
    // chart on paper.
    render(<Chart />);
    expect(printButton()).toBeInTheDocument();
  });

  it('prints when tapped', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<Chart />);

    await user.click(printButton());

    expect(print).toHaveBeenCalledTimes(1);
  });

  it('is reachable from the keyboard, like every other command', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<Chart />);

    printButton().focus();
    await user.keyboard('{Enter}');

    expect(print).toHaveBeenCalled();
  });

  it('says it saves a PDF too, since that is what a phone does with it', () => {
    render(<Chart />);
    expect(printButton()).toHaveAccessibleName(/pdf/i);
  });

  it('keeps itself off the printed sheet', () => {
    // A print button that prints itself is a small joke at the weaver's
    // expense. CSS imports are stubbed to "" here, so the rule is read off
    // disk rather than observed through the DOM.
    render(<Chart />);
    expect(printButton().closest('.screen-only')).not.toBeNull();

    expect(printCss().printBlock).toMatch(/\.screen-only[^{]*\{[^}]*display:\s*none/);
  });

  it('does not appear on the board', () => {
    render(<Board />);
    expect(screen.queryByRole('button', { name: /print|pdf/i })).not.toBeInTheDocument();
  });
});
