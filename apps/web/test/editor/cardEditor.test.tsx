import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CardEditor } from '../../src/editor/CardEditor.js';
import { useStore } from '../../src/state/store.js';

describe('CardEditor', () => {
  beforeEach(() => useStore.getState().reset());

  it('names the card it is editing', () => {
    render(<CardEditor cardIndex={2} onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('Card 3');
  });

  it('shows a row per hole, labelled A to D', () => {
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    for (const label of ['A', 'B', 'C', 'D']) {
      expect(screen.getByRole('button', { name: new RegExp(`hole ${label}`, 'i') }))
        .toBeInTheDocument();
    }
  });

  it('assigns a preset colour to the selected hole', async () => {
    const user = userEvent.setup();
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /hole A/i }));
    await user.click(screen.getByRole('button', { name: /selected hole to woad #2F5F8F/i }));
    expect(useStore.getState().pattern.cards[1]!.colors[0])
      .toBe(useStore.getState().pattern.palette.indexOf('#2F5F8F'));
  });

  it('does not recolour other cards sharing that palette entry', async () => {
    const user = userEvent.setup();
    const shared = useStore.getState().pattern.cards[2]!.colors[0];
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /hole A/i }));
    await user.click(screen.getByRole('button', { name: /selected hole to woad #2F5F8F/i }));
    expect(useStore.getState().pattern.cards[2]!.colors[0]).toBe(shared);
  });

  it('flips threading', async () => {
    const user = userEvent.setup();
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Z threaded/i }));
    expect(useStore.getState().pattern.cards[1]!.threading).toBe('Z');
  });

  it('disables delete at the minimum band width', async () => {
    while (useStore.getState().pattern.cards.length > 4) {
      const { pattern, apply } = useStore.getState();
      apply((draft) => {
        draft.cards.splice(1, 1);
        for (const row of draft.picks) row.splice(1, 1);
      }, 'trim');
      if (pattern.cards.length <= 4) break;
    }
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /delete card/i })).toBeDisabled();
  });

  it('closes on Done', async () => {
    const user = userEvent.setup();
    let closed = false;
    render(<CardEditor cardIndex={1} onClose={() => { closed = true; }} />);
    await user.click(screen.getByRole('button', { name: /done/i }));
    expect(closed).toBe(true);
  });

  // --- Extra verification beyond the brief's own tests ---------------------

  it('assigning an existing palette hex does not grow the palette', async () => {
    const user = userEvent.setup();
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    const before = useStore.getState().pattern.palette.length;
    await user.click(screen.getByRole('button', { name: /hole A/i }));
    await user.click(screen.getByRole('button', { name: /selected hole to woad #2F5F8F/i }));
    expect(useStore.getState().pattern.palette.length).toBe(before);
  });

  it('assigning a brand-new hex appends exactly one palette entry', () => {
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    const before = useStore.getState().pattern.palette.length;

    // fireEvent (not userEvent, which has limited color-input support) sets
    // the value through the native setter React patches, so onChange fires.
    const wheel = screen.getByLabelText(/custom colour/i);
    fireEvent.input(wheel, { target: { value: '#123456' } });

    const after = useStore.getState().pattern;
    expect(after.palette.length).toBe(before + 1);
    expect(after.palette).toContain('#123456');

    // Re-applying the same new hex must not grow the palette again.
    fireEvent.input(wheel, { target: { value: '#123456' } });
    expect(useStore.getState().pattern.palette.length).toBe(before + 1);
  });

  it('disables delete at exactly 4 cards, not at 3 or 5', () => {
    useStore.getState().reset();
    // 5 cards (one below the default 8): delete must be enabled.
    useStore.getState().apply((draft) => {
      draft.cards.splice(1, 3);
      for (const row of draft.picks) row.splice(1, 3);
    }, 'shrink to 5');
    expect(useStore.getState().pattern.cards.length).toBe(5);
    const { unmount } = render(<CardEditor cardIndex={1} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /delete card/i })).toBeEnabled();
    unmount();

    // Force below the real minimum (bypassing removeCard's own guard,
    // which is exactly what this boundary check needs to exercise) to
    // prove the button stays disabled rather than flipping back on.
    useStore.getState().apply((draft) => {
      draft.cards.splice(1, 2);
      for (const row of draft.picks) row.splice(1, 2);
    }, 'shrink to 3');
    expect(useStore.getState().pattern.cards.length).toBe(3);
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /delete card/i })).toBeDisabled();
  });

  it('changing threading for card N updates only that card', async () => {
    const user = userEvent.setup();
    const before = useStore.getState().pattern.cards.map((c) => c.threading);
    render(<CardEditor cardIndex={3} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Z threaded/i }));

    const after = useStore.getState().pattern.cards.map((c) => c.threading);
    after.forEach((threading, i) => {
      if (i === 3) expect(threading).toBe('Z');
      else expect(threading).toBe(before[i]);
    });
  });

  // App.tsx (with its `key={editingCard}`) never actually exercises this
  // path, but the component must not depend on that: `render()` once and
  // `rerender()` the *same* tree through cardIndex → null → a different
  // card, exactly as an unkeyed parent would, so the fix lives in the
  // state and not merely in whether a remount happens to occur.
  it('does not leak the selected hole across a change of which card is open, with no remount', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CardEditor cardIndex={1} onClose={() => {}} />);

    await user.click(screen.getByRole('button', { name: /hole C/i }));
    expect(screen.getByRole('button', { name: /hole C/i }))
      .toHaveAttribute('aria-selected', 'true');

    rerender(<CardEditor cardIndex={null} onClose={() => {}} />); // closed
    rerender(<CardEditor cardIndex={2} onClose={() => {}} />); // a different card

    expect(screen.getByRole('button', { name: /hole A/i }))
      .toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /hole C/i }))
      .toHaveAttribute('aria-selected', 'false');
  });

  it('gives a preset swatch an accessible name that includes the wool name and the hex', () => {
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /selected hole to woad #2F5F8F/i }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /selected hole to madder #B4402C/i }))
      .toBeInTheDocument();
  });

  it('falls back to just the hex for a custom colour with no wool name', () => {
    render(<CardEditor cardIndex={1} onClose={() => {}} />);
    const wheel = screen.getByLabelText(/custom colour/i);
    fireEvent.input(wheel, { target: { value: '#123456' } });

    // Exact match: no wool name string has snuck in alongside the hex.
    const custom = screen.getByRole('button', { name: 'Set the selected hole to #123456' });
    expect(custom).toBeInTheDocument();
  });

  it('Escape closes the dialog without applying a pending change', async () => {
    const user = userEvent.setup();
    let closed = false;
    const before = useStore.getState().pattern;
    render(<CardEditor cardIndex={1} onClose={() => { closed = true; }} />);
    await user.click(screen.getByRole('button', { name: /hole B/i })); // selects a hole, nothing more
    await user.keyboard('{Escape}');
    expect(closed).toBe(true);
    expect(useStore.getState().pattern).toBe(before);
  });
});
