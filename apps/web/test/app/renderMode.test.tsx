import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App.js';
import { useStore } from '../../src/state/store.js';

describe('Render mode toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.getState().reset();
  });

  it('starts on woven, and the board renders in woven mode', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Woven' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Dots' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('grid', { name: 'Weaving board' })).toHaveClass('mode-woven');
  });

  it('switches the board to dots', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Dots' }));

    expect(useStore.getState().render).toBe('dots');
    expect(screen.getByRole('button', { name: 'Dots' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('grid', { name: 'Weaving board' })).toHaveClass('mode-dots');
  });

  it('switches back to woven', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Dots' }));
    await user.click(screen.getByRole('button', { name: 'Woven' }));

    expect(useStore.getState().render).toBe('woven');
    expect(screen.getByRole('grid', { name: 'Weaving board' })).toHaveClass('mode-woven');
  });

  it('is a labelled group, so the two toggles are distinguishable', () => {
    render(<App />);
    expect(screen.getByRole('group', { name: 'Render mode' })).toBeInTheDocument();
  });
});
