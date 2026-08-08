import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardChip } from '../../src/board/CardChip.js';
import { useStore } from '../../src/state/store.js';
import type { useT } from '../../src/i18n/useT.js';

// This suite exercises the editor-opening wiring, not translated text, so a
// stub stands in for the real `useT()` — Board is what owns the one live
// subscription; CardChip only ever receives `t` as a prop.
const t = ((key: string) => key) as ReturnType<typeof useT>;

describe('CardChip wiring to the card editor', () => {
  beforeEach(() => useStore.getState().reset());

  it('opens the editor for its own index on click', async () => {
    const user = userEvent.setup();
    const { pattern } = useStore.getState();
    render(
      <CardChip
        card={pattern.cards[2]!}
        index={2}
        count={pattern.cards.length}
        pickCount={pattern.picks.length}
        vertical
        landmark={false}
        color="hsl(0 0% 0%)"
        palette={pattern.palette}
        t={t}
      />,
    );
    await user.click(screen.getByRole('button'));
    expect(useStore.getState().editingCard).toBe(2);
  });

  it('opens the editor after a ~450ms press without movement', () => {
    vi.useFakeTimers();
    const { pattern } = useStore.getState();
    render(
      <CardChip
        card={pattern.cards[3]!}
        index={3}
        count={pattern.cards.length}
        pickCount={pattern.picks.length}
        vertical
        landmark={false}
        color="hsl(0 0% 0%)"
        palette={pattern.palette}
        t={t}
      />,
    );
    const chip = screen.getByRole('button');
    fireEvent.pointerDown(chip);
    expect(useStore.getState().editingCard).toBeNull();
    vi.advanceTimersByTime(500);
    expect(useStore.getState().editingCard).toBe(3);
    vi.useRealTimers();
  });

  it('cancels the long-press timer once the pointer moves', () => {
    vi.useFakeTimers();
    const { pattern } = useStore.getState();
    render(
      <CardChip
        card={pattern.cards[3]!}
        index={3}
        count={pattern.cards.length}
        pickCount={pattern.picks.length}
        vertical
        landmark={false}
        color="hsl(0 0% 0%)"
        palette={pattern.palette}
        t={t}
      />,
    );
    const chip = screen.getByRole('button');
    fireEvent.pointerDown(chip);
    fireEvent.pointerMove(chip);
    vi.advanceTimersByTime(500);
    expect(useStore.getState().editingCard).toBeNull();
    vi.useRealTimers();
  });

  it('cancels the long-press timer on pointer up (a quick tap does not double-fire oddly)', () => {
    vi.useFakeTimers();
    const { pattern } = useStore.getState();
    render(
      <CardChip
        card={pattern.cards[3]!}
        index={3}
        count={pattern.cards.length}
        pickCount={pattern.picks.length}
        vertical
        landmark={false}
        color="hsl(0 0% 0%)"
        palette={pattern.palette}
        t={t}
      />,
    );
    const chip = screen.getByRole('button');
    fireEvent.pointerDown(chip);
    fireEvent.pointerUp(chip);
    vi.advanceTimersByTime(500);
    // The click event (fired separately by real interaction) is what opens
    // it for a quick tap; the long-press timer itself must not still be
    // pending after pointerup.
    expect(useStore.getState().editingCard).toBeNull();
    vi.useRealTimers();
  });
});
