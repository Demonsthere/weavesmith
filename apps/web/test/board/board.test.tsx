import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulate } from '@weavesmith/core';
import type { Card, Pattern, Turn } from '@weavesmith/core';
import { Board } from '../../src/board/Board.js';
import { useStore } from '../../src/state/store.js';
import type { Orientation } from '../../src/state/store.js';

/** A minimal, valid band with an arbitrary card count, alternating S/Z. */
function makePattern(cardCount: number): Pattern {
  const palette = ['#111111', '#222222', '#333333', '#444444'];
  const cards: Card[] = Array.from({ length: cardCount }, (_, i) => ({
    colors: [0, 1, 2, 3],
    threading: i % 2 === 0 ? 'S' : 'Z',
    start: 0,
  }));
  const picks: Turn[][] = Array.from({ length: 6 }, () => cards.map(() => 1 as Turn));
  return { version: 1, meta: { name: 'sizing fixture' }, palette, cards, picks };
}

describe('Board', () => {
  beforeEach(() => useStore.getState().reset());

  it('renders one row per pick', () => {
    render(<Board />);
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(useStore.getState().pattern.picks.length);
  });

  it('renders one cell per card in each row', () => {
    render(<Board />);
    const cards = useStore.getState().pattern.cards.length;
    for (const row of screen.getAllByRole('row')) {
      expect(within(row).getAllByRole('gridcell')).toHaveLength(cards);
    }
  });

  it('keeps DOM order row-major regardless of orientation', () => {
    // A screen reader must read pick 1 across all cards, then pick 2 - never
    // a whole card down the band. This is why orientation is placement-only.
    render(<Board />);
    const before = screen.getAllByRole('gridcell').map((el) => el.getAttribute('aria-label'));

    useStore.getState().setOrientation('horizontal');
    render(<Board />);
    const after = screen.getAllByRole('gridcell').map((el) => el.getAttribute('aria-label'));

    expect(after.slice(0, before.length)).toEqual(before);
  });

  it('labels each cell with its card, pick and turn', () => {
    render(<Board />);
    expect(screen.getByLabelText('Card 1, pick 1, turning forward')).toBeInTheDocument();
  });

  it('renders a chip per card', () => {
    render(<Board />);
    const cards = useStore.getState().pattern.cards.length;
    expect(screen.getAllByRole('button', { name: /^Card \d+, threaded/ })).toHaveLength(cards);
  });

  it('exposes exactly one tabbable cell', () => {
    render(<Board />);
    const tabbable = screen.getAllByRole('gridcell').filter((el) => el.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
  });
});

describe('Board — cell sizing floor', () => {
  beforeEach(() => useStore.getState().reset());

  it.each([4, 40] as const)(
    'never shrinks the card-axis cell dimension below 28px at %i cards, in either orientation',
    (cardCount) => {
      for (const orientation of ['vertical', 'horizontal'] as Orientation[]) {
        useStore.getState().load(makePattern(cardCount));
        useStore.getState().setOrientation(orientation);
        const { container, unmount } = render(<Board />);
        const board = container.querySelector('.board') as HTMLElement;
        const cellW = parseFloat(board.style.getPropertyValue('--cell-w'));
        const cellH = parseFloat(board.style.getPropertyValue('--cell-h'));
        expect(cellW).toBeGreaterThanOrEqual(28);
        expect(cellH).toBeGreaterThanOrEqual(28);
        unmount();
      }
    },
  );

  it.each(['vertical', 'horizontal'] as Orientation[])(
    'keeps row-major DOM order at 40 cards in %s orientation',
    (orientation) => {
      useStore.getState().load(makePattern(40));
      useStore.getState().setOrientation(orientation);
      render(<Board />);
      const rows = screen.getAllByRole('row');
      // First row's cells must be pick 1 for every card, in card order -
      // i.e. one row groups all cards at a single pick, never one card's
      // whole column.
      const labels = within(rows[0]!).getAllByRole('gridcell').map((el) => el.getAttribute('aria-label'));
      expect(labels).toHaveLength(40);
      labels.forEach((label, card) => {
        expect(label).toBe(`Card ${card + 1}, pick 1, turning forward`);
      });
    },
  );
});

describe('Board — colour comes only from simulate + palette', () => {
  beforeEach(() => useStore.getState().reset());

  it('paints every note face with simulate + pattern.palette, never an identity colour', () => {
    render(<Board />);
    const { pattern } = useStore.getState();
    const band = simulate(pattern);

    const cells = screen.getAllByRole('gridcell');
    expect(cells.length).toBeGreaterThan(0);

    for (const cell of cells) {
      const pick = Number(cell.getAttribute('data-pick'));
      const card = Number(cell.getAttribute('data-card'));
      const note = cell.querySelector('.note') as HTMLElement;
      const expectedHex = pattern.palette[band[pick]![card]!.color]!;
      expect(note.style.background).toBe(hexToRgbLike(expectedHex));
      // Identity colours are hsl(172 ...) teal or hsl(292 ...) orchid; note
      // faces must never carry either.
      expect(note.style.background).not.toContain('hsl(172');
      expect(note.style.background).not.toContain('hsl(292');
    }
  });

  it('keeps identity colour on chrome (chip/string/rail) only, distinct per threading', () => {
    render(<Board />);
    const { pattern } = useStore.getState();

    const chips = screen.getAllByRole('button', { name: /^Card \d+, threaded/ });
    for (const [index, chip] of chips.entries()) {
      const card = pattern.cards[index]!;
      const idVar = (chip as HTMLElement).style.getPropertyValue('--id');
      expect(idVar).toContain(card.threading === 'S' ? 'hsl(172' : 'hsl(292');
    }
  });
});

describe('Board — landmarks', () => {
  beforeEach(() => useStore.getState().reset());

  it.each(['vertical', 'horizontal'] as Orientation[])(
    'marks every fifth card as a landmark in %s orientation',
    (orientation) => {
      useStore.getState().load(makePattern(12));
      useStore.getState().setOrientation(orientation);
      const { container } = render(<Board />);
      const chips = screen.getAllByRole('button', { name: /^Card \d+, threaded/ });
      chips.forEach((chip, index) => {
        const wrapper = chip.closest('.row');
        const isLandmarkCard = (index + 1) % 5 === 0;
        expect(wrapper?.classList.contains('landmark')).toBe(isLandmarkCard);
      });
      // Sanity: cards 5 and 10 (1-indexed) are landmarks, others are not.
      expect(container.querySelectorAll('.row.landmark')).toHaveLength(2);
    },
  );
});

/**
 * jsdom's inline-style serialiser renders a `background` shorthand set to a
 * hex colour back out as `rgb(r, g, b)`. This mirrors that so the note-face
 * assertions compare like with like.
 */
function hexToRgbLike(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgb(${r}, ${g}, ${b})`;
}
