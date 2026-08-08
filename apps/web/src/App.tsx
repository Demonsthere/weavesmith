import { useEffect, useState } from 'react';
import { Board } from './board/Board.js';
import { CardStepper } from './board/CardStepper.js';
import { CardEditor } from './editor/CardEditor.js';
import { Chart } from './chart/Chart.js';
import { Footer } from './Footer.js';
import { WeaveBar } from './weave/WeaveBar.js';
import { BrushStrip } from './paint/BrushStrip.js';
import { FileMenu } from './io/FileMenu.js';
import { bootPattern } from './io/boot.js';
import type { Booted } from './io/boot.js';
import { autosaveSoon } from './io/storage.js';
import { detectLocale } from './i18n/detect.js';
import { LanguageToggle } from './i18n/LanguageToggle.js';
import type { MessageKey } from './i18n/messages/en.js';
import { useT } from './i18n/useT.js';
import { readLocale } from './io/preferences.js';
import { useStore } from './state/store.js';
import { useRoute } from './state/route.js';
import { useOrientationPreference } from './state/useOrientationPreference.js';
import type { Orientation, RenderMode, ScreenMode } from './state/store.js';
import './screenMode.css';

const SCREEN_MODES: { value: ScreenMode; key: MessageKey }[] = [
  { value: 'design', key: 'mode.design' },
  { value: 'paint', key: 'mode.paint' },
  { value: 'weave', key: 'mode.weave' },
];

// The arrow shows which way the band grows, as in the mockup
// (board.html:394). It is a glyph rather than a word, so each button carries
// an `aria-label` that reads as speech — and one that still contains the
// visible word, so voice control can hit it by what it says.
const ORIENTATIONS: { value: Orientation; key: MessageKey; nameKey: MessageKey }[] = [
  { value: 'vertical', key: 'orientation.vertical', nameKey: 'orientation.verticalName' },
  { value: 'horizontal', key: 'orientation.horizontal', nameKey: 'orientation.horizontalName' },
];

// Woven first, matching the store's default and the mockup's order: the
// woven view is the band, and dots is the aiming aid you switch to.
const RENDER_MODES: { value: RenderMode; key: MessageKey }[] = [
  { value: 'woven', key: 'render.woven' },
  { value: 'dots', key: 'render.dots' },
];

// Real anchors, not buttons: they are navigation, so they get the browser's
// history, middle-click and "copy link" for free, and satisfy the
// keyboard-reachability constraint without a binding of their own.
const SCREENS: { hash: string; key: MessageKey }[] = [
  { hash: '#/board', key: 'app.nav.board' },
  { hash: '#/chart', key: 'app.nav.chart' },
];

export function App() {
  const route = useRoute();
  const t = useT();
  const boot = useBoot();

  return (
    <>
      <header role="banner">
        <h1>
          Weave<em>Smith</em>
        </h1>
        <nav className="screen-nav" aria-label={t('app.nav.screens')}>
          {SCREENS.map(({ hash, key }) => (
            <a key={hash} href={hash} aria-current={hash === `#/${route}` ? 'page' : undefined}>
              {t(key)}
            </a>
          ))}
        </nav>
        <LanguageToggle />
      </header>
      <main>
        {(boot.problems !== null || boot.unreadable) && (
          <div role="alert" className="filemenu-report">
            <p>{t('boot.shareFailed')}</p>
            <ul>
              {boot.unreadable ? (
                // Our own fact, not core's — resolved here, at render time,
                // so it is correct on first paint and follows a later
                // EN/PL switch rather than freezing whatever locale was
                // active when the boot effect ran.
                <li>{t('boot.unreadable')}</li>
              ) : (
                boot.problems!.map((problem) => <li key={problem}>{problem}</li>)
              )}
            </ul>
          </div>
        )}
        <FileMenu />
        {route === 'chart' ? <Chart /> : <BoardScreen />}
      </main>
      <Footer />
    </>
  );
}

/**
 * Opens the right band on first render and keeps it saved from then on.
 *
 * The boot read happens once, in an effect, rather than as the store's
 * initial state: the store is a module singleton shared by every test, and
 * reading `location.hash` and `localStorage` at module-eval time would make
 * importing it a side effect. Returns whatever was wrong with a share link,
 * for the caller to show — as facts (`problems`, `unreadable`), never as
 * already-translated prose: this effect runs, and calls `setLocale`, before
 * the caller's next render, so any string resolved here would be stuck in
 * whichever locale was active when the effect fired rather than the one the
 * weaver actually reads in.
 */
function useBoot(): Pick<Booted, 'problems' | 'unreadable'> {
  const [boot, setBoot] = useState<Pick<Booted, 'problems' | 'unreadable'>>({
    problems: null,
    unreadable: false,
  });

  useEffect(() => {
    const booted = bootPattern(window.location.hash);
    useStore.getState().load(booted.pattern);
    setBoot({ problems: booted.problems, unreadable: booted.unreadable });

    // Stored override first, then the browser's own preference, then
    // English. A stored value naming no catalogue reads as null (validated
    // in preferences.ts), so detection decides rather than the app
    // rendering in a language it has no strings for.
    const stored = readLocale();
    useStore.getState().setLocale(stored ?? detectLocale(navigator.languages));

    // Autosave every subsequent change. Debounced in `autosaveSoon`, so a
    // drag across the board costs one write rather than one per pointermove.
    return useStore.subscribe((state, previous) => {
      if (state.pattern !== previous.pattern) autosaveSoon(state.pattern);
    });
  }, []);

  return boot;
}

/**
 * The board and everything that only makes sense beside it. Split out so
 * that routing to the chart unmounts the board's controls with it — the
 * card stepper and the design/weave toggle act on a board that isn't on
 * screen otherwise.
 */
function BoardScreen() {
  const t = useT();
  const editingCard = useStore((state) => state.editingCard);
  const closeEditor = useStore((state) => state.closeEditor);
  const openEditor = useStore((state) => state.openEditor);
  const mode = useStore((state) => state.mode);
  const setMode = useStore((state) => state.setMode);
  const render = useStore((state) => state.render);
  const setRender = useStore((state) => state.setRender);
  const orientation = useStore((state) => state.orientation);
  const setOrientation = useStore((state) => state.setOrientation);
  useOrientationPreference();

  return (
    <>
      <div className="controls">
        <CardStepper onAdded={openEditor} />
        <div className="segmented" role="group" aria-label={t('orientation.group')}>
          {ORIENTATIONS.map(({ value, key, nameKey }) => (
            <button
              key={value}
              type="button"
              aria-label={t(nameKey)}
              aria-pressed={orientation === value}
              onClick={() => setOrientation(value)}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label={t('render.group')}>
          {RENDER_MODES.map(({ value, key }) => (
            <button
              key={value}
              type="button"
              aria-pressed={render === value}
              onClick={() => setRender(value)}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label={t('mode.group')}>
          {SCREEN_MODES.map(({ value, key }) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>
      {/* Same component in both modes, per the design spec — `mode`
          already turns Board into the at-loom tracker on its own (Task
          4); WeaveBar is only mounted, not switched to, so it never holds
          stale state from a mode it isn't currently in. */}
      {mode === 'weave' && <WeaveBar />}
      {mode === 'paint' && <BrushStrip />}
      <Board />
      {/* `key` forces a remount on every change of which card is being
          edited — belt and braces alongside CardEditor's own
          cardIndex-keyed reset effect, not a substitute for it: the
          component must not depend on its parent remembering this. */}
      <CardEditor key={editingCard} cardIndex={editingCard} onClose={closeEditor} />
    </>
  );
}
