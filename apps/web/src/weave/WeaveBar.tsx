import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useStore } from '../state/store.js';
import { identityColor } from '../board/identity.js';
import { useT } from '../i18n/useT.js';
import { hasSavedPosition, loadPosition, savePosition } from './position.js';
import '../styles/controls.css';
import './weaveBar.css';

/**
 * The at-loom tracker: current pick (one-indexed for a weaver, not a
 * programmer), one arrow per card showing which way it turns on this pick,
 * and Back/Next to step through the band. Board (Task 4) already highlights
 * the current pick and dims completed ones from `mode`/`currentPick` alone —
 * this bar is the only thing that ever changes `currentPick`, and the only
 * new UI this task adds.
 *
 * Position is hydrated from storage once per mount, and only when a saved
 * entry actually exists — `loadPosition` returns 0 for "never saved" and 0
 * is also a perfectly ordinary saved value, so without the existence check
 * a fresh mount would blindly reset an already-correct `currentPick` (e.g.
 * one a caller set directly before this bar ever rendered) back to the
 * start. `setCurrentPick` already clamps to the pattern's pick count, so
 * there is no clamping to duplicate here.
 */
export function WeaveBar() {
  const t = useT();
  const currentPick = useStore((state) => state.currentPick);
  const setCurrentPick = useStore((state) => state.setCurrentPick);
  const pattern = useStore((state) => state.pattern);
  const patternName = pattern.meta.name;
  const documentId = useStore((state) => state.documentId);

  useEffect(() => {
    if (hasSavedPosition(patternName)) {
      setCurrentPick(loadPosition(patternName));
    }
    // Intentionally re-runs only when the *document* changes — a fresh mount,
    // or `load`/`reset` opening a different band — not on every step and not
    // on every edit. `documentId` is the dependency that says exactly that:
    // keying on `pattern` would re-run on each edit and fight the Back/Next
    // handlers below, and keying on the name alone (as this did before
    // anything called `load`) would miss two different bands sharing a name.
  }, [documentId, patternName]);

  const step = (pick: number) => {
    setCurrentPick(pick);
    savePosition(patternName, useStore.getState().currentPick);
  };

  return (
    <div className="weavebar">
      <div className="pick">
        <small>{t('weave.pick')}</small>
        <span>{currentPick + 1}</span>
      </div>
      <div className="turns" aria-label={t('weave.turnsLabel')}>
        {pattern.cards.map((card, c) => {
          const forward = pattern.picks[currentPick]![c]! === 1;
          const style = {
            '--id': identityColor(card, c, pattern.cards.length, 'threading'),
          } as CSSProperties;
          return (
            <span
              key={c}
              className={forward ? 'fwd' : 'bwd'}
              style={style}
              role="img"
              aria-label={t('weave.cardTurning', { index: c + 1, forward })}
            >
              {forward ? '↑' : '↓'}
            </span>
          );
        })}
      </div>
      <button
        type="button"
        className="btn ghost"
        aria-label={t('weave.back')}
        onClick={() => step(currentPick - 1)}
      >
        {t('weave.back')}
      </button>
      <button
        type="button"
        className="btn"
        aria-label={t('weave.nextPick')}
        onClick={() => step(currentPick + 1)}
      >
        {t('weave.nextPick')}
      </button>
    </div>
  );
}
