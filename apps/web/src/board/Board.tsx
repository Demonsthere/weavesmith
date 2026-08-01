import { useMemo, type CSSProperties } from 'react';
import { simulate } from '@weavesmith/core';
import { useStore } from '../state/store.js';
import { rectContains, selectionRect } from '../state/selection.js';
import { identityColor, isLandmark } from './identity.js';
import { Cell } from './Cell.js';
import { CardChip } from './CardChip.js';
import { usePointerBinding } from './usePointerBinding.js';
import '../styles/board.css';

/**
 * Card-axis cell size, shrinking as the band grows so 4-40 cards keep fitting
 * the viewport before the board resorts to scrolling. Floor is 28px — the
 * React equivalent of the prototype's `fitCells()`, with the 24px tier
 * raised to the 28px floor the brief requires.
 */
function cardAxisSize(count: number): number {
  if (count > 28) return 28;
  if (count > 18) return 30;
  if (count > 12) return 36;
  return 42;
}

/** Pick-axis cell size in horizontal orientation (the card axis is rows there). */
function pickAxisSizeHorizontal(count: number): number {
  return count > 12 ? 28 : 34;
}

export function Board() {
  const { pattern, selection, orientation, render, mode, currentPick } = useStore();
  const band = useMemo(() => simulate(pattern), [pattern]);
  const rect = selectionRect(selection);
  const { handlers, preview, hover } = usePointerBinding();

  const cardCount = pattern.cards.length;
  const pickCount = pattern.picks.length;
  const vertical = orientation === 'vertical';

  // Sizing follows the card axis: in `vertical` cards are columns, so
  // `--cell-w` shrinks with card count and `--cell-h` stays fixed; in
  // `horizontal` cards are rows, so it is `--cell-h` that shrinks.
  const sizeVars = vertical
    ? {
        '--cell-w': `${cardAxisSize(cardCount)}px`,
        '--cell-h': '34px',
        '--lean-base': '0deg',
        '--weave-angle': '58deg',
      }
    : {
        '--cell-w': '34px',
        '--cell-h': `${pickAxisSizeHorizontal(cardCount)}px`,
        '--lean-base': '90deg',
        '--weave-angle': '148deg',
      };

  const style: CSSProperties = vertical
    ? {
        gridTemplateColumns: `var(--gutter) repeat(${cardCount}, var(--cell-w))`,
        gridTemplateRows: `auto repeat(${pickCount}, var(--cell-h)) auto`,
        ...sizeVars,
      }
    : {
        gridTemplateColumns: `var(--chip) repeat(${pickCount}, var(--cell-w)) auto`,
        gridTemplateRows: `auto repeat(${cardCount}, var(--cell-h))`,
        ...sizeVars,
      };

  return (
    <div className="board-scroll">
      <div
        className={`board ${vertical ? 'v' : 'h'} mode-${render}`}
        role="grid"
        aria-label="Weaving board"
        style={style}
        {...handlers}
      >
        {pattern.cards.map((card, c) => (
          <CardChip
            key={c}
            card={card}
            index={c}
            count={cardCount}
            pickCount={pickCount}
            vertical={vertical}
            landmark={isLandmark(c)}
            color={identityColor(card, c, cardCount, 'threading')}
            palette={pattern.palette}
          />
        ))}

        {/* Row-major: one group per pick. display:contents keeps the cells as
            grid items while the DOM still reads the band in weaving order. */}
        {pattern.picks.map((_, t) => (
          <div className="row" role="row" key={t}>
            <div
              className={`tick${isLandmark(t) ? ' marked' : ''}`}
              style={vertical
                ? { gridRow: t + 2, gridColumn: 1 }
                : { gridRow: 1, gridColumn: t + 2 }}
            >
              {isLandmark(t) && vertical ? <span className="inlay" /> : null}
              <span>{t + 1}</span>
            </div>
            {pattern.cards.map((_card, c) => (
              <Cell
                key={c}
                pick={t}
                card={c}
                cell={band[t]![c]!}
                hex={pattern.palette[band[t]![c]!.color]!}
                turn={pattern.picks[t]![c]!}
                selected={rectContains(rect, t, c)}
                focused={selection.focus.pick === t && selection.focus.card === c}
                ghost={hover !== null && hover.pick === t && hover.card === c}
                willChange={preview.has(`${t}:${c}`)}
                weaveState={
                  mode === 'weave'
                    ? t === currentPick ? 'current' : t < currentPick ? 'past' : 'ahead'
                    : 'none'
                }
                style={vertical
                  ? { gridRow: t + 2, gridColumn: c + 2 }
                  : { gridRow: c + 2, gridColumn: t + 2 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
