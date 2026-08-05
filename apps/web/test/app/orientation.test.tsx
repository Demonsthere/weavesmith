import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App.js';
import { useStore } from '../../src/state/store.js';

/**
 * Sets the viewport width the automatic choice reads, the way a phone or a
 * narrowed window would. jsdom's default is 1024, which is a wide screen.
 */
function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
}

function resizeTo(width: number): void {
  act(() => {
    setViewportWidth(width);
    window.dispatchEvent(new Event('resize'));
  });
}

const board = () => screen.getByRole('grid', { name: 'Weaving board' });
const vertical = () => screen.getByRole('button', { name: 'Vertical band' });
const horizontal = () => screen.getByRole('button', { name: 'Horizontal band' });

describe('Orientation toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.getState().reset();
    setViewportWidth(1024);
  });

  it('is a labelled group, so it is distinguishable from the other toggles', () => {
    render(<App />);
    expect(screen.getByRole('group', { name: 'Orientation' })).toBeInTheDocument();
  });

  it('starts vertical on a wide viewport, and the board is laid out vertically', () => {
    render(<App />);
    expect(vertical()).toHaveAttribute('aria-pressed', 'true');
    expect(horizontal()).toHaveAttribute('aria-pressed', 'false');
    expect(board()).toHaveClass('v');
  });

  it('switches the board to horizontal', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(horizontal());

    expect(useStore.getState().orientation).toBe('horizontal');
    expect(horizontal()).toHaveAttribute('aria-pressed', 'true');
    expect(board()).toHaveClass('h');
  });

  it('switches back to vertical', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(horizontal());
    await user.click(vertical());

    expect(useStore.getState().orientation).toBe('vertical');
    expect(board()).toHaveClass('v');
  });

  // The spec's reason: a phone is tall and thin, so laying cards along the
  // long axis keeps the whole band width on screen and leaves "further along
  // the pattern" as the only scrolling axis.
  it('defaults to horizontal on a narrow viewport', () => {
    setViewportWidth(390);
    render(<App />);

    expect(useStore.getState().orientation).toBe('horizontal');
    expect(horizontal()).toHaveAttribute('aria-pressed', 'true');
    expect(board()).toHaveClass('h');
  });

  it('follows the viewport while nothing has been chosen', () => {
    render(<App />);
    expect(board()).toHaveClass('v');

    resizeTo(390);
    expect(board()).toHaveClass('h');

    resizeTo(1024);
    expect(board()).toHaveClass('v');
  });

  it('stops following the viewport once a choice is made', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(vertical());
    resizeTo(390);

    expect(useStore.getState().orientation).toBe('vertical');
    expect(board()).toHaveClass('v');
  });

  it('keeps a choice that agrees with the automatic one, then a resize cannot undo it', async () => {
    const user = userEvent.setup();
    setViewportWidth(390);
    render(<App />);

    // Horizontal is already the automatic choice here, so the click changes
    // nothing visible — but it is still a choice, and it must stick.
    await user.click(horizontal());
    resizeTo(1024);

    expect(useStore.getState().orientation).toBe('horizontal');
    expect(board()).toHaveClass('h');
  });

  it('remembers the choice across a reload, beating the automatic default', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await user.click(horizontal());

    // A reload: the store is back to its initial state, the viewport is
    // wide, and only localStorage carries anything over.
    first.unmount();
    act(() => useStore.getState().reset());
    render(<App />);

    expect(useStore.getState().orientation).toBe('horizontal');
    expect(board()).toHaveClass('h');
  });
});
