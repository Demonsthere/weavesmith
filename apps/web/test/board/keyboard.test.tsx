import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

const cell = (pick: number, card: number) =>
  screen.getByLabelText(new RegExp(`Card ${card + 1}, pick ${pick + 1},`));

async function focusBoard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText(/Card 1, pick 1,/));
}

describe('keyboard binding', () => {
  beforeEach(() => useStore.getState().reset());

  it('moves focus with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(useStore.getState().selection.focus).toEqual({ pick: 1, card: 1 });
  });

  // Arrows are spatial: they move the focus in the direction pressed, so
  // they swap axes with the layout. In the horizontal band, cards run
  // downward, so Down moves to the next card, not the next pick.
  it('swaps the arrow axes with orientation so Down moves the way it points', async () => {
    const user = userEvent.setup();
    useStore.getState().setOrientation('horizontal');
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{ArrowDown}');
    expect(useStore.getState().selection.focus.card).toBe(1);
    expect(useStore.getState().selection.focus.pick).toBe(0);
  });

  // The jump keys are semantic, not spatial, and do not swap: PageDown is
  // always five picks, in either orientation.
  it('keeps the jump keys semantic — PageDown is five picks in either orientation', async () => {
    const user = userEvent.setup();
    useStore.getState().setOrientation('horizontal');
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{PageDown}');
    expect(useStore.getState().selection.focus.pick).toBe(5);
    expect(useStore.getState().selection.focus.card).toBe(0);
  });

  // Shift+arrow extension swaps axes too, not just plain arrows: extending
  // "downward" in horizontal orientation extends across cards.
  it('swaps shift+arrow extension axes with orientation too', async () => {
    const user = userEvent.setup();
    useStore.getState().setOrientation('horizontal');
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
    expect(useStore.getState().selection.anchor).toEqual({ pick: 0, card: 0 });
    expect(useStore.getState().selection.focus).toEqual({ pick: 0, card: 2 });
  });

  it('extends the selection with shift and arrows', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
    expect(useStore.getState().selection.anchor).toEqual({ pick: 0, card: 0 });
    expect(useStore.getState().selection.focus).toEqual({ pick: 2, card: 0 });
  });

  it('jumps five picks with PageDown', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{PageDown}');
    expect(useStore.getState().selection.focus.pick).toBe(5);
  });

  it('flips the selection with Space', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    const before = useStore.getState().pattern.picks[0]![0];
    await user.keyboard(' ');
    expect(useStore.getState().pattern.picks[0]![0]).toBe(-before!);
  });

  it('sets direction with F and B, idempotently', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('bb');
    expect(useStore.getState().pattern.picks[0]![0]).toBe(-1);
    await user.keyboard('f');
    expect(useStore.getState().pattern.picks[0]![0]).toBe(1);
  });

  it('collapses the selection with Escape', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}{Escape}');
    const { selection } = useStore.getState();
    expect(selection.anchor).toEqual(selection.focus);
  });

  it('undoes and redoes', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    const before = useStore.getState().pattern.picks[0]![0];
    await user.keyboard(' ');
    await user.keyboard('{Control>}z{/Control}');
    expect(useStore.getState().pattern.picks[0]![0]).toBe(before);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(useStore.getState().pattern.picks[0]![0]).toBe(-before!);
  });

  it('announces refusals in a live region', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('3'); // hole C: two turns away, unreachable
    expect(screen.getByRole('status')).toHaveTextContent(/unreachable/i);
  });

  // --- Extra verification beyond the brief's own tests ---------------------

  it('undo/redo via keyboard match calling the store directly', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard(' '); // one edit to undo
    const viaStoreUndo = structuredClone(useStore.getState().pattern);
    useStore.getState().undo();
    const afterStoreUndo = useStore.getState().pattern;

    useStore.getState().redo(); // put the edit back so the keyboard path starts identically
    await user.keyboard('{Control>}z{/Control}');
    expect(useStore.getState().pattern).toEqual(afterStoreUndo);
    void viaStoreUndo;
  });

  it('names the refused cell in the live region message', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.keyboard('3');
    expect(screen.getByRole('status')).toHaveTextContent(/card 1 pick 1/i);
  });

  it('preventDefault fires for every handled key (Space, arrows, PageUp/PageDown, Home/End)', () => {
    render(<Board />);
    const target = cell(0, 0); // already the sole tabIndex=0 cell on a fresh board
    target.focus();

    const keys = [
      ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'PageUp', 'PageDown', 'Home', 'End', 'Escape',
    ];
    for (const key of keys) {
      const notPrevented = fireEvent.keyDown(target, { key });
      expect(notPrevented).toBe(false); // fireEvent returns false when preventDefault was called
    }
  });

  it('keeps exactly one tabbable cell after a keyboard move (roving tabindex)', async () => {
    const user = userEvent.setup();
    const { container } = render(<Board />);
    await focusBoard(user);
    await user.keyboard('{ArrowDown}');
    const tabbable = container.querySelectorAll('.cell[tabindex="0"]');
    expect(tabbable).toHaveLength(1);
  });

  it('Tab from the focused cell leaves the grid rather than moving to the next cell', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await focusBoard(user);
    await user.tab();
    const cells = screen.getAllByRole('gridcell');
    expect(cells).not.toContain(document.activeElement);
  });
});
