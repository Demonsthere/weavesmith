import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Chart } from '../../src/chart/Chart.js';
import { useStore } from '../../src/state/store.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';
import { printCss } from '../printCss.js';

/** Where each landmark sits in the rendered sheet, top to bottom. */
function orderOf(...testIds: string[]): string[] {
  const sheet = screen.getByTestId('chart-sheet');
  const found = [...sheet.querySelectorAll('[data-testid]')]
    .map((node) => node.getAttribute('data-testid')!)
    .filter((id) => testIds.includes(id));
  return found;
}

describe('the printed sheet', () => {
  beforeEach(() => useStore.getState().reset());

  it('names the band, not just the app', () => {
    // A printed chart that does not say which band it is cannot be filed,
    // handed to anyone, or matched back to the JSON it came from.
    render(<Chart />);
    expect(screen.getByTestId('chart-masthead')).toHaveTextContent('Chevron');
  });

  it('carries the app name too', () => {
    render(<Chart />);
    expect(screen.getByTestId('chart-masthead')).toHaveTextContent(/weavesmith/i);
  });

  it('follows the band when it is renamed', () => {
    useStore.getState().load({ ...defaultPattern(), meta: { name: 'Snartemo' } });
    render(<Chart />);
    expect(screen.getByTestId('chart-masthead')).toHaveTextContent('Snartemo');
  });

  it('puts the QR in the masthead, not adrift mid-document', () => {
    // It was landing at the top of page two, between the chart and the
    // threading table, which is the one place it interrupts rather than
    // closes.
    const masthead = screen.queryByTestId('chart-masthead');
    render(<Chart />);
    expect(masthead).toBeNull();
    expect(
      within(screen.getByTestId('chart-masthead')).getByRole('img', { name: /buycoffee/i }),
    ).toBeInTheDocument();
  });

  it('orders the sheet the way the work happens', () => {
    // You warp the cards before you weave them, so threading comes before
    // the turning chart. Summary first, because it is what you measure out
    // before either.
    render(<Chart />);
    expect(orderOf('chart-masthead', 'chart-summary', 'chart-threading', 'chart-turning')).toEqual([
      'chart-masthead',
      'chart-summary',
      'chart-threading',
      'chart-turning',
    ]);
  });

  it('hides the app chrome banner in print, since the masthead replaces it', () => {
    expect(printCss().printBlock).toMatch(
      /header\[role=['"]banner['"]\][^{]*\{[^}]*display:\s*none/,
    );
  });

  it('keeps the wordmark its own colour on paper', () => {
    // The print block forces a light theme and had flattened --accent to
    // black, which stripped the wordmark of the one bit of identity it has.
    expect(printCss().printBlock).not.toMatch(/--accent:\s*#000000/);
  });
});
