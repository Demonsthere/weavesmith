import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { reportTarget, simulate } from '@weavesmith/core';
import { useStore } from '../state/store.js';
import { rectContains, selectionRect } from '../state/selection.js';
import { identityColor, isLandmark } from './identity.js';
import { Cell } from './Cell.js';
import { CardChip } from './CardChip.js';
import { usePointerBinding } from './usePointerBinding.js';
import { useKeyboardBinding } from './useKeyboardBinding.js';
import { growthFactor } from './sizing.js';
import { useAvailableWidth } from './useAvailableWidth.js';
import { LiveRegion } from './LiveRegion.js';
import { useRipple } from './useRipple.js';
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

/** Gutter and chip columns, from tokens.css — fixed chrome the cells grow past. */
const GUTTER = 40;
const CHIP = 58;

export function Board() {
  const { pattern, selection, orientation, render, mode, currentPick, documentId } = useStore();
  const band = useMemo(() => simulate(pattern), [pattern]);
  const ripple = useRipple(band, documentId);
  // Recomputed rather than cached: reportTarget is linear in cells, and a
  // stale answer here would be a board that lies about what the loom will
  // produce. Weave mode is the at-loom view and carries no marks at all.
  const marks = useMemo(() => {
    if (mode === 'weave') return new Map<string, { hex: string; reachable: boolean }>();
    const report = reportTarget(pattern);
    const entries = new Map<string, { hex: string; reachable: boolean }>();
    for (const cell of report.unreachable) {
      entries.set(`${cell.pick}:${cell.card}`, {
        hex: pattern.palette[cell.wanted]!,
        reachable: false,
      });
    }
    for (const cell of report.unmet) {
      entries.set(`${cell.pick}:${cell.card}`, {
        hex: pattern.palette[cell.wanted]!,
        reachable: true,
      });
    }
    return entries;
  }, [pattern, mode]);
  const rect = selectionRect(selection);
  const { handlers, preview, hover } = usePointerBinding();
  const { onKeyDown, message } = useKeyboardBinding();
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const availableWidth = useAvailableWidth(scrollRef);

  const cardCount = pattern.cards.length;
  const pickCount = pattern.picks.length;
  const vertical = orientation === 'vertical';

  // Weave mode's at-loom tracker: keep the current pick on screen as
  // `currentPick` advances, the way a weaver would slide the band along
  // under their hands. Scoped to this board's own cells (not
  // `document.querySelector`) so a second Board instance, if one ever
  // exists, can't scroll the wrong one. A no-op outside weave mode — the
  // effect still runs on every `currentPick` change regardless of mode, but
  // there's nothing to scroll to when design mode never advances it.
  useEffect(() => {
    if (mode !== 'weave') return;
    const cell = boardRef.current?.querySelector(
      `[data-pick="${currentPick}"][data-card="0"]`,
    );
    cell?.scrollIntoView({ block: 'center', inline: 'center' });
  }, [mode, currentPick]);

  // Sizing follows the card axis: in `vertical` cards are columns, so
  // `--cell-w` shrinks with card count and `--cell-h` stays fixed; in
  // `horizontal` cards are rows, so it is `--cell-h` that shrinks.
  const baseW = vertical ? cardAxisSize(cardCount) : 34;
  const baseH = vertical ? 34 : pickAxisSizeHorizontal(cardCount);

  // Grow the cells to use the room the board has been given, up to a
  // ceiling. Both dimensions scale by one factor so the cell keeps its
  // proportions — a band whose stitches change shape with the window is a
  // different picture, not a bigger one. The gutter and chip columns are
  // fixed chrome, so they come off the available width rather than scaling
  // with it.
  const naturalWidth =
    (vertical ? GUTTER : CHIP) + (vertical ? cardCount * baseW : pickCount * baseW);
  const grow = growthFactor(availableWidth, naturalWidth, Math.max(baseW, baseH));
  const cellW = Math.round(baseW * grow);
  const cellH = Math.round(baseH * grow);

  const sizeVars = vertical
    ? {
        '--cell-w': `${cellW}px`,
        '--cell-h': `${cellH}px`,
        '--lean-base': '0deg',
        '--weave-angle': '58deg',
      }
    : {
        '--cell-w': `${cellW}px`,
        '--cell-h': `${cellH}px`,
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
    <div className="board-scroll" ref={scrollRef}>
      <div
        ref={boardRef}
        className={`board ${vertical ? 'v' : 'h'} mode-${render}${mode === 'paint' ? ' paint' : ''}`}
        role="grid"
        aria-label="Weaving board"
        style={style}
        {...handlers}
        onKeyDown={onKeyDown}
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
                rippleDelay={ripple.get(`${t}:${c}`) ?? null}
                unmet={marks.get(`${t}:${c}`) ?? null}
                targetHex={
                  mode === 'paint' && pattern.target?.[t]?.[c] != null
                    ? pattern.palette[pattern.target[t]![c]!]!
                    : null
                }
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
      <LiveRegion message={message} />
    </div>
  );
}
