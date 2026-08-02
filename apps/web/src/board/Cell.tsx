import type { CSSProperties } from 'react';
import type { Cell as WovenCell, Turn } from '@weavesmith/core';

interface Props {
  pick: number;
  card: number;
  cell: WovenCell;
  hex: string;
  turn: Turn;
  selected: boolean;
  focused: boolean;
  weaveState: 'none' | 'current' | 'past' | 'ahead';
  /** This is the hovered cell (fine-pointer hover preview only). */
  ghost: boolean;
  /** This cell is in the ripple that would change if `ghost` were flipped. */
  willChange: boolean;
  style: CSSProperties;
}

export function Cell({
  pick, card, cell, hex, turn, selected, focused, weaveState, ghost, willChange, style,
}: Props) {
  const classes = [
    'cell',
    cell.lean === '/' ? 'lean-s' : 'lean-z',
    selected ? 'selected' : '',
    focused ? 'focused' : '',
    weaveState === 'none' ? '' : weaveState,
    ghost ? 'ghost' : '',
    willChange ? 'willchange' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      role="gridcell"
      className={classes}
      style={style}
      tabIndex={focused ? 0 : -1}
      data-pick={pick}
      data-card={card}
      aria-label={`Card ${card + 1}, pick ${pick + 1}, turning ${turn === 1 ? 'forward' : 'backward'}`}
    >
      <span className="note" style={{ background: hex }} />
    </button>
  );
}
