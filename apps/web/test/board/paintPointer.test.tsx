import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

const cell = (pick: number, card: number) =>
  screen.getByLabelText(new RegExp(`Card ${card + 1}, pick ${pick + 1},`));

describe('painting with the pointer', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().setMode('paint');
  });

  it('paints a run in one gesture and one undo entry', async () => {
    const user = userEvent.setup();
    useStore.getState().setBrush(2);
    render(<Board />);

    await user.pointer([
      { target: cell(0, 1), keys: '[MouseLeft>]' },
      { target: cell(1, 1) },
      { target: cell(2, 1) },
      { keys: '[/MouseLeft]' },
    ]);

    const { pattern } = useStore.getState();
    expect(pattern.target![0]![1]).toBe(2);
    expect(pattern.target![1]![1]).toBe(2);
    expect(pattern.target![2]![1]).toBe(2);

    useStore.getState().undo();
    expect(useStore.getState().pattern.target).toBeUndefined();
  });

  it('erases with the null brush', async () => {
    const user = userEvent.setup();
    useStore.getState().setBrush(2);
    render(<Board />);
    await user.click(cell(0, 1));
    expect(useStore.getState().pattern.target![0]![1]).toBe(2);

    useStore.getState().setBrush(null);
    await user.click(cell(0, 1));
    expect(useStore.getState().pattern.target).toBeUndefined();
  });

  it('leaves the turns alone while painting', async () => {
    const user = userEvent.setup();
    const before = structuredClone(useStore.getState().pattern.picks);
    useStore.getState().setBrush(1);
    render(<Board />);

    await user.click(cell(0, 1));

    expect(useStore.getState().pattern.picks).toEqual(before);
  });
});
