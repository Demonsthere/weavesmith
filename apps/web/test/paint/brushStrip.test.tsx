import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { BrushStrip } from '../../src/paint/BrushStrip.js';
import { useStore } from '../../src/state/store.js';

describe('BrushStrip', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().setMode('paint');
    useStore.getState().setSelection({
      anchor: { pick: 0, card: 0 },
      focus: { pick: 1, card: 0 },
    });
  });

  it('shows one swatch per palette entry, plus erase', () => {
    render(<BrushStrip />);
    const { palette } = useStore.getState().pattern;
    expect(screen.getAllByRole('button', { name: /brush/i })).toHaveLength(palette.length + 1);
  });

  it('sets the brush and paints the selection in one click', async () => {
    const user = userEvent.setup();
    render(<BrushStrip />);

    await user.click(screen.getAllByRole('button', { name: /brush/i })[1]!);

    expect(useStore.getState().brush).toBe(1);
    expect(useStore.getState().pattern.target![0]![0]).toBe(1);
    expect(useStore.getState().pattern.target![1]![0]).toBe(1);
  });

  it('erases with the erase brush', async () => {
    const user = userEvent.setup();
    render(<BrushStrip />);
    await user.click(screen.getAllByRole('button', { name: /brush/i })[1]!);
    await user.click(screen.getByRole('button', { name: /erase/i }));

    expect(useStore.getState().brush).toBeNull();
    expect(useStore.getState().pattern.target).toBeUndefined();
  });

  it('reports the solve, and keeps the report on screen', async () => {
    const user = userEvent.setup();
    render(<BrushStrip />);
    await user.click(screen.getAllByRole('button', { name: /brush/i })[1]!);
    await user.click(screen.getByRole('button', { name: 'Solve' }));

    expect(screen.getByRole('status')).toHaveTextContent(/Solved|unreachable/);
  });

  it('marks the active brush pressed', async () => {
    const user = userEvent.setup();
    render(<BrushStrip />);
    const second = screen.getAllByRole('button', { name: /brush/i })[1]!;
    await user.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
  });
});
