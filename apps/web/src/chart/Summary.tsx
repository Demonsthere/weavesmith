import { netTwist, reportTarget, threadCounts } from '@weavesmith/core';
import { useStore } from '../state/store.js';
import { useT } from '../i18n/useT.js';
import { useColorName } from '../i18n/useColorName.js';

const signed = (turns: number): string => (turns > 0 ? `+${turns}` : `${turns}`);

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
  const t = useT();
  const pattern = useStore((state) => state.pattern);
  const colorName = useColorName();
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
      <h2 id="summary-heading">{t('summary.heading')}</h2>

      <p className="summary-line">
        <strong>{t('summary.cards', { count: counts.cards })}</strong>,{' '}
        <strong>{t('summary.warpEnds', { count: counts.warpEnds })}</strong>{' '}
        {t('summary.perCard')}
      </p>

      <h3>{t('summary.warpThreads')}</h3>
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
              {colorName(pattern.palette[index] ?? String(index))}:{' '}
              {t('summary.ends', { count: ends })}
            </li>
          ))}
      </ul>

      <h3>{t('summary.twistHeading')}</h3>
      {uniform ? (
        <p className="summary-line">
          {t('summary.twistUniform', {
            turns: signed(distinctTwist[0]!),
            picks: t('summary.picks', { count: pattern.picks.length }),
          })}
        </p>
      ) : (
        <>
          <p className="summary-line">
            {t('summary.twistVaries', {
              picks: t('summary.picks', { count: pattern.picks.length }),
            })}
          </p>
          <ul className="twist-list">
            {twist.map((turns, cardIndex) => (
              <li key={cardIndex}>
                {t('summary.twistCard', { index: cardIndex + 1, turns: signed(turns) })}
              </li>
            ))}
          </ul>
        </>
      )}

      {painted && (
        <>
          <h3>{t('summary.againstTarget')}</h3>
          <p className="summary-line">
            {t('summary.targetLine', {
              unreachable: t('summary.cellsUnreachable', { count: report.unreachable.length }),
              unmet: t('summary.cellsUnmet', { count: report.unmet.length }),
            })}
          </p>
        </>
      )}
    </section>
  );
}
