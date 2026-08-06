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
  /**
   * Milliseconds to hold this cell's pulse back for, or null when it is not
   * rippling. Zero is a rippling cell that starts immediately, so this is
   * deliberately nullable rather than defaulting to 0.
   */
  rippleDelay: number | null;
  /** The colour the target asks for here, when Paint mode should draw it. */
  targetHex: string | null;
  /** Set when band and target disagree here. */
  unmet: { hex: string; reachable: boolean } | null;
  style: CSSProperties;
}

export function Cell({
  pick, card, cell, hex, turn, selected, focused, weaveState, ghost, willChange,
  rippleDelay, targetHex, unmet, style,
}: Props) {
  const classes = [
    'cell',
    cell.lean === '/' ? 'lean-s' : 'lean-z',
    selected ? 'selected' : '',
    focused ? 'focused' : '',
    weaveState === 'none' ? '' : weaveState,
    ghost ? 'ghost' : '',
    willChange ? 'willchange' : '',
    rippleDelay === null ? '' : 'rippling',
    unmet ? 'unmet' : '',
    targetHex === null ? 'unpainted' : 'painted',
  ].filter(Boolean).join(' ');

  // The mark is never the only channel: the same fact reads aloud here.
  const wanted = unmet
    ? `, wanted ${unmet.hex}${unmet.reachable ? ' — press Solve' : ' — unreachable'}`
    : '';

  const noteStyle: CSSProperties = { background: targetHex ?? hex };
  if (rippleDelay !== null) noteStyle.animationDelay = `${rippleDelay}ms`;

  return (
    <button
      type="button"
      role="gridcell"
      className={classes}
      style={unmet ? ({ ...style, '--wanted': unmet.hex } as CSSProperties) : style}
      tabIndex={focused ? 0 : -1}
      data-pick={pick}
      data-card={card}
      aria-label={
        `Card ${card + 1}, pick ${pick + 1}, turning ` +
        `${turn === 1 ? 'forward' : 'backward'}${wanted}`
      }
    >
      <span className="note" style={noteStyle} />
    </button>
  );
}
