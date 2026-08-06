import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulate } from '@weavesmith/core';
import type { Turn } from '@weavesmith/core';
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

describe('paint-mode parity', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().setMode('paint');
  });

  it('paints the same target by drag and by keyboard', async () => {
    const user = userEvent.setup();
    useStore.getState().setBrush(2);

    const { unmount } = render(<Board />);
    await user.pointer([
      { target: cell(0, 1), keys: '[MouseLeft>]' },
      { target: cell(1, 1) },
      { target: cell(2, 1) },
      { keys: '[/MouseLeft]' },
    ]);
    const byPointer = structuredClone(useStore.getState().pattern);
    unmount();

    useStore.getState().reset();
    useStore.getState().setMode('paint');
    render(<Board />);
    await user.click(cell(0, 1));
    await user.keyboard('{Escape}{Shift>}{ArrowDown}{ArrowDown}{/Shift}3{Enter}');
    const byKeyboard = useStore.getState().pattern;

    expect(byKeyboard.target).toEqual(byPointer.target);
    expect(byKeyboard).toEqual(byPointer);
  });

  it('reaches every paint command from every binding', async () => {
    const user = userEvent.setup();
    render(<Board />);

    // paintTarget — keyboard
    await user.click(cell(0, 0));
    await user.keyboard('2{Enter}');
    expect(useStore.getState().pattern.target![0]![0]).toBe(1);

    // clearTarget — keyboard
    await user.keyboard('{Backspace}');
    expect(useStore.getState().pattern.target).toBeUndefined();

    // paintTarget — pointer
    useStore.getState().setBrush(1);
    await user.click(cell(0, 0));
    expect(useStore.getState().pattern.target![0]![0]).toBe(1);

    // clearTarget — pointer (erase brush). The pointer's equivalent of
    // Backspace: the point is that the *command* is reachable from both, not
    // that the gesture is spelled the same way.
    useStore.getState().setBrush(null);
    await user.click(cell(0, 0));
    expect(useStore.getState().pattern.target).toBeUndefined();

    // solveTarget — keyboard chord. Its pointer route is the Solve button in
    // BrushStrip, covered by test/paint/brushStrip.test.tsx — it is chrome,
    // not a board gesture.
    //
    // Card 3, not card 0: card 0 is threaded all-walnut, so every colour but
    // walnut is unreachable on it and a solve that changes nothing would be
    // the *correct* answer — which would make this assertion pass for the
    // wrong reason, or fail for one. `wanted` is the colour the other turn at
    // this pick would show, so it is reachable by construction.
    const beforeSolve = structuredClone(useStore.getState().pattern.picks);
    const flipped = structuredClone(useStore.getState().pattern);
    flipped.picks[1]![3] = -flipped.picks[1]![3]! as Turn;
    const wanted = simulate(flipped)[1]![3]!.color;

    await user.click(cell(1, 3));
    await user.keyboard(`${wanted + 1}{Enter}{Control>}{Enter}{/Control}`);

    expect(useStore.getState().pattern.picks).not.toEqual(beforeSolve);
    expect(simulate(useStore.getState().pattern)[1]![3]!.color).toBe(wanted);
  });
});
