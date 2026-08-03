import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { WeaveBar } from '../../src/weave/WeaveBar.js';
import { useStore } from '../../src/state/store.js';

describe('WeaveBar', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.getState().reset();
    useStore.getState().setMode('weave');
  });

  it('shows the current pick, one-indexed', () => {
    render(<WeaveBar />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows an arrow per card', () => {
    render(<WeaveBar />);
    const cards = useStore.getState().pattern.cards.length;
    expect(screen.getAllByRole('img', { name: /turn/i })).toHaveLength(cards);
  });

  it('advances and goes back', async () => {
    const user = userEvent.setup();
    render(<WeaveBar />);
    await user.click(screen.getByRole('button', { name: /next pick/i }));
    expect(useStore.getState().currentPick).toBe(1);
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(useStore.getState().currentPick).toBe(0);
  });

  it('stops at the last pick', async () => {
    const user = userEvent.setup();
    const last = useStore.getState().pattern.picks.length - 1;
    useStore.getState().setCurrentPick(last);
    render(<WeaveBar />);
    await user.click(screen.getByRole('button', { name: /next pick/i }));
    expect(useStore.getState().currentPick).toBe(last);
  });

  it('remembers the position across a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<WeaveBar />);
    await user.click(screen.getByRole('button', { name: /next pick/i }));
    await user.click(screen.getByRole('button', { name: /next pick/i }));
    unmount();

    useStore.getState().setCurrentPick(0);
    render(<WeaveBar />);
    expect(useStore.getState().currentPick).toBe(2);
  });

  it('keeps position separate from the pattern, so editing does not lose your place', () => {
    useStore.getState().setCurrentPick(5);
    useStore.getState().apply((draft) => { draft.meta.name = 'edited'; }, 'rename');
    expect(useStore.getState().currentPick).toBe(5);
  });
});
