import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CardStepper } from '../../src/board/CardStepper.js';
import { useStore } from '../../src/state/store.js';

describe('CardStepper', () => {
  beforeEach(() => useStore.getState().reset());

  it('shows the current card count', () => {
    render(<CardStepper onAdded={() => {}} />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('adds an S card', async () => {
    const user = userEvent.setup();
    render(<CardStepper onAdded={() => {}} />);
    await user.click(screen.getByRole('button', { name: /add an S-threaded card/i }));
    expect(useStore.getState().pattern.cards).toHaveLength(9);
  });

  it('opens the editor for the card it just added', async () => {
    const user = userEvent.setup();
    let opened: number | null = null;
    render(<CardStepper onAdded={(index) => { opened = index; }} />);
    await user.click(screen.getByRole('button', { name: /add a Z-threaded card/i }));
    expect(opened).not.toBeNull();
    expect(useStore.getState().pattern.cards[opened!]!.threading).toBe('Z');
  });

  it('disables removal at four cards', async () => {
    const user = userEvent.setup();
    render(<CardStepper onAdded={() => {}} />);
    const remove = screen.getByRole('button', { name: /remove a card/i });
    for (let i = 0; i < 4; i++) await user.click(remove);
    expect(useStore.getState().pattern.cards).toHaveLength(4);
    expect(remove).toBeDisabled();
  });

  // The count and its noun sit in separate elements for styling, but they read
  // as one phrase — and Polish inflects the noun across the range this control
  // covers. 8 is `many` ('tabliczek'), 4 is `few` ('tabliczki'), and the
  // invariant genitive plural this used to render was wrong for the second.
  it('inflects the Polish noun for the count beside it', async () => {
    const user = userEvent.setup();
    useStore.getState().setLocale('pl');
    render(<CardStepper onAdded={() => {}} />);
    expect(screen.getByText('tabliczek')).toBeInTheDocument();

    const remove = screen.getByRole('button', { name: 'Usuń jedną tabliczkę' });
    for (let i = 0; i < 4; i++) await user.click(remove);

    expect(useStore.getState().pattern.cards).toHaveLength(4);
    expect(screen.getByText('tabliczki')).toBeInTheDocument();
    useStore.getState().setLocale('en');
  });

  it('disables adding at forty cards', async () => {
    const user = userEvent.setup();
    render(<CardStepper onAdded={() => {}} />);
    const add = screen.getByRole('button', { name: /add an S-threaded card/i });
    for (let i = 0; i < 40; i++) if (!(add as HTMLButtonElement).disabled) await user.click(add);
    expect(useStore.getState().pattern.cards).toHaveLength(40);
    expect(add).toBeDisabled();
  });
});
