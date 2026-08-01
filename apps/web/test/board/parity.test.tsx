import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

const cell = (pick: number, card: number) =>
  screen.getByLabelText(new RegExp(`Card ${card + 1}, pick ${pick + 1},`));

describe('input parity', () => {
  beforeEach(() => useStore.getState().reset());

  it('produces the same pattern by drag and by keyboard', async () => {
    const user = userEvent.setup();

    // Pointer: drag down column 1 from pick 0 to pick 3.
    const { unmount } = render(<Board />);
    await user.pointer([
      { target: cell(0, 1), keys: '[MouseLeft>]' },
      { target: cell(1, 1) },
      { target: cell(2, 1) },
      { target: cell(3, 1) },
      { keys: '[/MouseLeft]' },
    ]);
    const byPointer = structuredClone(useStore.getState().pattern);
    unmount();

    // Keyboard: same span, same resulting direction.
    useStore.getState().reset();
    render(<Board />);
    await user.click(cell(0, 1));
    await user.keyboard('{Escape}{Shift>}{ArrowDown}{ArrowDown}{ArrowDown}{/Shift}');
    await user.keyboard(byPointer.picks[0]![1] === 1 ? 'f' : 'b');
    const byKeyboard = useStore.getState().pattern;

    expect(byKeyboard.picks).toEqual(byPointer.picks);
    // Beyond cell counts: this is a full structural comparison of the band,
    // not just "the same number of cells changed" — colours/leans/threading
    // all flow from `picks`, so this is the strongest single assertion that
    // the two paths produced byte-identical patterns.
    expect(byKeyboard).toEqual(byPointer);
  });
});
