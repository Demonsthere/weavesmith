import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulate } from '@weavesmith/core';
import type { Turn } from '@weavesmith/core';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

const cell = (pick: number, card: number) =>
  screen.getByLabelText(new RegExp(`Card ${card + 1}, pick ${pick + 1},`));

describe('painting with the keyboard', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().setMode('paint');
  });

  it('chooses the brush with a digit', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(cell(0, 0));
    await user.keyboard('3');
    expect(useStore.getState().brush).toBe(2);
  });

  it('refuses a digit past the end of the palette', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(cell(0, 0));
    const size = useStore.getState().pattern.palette.length;
    expect(size).toBeLessThan(9);

    await user.keyboard('9');

    expect(useStore.getState().brush).toBe(0);
    expect(screen.getByRole('status')).toHaveTextContent(`${size} colours`);
  });

  it('paints the selection with Enter and clears it with Backspace', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(cell(0, 0));
    await user.keyboard('{Escape}{Shift>}{ArrowDown}{/Shift}2{Enter}');

    expect(useStore.getState().pattern.target![0]![0]).toBe(1);
    expect(useStore.getState().pattern.target![1]![0]).toBe(1);

    await user.keyboard('{Backspace}');
    expect(useStore.getState().pattern.target).toBeUndefined();
  });

  it('solves with Ctrl+Enter', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(cell(1, 3));

    // Card 3, not card 0: card 0 is threaded all-walnut, so no colour it can
    // show would change anything. `wanted` is a *palette* index — the digit
    // that selects it is one higher — and it is the colour the other turn at
    // this pick would show, so it is reachable by construction.
    const before = useStore.getState().pattern;
    const flipped = structuredClone(before);
    flipped.picks[1]![3] = -flipped.picks[1]![3]! as Turn;
    const wanted = simulate(flipped)[1]![3]!.color;
    expect(wanted).not.toBe(simulate(before)[1]![3]!.color);
    expect(wanted + 1).toBeLessThanOrEqual(9);

    await user.keyboard(`${wanted + 1}{Enter}{Control>}{Enter}{/Control}`);

    expect(useStore.getState().pattern.picks).not.toEqual(before.picks);
    expect(simulate(useStore.getState().pattern)[1]![3]!.color).toBe(wanted);
    expect(screen.getByRole('status')).toHaveTextContent(/Solved/);
  });

  it('leaves the Design-mode keys alone', async () => {
    const user = userEvent.setup();
    useStore.getState().setMode('design');
    render(<Board />);
    await user.click(cell(0, 0));
    await user.keyboard('2');

    // Digit 2 is setHole B in Design mode: turns change, target does not exist.
    expect(useStore.getState().pattern.target).toBeUndefined();
    expect(useStore.getState().brush).toBe(0);
  });
});
