import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App.js';
import { useStore } from '../../src/state/store.js';

describe('Screen mode toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.getState().reset();
  });

  it('starts in design mode, with no weave bar', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Design' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Weave' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /next pick/i })).not.toBeInTheDocument();
  });

  it('switches to weave mode and shows the weave bar', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Weave' }));

    expect(useStore.getState().mode).toBe('weave');
    expect(screen.getByRole('button', { name: 'Weave' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /next pick/i })).toBeInTheDocument();
  });

  it('switches back to design mode and hides the weave bar', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Weave' }));
    await user.click(screen.getByRole('button', { name: 'Design' }));

    expect(useStore.getState().mode).toBe('design');
    expect(screen.queryByRole('button', { name: /next pick/i })).not.toBeInTheDocument();
  });
});
