import { netTwist, reportTarget, threadCounts } from '@weavesmith/core';
import { useStore } from '../state/store.js';
import { WOOL_NAMES } from '../editor/palette.js';

const signed = (turns: number): string => (turns > 0 ? `+${turns}` : `${turns}`);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A palette entry's name if it is one of the dyed-wool presets, else its hex. */
const colorName = (hex: string): string => WOOL_NAMES[hex] ?? hex;

/**
 * What to measure out before warping the loom, plus how far the warp will
 * have twisted by the end of the band.
 *
 * The twist figure is reported, not judged: how many accumulated turns a
 * warp tolerates depends on its length and fibre, and this project has no
 * sourced threshold to put a "too much" line at. Naming the number is the
 * honest version — the weaver knows their warp.
 */
export function Summary() {
  const pattern = useStore((state) => state.pattern);
  const counts = threadCounts(pattern);
  const twist = netTwist(pattern);
  const report = reportTarget(pattern);
  // Whether anything is painted, not whether anything is wrong with it. A
  // fully-solved painting still has an answer worth reading — and a section
  // that disappears on success looks identical to one that was never painted.
  //
  // Checks the cells rather than trusting `target` to be absent when empty:
  // the commands maintain that, but an imported file is free to carry a grid
  // of nulls and validate clean.
  const painted = pattern.target?.some((row) => row.some((color) => color !== null)) ?? false;

  const distinctTwist = [...new Set(twist)];
  const uniform = distinctTwist.length === 1;

  return (
    <section className="summary" data-testid="chart-summary" aria-labelledby="summary-heading">
      <h2 id="summary-heading">Summary</h2>

      <p className="summary-line">
        <strong>{counts.cards} cards</strong>, <strong>{counts.warpEnds} warp ends</strong>{' '}
        (four per card).
      </p>

      <h3>Warp threads</h3>
      <ul className="thread-counts">
        {Object.entries(counts.perColor)
          .map(([index, ends]) => [Number(index), ends] as const)
          .sort(([a], [b]) => a - b)
          .map(([index, ends]) => (
            <li key={index}>
              <span
                className="summary-swatch"
                style={{ background: pattern.palette[index] }}
                aria-hidden="true"
              />
              {colorName(pattern.palette[index] ?? String(index))}: {ends} ends
            </li>
          ))}
      </ul>

      <h3>Accumulated twist</h3>
      {uniform ? (
        <p className="summary-line">
          Every card ends at {signed(distinctTwist[0]!)} turns after{' '}
          {pattern.picks.length} picks.
        </p>
      ) : (
        <>
          <p className="summary-line">
            Cards end at different twists after {pattern.picks.length} picks:
          </p>
          <ul className="twist-list">
            {twist.map((turns, cardIndex) => (
              <li key={cardIndex}>
                Card {cardIndex + 1}: {signed(turns)}
              </li>
            ))}
          </ul>
        </>
      )}

      {painted && (
        <>
          <h3>Against the target</h3>
          <p className="summary-line">
            {plural(report.unreachable.length, 'cell')} unreachable,{' '}
            {plural(report.unmet.length, 'cell')} unmet.
          </p>
        </>
      )}
    </section>
  );
}
