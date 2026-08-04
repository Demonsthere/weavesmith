import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App.js';
import { useStore } from '../../src/state/store.js';

// The chart is a second screen, not a panel inside the board — the plan's
// global constraints pin it to hash routing (`#/board`, `#/chart`) because
// GitHub Pages serves no SPA rewrites, so a real path would 404 on reload.
describe('hash routing', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    useStore.getState().reset();
  });

  it('shows the board when there is no hash', () => {
    render(<App />);
    expect(screen.getByRole('grid', { name: /weaving board/i })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /turning chart/i })).not.toBeInTheDocument();
  });

  it('deep-links straight to the chart', () => {
    window.history.replaceState(null, '', '#/chart');
    render(<App />);
    expect(screen.getByRole('table', { name: /turning chart/i })).toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: /weaving board/i })).not.toBeInTheDocument();
  });

  it('navigates to the chart and back from the nav links', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: /chart/i }));
    await waitFor(() =>
      expect(screen.getByRole('table', { name: /turning chart/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('link', { name: /board/i }));
    await waitFor(() =>
      expect(screen.getByRole('grid', { name: /weaving board/i })).toBeInTheDocument(),
    );
  });

  it('marks the current screen for assistive tech', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('link', { name: /board/i })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(screen.getByRole('link', { name: /chart/i }));
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /chart/i })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
    expect(screen.getByRole('link', { name: /board/i })).not.toHaveAttribute('aria-current');
  });

  it('treats an unrecognised hash as the board', () => {
    // Task 11 puts share payloads on the hash as `#p=<encoded>`; that must
    // land on the board, not on a blank screen.
    window.history.replaceState(null, '', '#p=whatever');
    render(<App />);
    expect(screen.getByRole('grid', { name: /weaving board/i })).toBeInTheDocument();
  });
});
