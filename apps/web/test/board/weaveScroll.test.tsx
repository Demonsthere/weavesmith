import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';

describe('Board — weave mode auto-scroll', () => {
  beforeEach(() => useStore.getState().reset());
  afterEach(() => vi.restoreAllMocks());

  it('scrolls the current pick into view when in weave mode', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    useStore.getState().setMode('weave');
    useStore.getState().setCurrentPick(3);
    render(<Board />);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'center' });
    // Scrolls the row's first card, per the design ("cellEls[currentPick][0]").
    const target = scrollIntoView.mock.instances[0] as unknown as HTMLElement;
    expect(target.getAttribute('data-pick')).toBe('3');
    expect(target.getAttribute('data-card')).toBe('0');
  });

  it('re-scrolls as the current pick advances', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    useStore.getState().setMode('weave');
    const { rerender } = render(<Board />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    useStore.getState().setCurrentPick(5);
    rerender(<Board />);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    const target = scrollIntoView.mock.instances[1] as unknown as HTMLElement;
    expect(target.getAttribute('data-pick')).toBe('5');
  });

  it('does not scroll in design mode', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<Board />);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
