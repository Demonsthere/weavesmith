import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { Chart } from '../../src/chart/Chart.js';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

const source = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('the coffee QR on the chart', () => {
  beforeEach(() => useStore.getState().reset());

  it('rides along on the chart sheet', () => {
    // Paper is the one place a QR earns its keep: this sheet leaves the
    // screen for the loom, a craft fair table, or another weaver's hands,
    // and scanning is the only way across from there.
    render(<Chart />);
    expect(screen.getByRole('img', { name: /buycoffee|coffee/i })).toBeInTheDocument();
  });

  it('prints the address as text too, for anyone without a phone to hand', () => {
    render(<Chart />);
    const note = screen.getByTestId('chart-qr');
    expect(note).toHaveTextContent('buycoffee.to/demonsthere');
  });

  it('stays off the screen, where a QR is useless', () => {
    // The reader is already on the device. A code they would have to scan
    // with a second phone is decoration, so it is print-only.
    render(<Chart />);
    expect(screen.getByTestId('chart-qr').className).toMatch(/print-only/);
  });

  it('never appears on the board', () => {
    render(<Board />);
    expect(screen.queryByRole('img', { name: /buycoffee|coffee/i })).not.toBeInTheDocument();
  });

  it('is hidden on screen and revealed for print by the stylesheet', () => {
    // CSS imports are stubbed to "" under this project's vitest config, so
    // the rule cannot be observed through the DOM — read it off disk
    // instead, the same way the card editor's button styling is checked.
    const print = source('../../src/styles/print.css');
    expect(print).toMatch(/\.print-only\s*\{[^}]*display:\s*none/);

    // Asserted before slicing: without this, losing the `@media print`
    // block would make `indexOf` return -1, slice the last character, and
    // fail with a message about a regex rather than about the missing
    // block.
    const printBlockStart = print.indexOf('@media print');
    expect(printBlockStart).toBeGreaterThan(-1);

    // `revert` rather than `block` so the class stays safe on inline and
    // table elements; what matters is that print un-hides what screen hid.
    expect(print.slice(printBlockStart)).toMatch(
      /\.print-only\s*\{[^}]*display:\s*revert/,
    );
  });

  it('serves the code from our own origin', () => {
    // Same reasoning as the footer logo: no third-party request, and the
    // chart has to print from a laptop with no network at a loom.
    render(<Chart />);
    const image = within(screen.getByTestId('chart-qr')).getByRole('img');
    expect(image.getAttribute('src')).not.toMatch(/^https?:/);
  });
});
